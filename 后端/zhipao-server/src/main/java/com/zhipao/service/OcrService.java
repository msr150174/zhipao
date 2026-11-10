package com.zhipao.service;

import cn.hutool.core.util.StrUtil;
import com.tencentcloudapi.common.Credential;
import com.tencentcloudapi.common.profile.ClientProfile;
import com.tencentcloudapi.common.profile.HttpProfile;
import com.tencentcloudapi.ocr.v20181119.OcrClient;
import com.tencentcloudapi.ocr.v20181119.models.GeneralBasicOCRRequest;
import com.tencentcloudapi.ocr.v20181119.models.GeneralBasicOCRResponse;
import com.tencentcloudapi.ocr.v20181119.models.TextDetection;
import com.zhipao.common.BizException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 取件码 OCR 服务（腾讯云）
 *
 * ★ 成本控制三道防线：
 *   ① 前端本地正则预判（用户从短信复制的取件码不调 OCR）
 *   ② 单用户每日 5 次（Redis 计数）
 *   ③ 全局每日 300 次（Redis 计数）
 *
 * ★ 未配置密钥 → 返回空数组（前端走手动输入兜底，不报错）
 *
 * ⚠️ 地域必须国内（如 ap-guangzhou），境外无法扣减免费额度
 */
@Slf4j
@Service
public class OcrService {

    private final StringRedisTemplate redis;

    @Value("${zhipao.tencent-cloud.secret-id:}")
    private String secretId;

    @Value("${zhipao.tencent-cloud.secret-key:}")
    private String secretKey;

    @Value("${zhipao.tencent-cloud.region:ap-guangzhou}")
    private String region;

    @Value("${zhipao.tencent-cloud.ocr.enabled:true}")
    private boolean enabled;

    @Value("${zhipao.business.ocr-daily-limit:5}")
    private int userDailyLimit;

    /** 全局每日上限（防异常刷量） */
    private static final int GLOBAL_DAILY_LIMIT = 300;

    private static final String USER_KEY = "ocr:daily:user:";
    private static final String GLOBAL_KEY = "ocr:daily:global:";

    private volatile OcrClient client;
    private volatile boolean clientReady = false;

    public OcrService(StringRedisTemplate redis) {
        this.redis = redis;
    }

    // ========================================================================
    // 取件码格式（与前端本地预判保持一致）
    // ========================================================================

    /** 格式 1：三段数字，驿站货架格式 8-2-3021 */
    private static final Pattern P1 = Pattern.compile("\\b(\\d{1,3}-\\d{1,3}-\\d{3,5})\\b");
    /** 格式 2：字母-数字，餐号/柜号 A-32 */
    private static final Pattern P2 = Pattern.compile("\\b([A-Z]-\\d{1,4})\\b");
    /** 格式 3：纯数字 4~8 位（自动排除 11 位手机号、12+ 位单号） */
    private static final Pattern P3 = Pattern.compile("(?:^|\\D)(\\d{4,8})(?:\\D|$)");
    /** 格式 4：字母数字混合 6~10 位 */
    private static final Pattern P4 = Pattern.compile("\\b([A-Z0-9]{6,10})\\b");

    /**
     * 从图片 URL 识别取件码
     *
     * @return 候选列表（可能为空；空 = 未识别到，前端走手动输入）
     */
    public List<String> extractPickupCodes(String imageUrl, String userId) {
        if (StrUtil.isBlank(imageUrl)) {
            throw BizException.badRequest("缺少图片地址");
        }
        if (!imageUrl.startsWith("https://")) {
            throw BizException.badRequest("图片地址不合法");
        }

        if (!enabled) {
            log.debug("OCR 未启用");
            return List.of();
        }

        // ★ 成本控制
        assertQuota(userId);

        OcrClient c = getClient();
        if (c == null) {
            // 未配置 → 返回空，不报错
            return List.of();
        }

        List<String> lines = callOcr(c, imageUrl);
        if (lines.isEmpty()) {
            return List.of();
        }

        return filterCodes(lines);
    }

    /** 频控：单用户 + 全局 */
    private void assertQuota(String userId) {
        String today = LocalDate.now().toString();

        try {
            // 全局上限
            String gKey = GLOBAL_KEY + today;
            Long gCount = redis.opsForValue().increment(gKey);
            if (gCount != null && gCount == 1L) {
                redis.expire(gKey, Duration.ofHours(24));
            }
            if (gCount != null && gCount > GLOBAL_DAILY_LIMIT) {
                throw BizException.badRequest("今日识别次数已达上限，请明天再试");
            }

            // 单用户上限
            String uKey = USER_KEY + userId + ":" + today;
            Long uCount = redis.opsForValue().increment(uKey);
            if (uCount != null && uCount == 1L) {
                redis.expire(uKey, Duration.ofHours(24));
            }
            if (uCount != null && uCount > userDailyLimit) {
                throw BizException.badRequest("每人每天最多识别 " + userDailyLimit + " 次");
            }
        } catch (BizException e) {
            throw e;
        } catch (Exception e) {
            // Redis 异常不阻断识别
            log.warn("OCR 频控检查异常（已忽略）: {}", e.getMessage());
        }
    }

    /** 调腾讯云 OCR */
    private List<String> callOcr(OcrClient c, String imageUrl) {
        try {
            GeneralBasicOCRRequest req = new GeneralBasicOCRRequest();
            req.setImageUrl(imageUrl);

            GeneralBasicOCRResponse resp = c.GeneralBasicOCR(req);
            TextDetection[] detections = resp.getTextDetections();

            List<String> lines = new ArrayList<>();
            if (detections != null) {
                for (TextDetection d : detections) {
                    if (StrUtil.isNotBlank(d.getDetectedText())) {
                        lines.add(d.getDetectedText().trim());
                    }
                }
            }
            return lines;

        } catch (Exception e) {
            // ★ 失败不抛错，走兜底
            log.warn("OCR 调用失败（返回空，前端走手动输入）: {}", e.getMessage());
            return List.of();
        }
    }

    /**
     * 从 OCR 文本过滤出「像取件码」的候选
     *
     * ★ 这是质量关键：不过滤的话快递单号、电话号会全返回，
     *   用户要在一堆数字里找，反而更麻烦。
     */
    public List<String> filterCodes(List<String> lines) {
        Set<String> out = new LinkedHashSet<>();

        for (String raw : lines) {
            if (StrUtil.isBlank(raw) || raw.length() > 24) {
                continue;
            }
            String s = raw.trim();

            addMatches(out, P1, s, 1);
            addMatches(out, P2, s, 1);
            addMatches(out, P3, s, 1);

            // 格式 4 要求含字母和数字
            Matcher m4 = P4.matcher(s);
            while (m4.find()) {
                String v = m4.group(1);
                if (v.matches(".*\\d.*") && v.matches(".*[A-Z].*")) {
                    out.add(v);
                }
            }
        }

        // 排序：带分隔符的（驿站格式）优先，其次短的
        List<String> list = new ArrayList<>(out);
        list.removeIf(c -> c.length() < 3 || c.length() > 12);
        list.sort((a, b) -> {
            int aDash = a.contains("-") ? 0 : 1;
            int bDash = b.contains("-") ? 0 : 1;
            if (aDash != bDash) {
                return aDash - bDash;
            }
            return a.length() - b.length();
        });

        return list.subList(0, Math.min(5, list.size()));
    }

    private void addMatches(Set<String> out, Pattern p, String s, int group) {
        Matcher m = p.matcher(s);
        while (m.find()) {
            out.add(m.group(group));
        }
    }

    // ========================================================================
    // 客户端
    // ========================================================================

    private OcrClient getClient() {
        if (clientReady) {
            return client;
        }
        synchronized (this) {
            if (clientReady) {
                return client;
            }
            clientReady = true;

            if (StrUtil.isBlank(secretId) || StrUtil.isBlank(secretKey)) {
                log.warn("腾讯云 OCR 未配置 → 识别返回空，前端走手动输入");
                client = null;
                return null;
            }

            try {
                Credential cred = new Credential(secretId, secretKey);
                HttpProfile httpProfile = new HttpProfile();
                httpProfile.setEndpoint("ocr.tencentcloudapi.com");
                httpProfile.setConnTimeout(5);
                httpProfile.setReadTimeout(15);

                ClientProfile clientProfile = new ClientProfile();
                clientProfile.setHttpProfile(httpProfile);

                // ★ region 必须是国内，否则无法扣减免费额度
                client = new OcrClient(cred, region, clientProfile);
                log.info("腾讯云 OCR 客户端初始化成功（region={}）", region);
                return client;

            } catch (Exception e) {
                log.error("OCR 客户端初始化失败: {}（降级为手动输入）", e.getMessage());
                client = null;
                return null;
            }
        }
    }

    /** 当前是否可用（供健康检查） */
    public boolean isConfigured() {
        return StrUtil.isNotBlank(secretId) && StrUtil.isNotBlank(secretKey);
    }
}
