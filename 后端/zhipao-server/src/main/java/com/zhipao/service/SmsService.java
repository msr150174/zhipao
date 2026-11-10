package com.zhipao.service;

import cn.hutool.core.util.RandomUtil;
import cn.hutool.core.util.StrUtil;
import com.zhipao.common.BizException;
import com.tencentcloudapi.common.Credential;
import com.tencentcloudapi.common.profile.ClientProfile;
import com.tencentcloudapi.common.profile.HttpProfile;
import com.tencentcloudapi.sms.v20210111.SmsClient;
import com.tencentcloudapi.sms.v20210111.models.SendSmsRequest;
import com.tencentcloudapi.sms.v20210111.models.SendSmsResponse;
import com.tencentcloudapi.sms.v20210111.models.SendStatus;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDate;
import java.util.concurrent.TimeUnit;

/**
 * 短信验证码服务（腾讯云）
 *
 * ★★ 关键改进：验证码存 Redis，不再用内存 Map ★★
 *   原 NestJS 版用内存 Map → 多实例部署时失效
 *   （实例 A 发的码，实例 B 验证不了）
 *
 * 三层防护：
 *   ① 60 秒频控（同号）
 *   ② 每日上限 10 次（同号）
 *   ③ 验证码 5 分钟过期 + 一次性
 *
 * ★ 未配置密钥 → 开发模式：验证码打印到日志，可完整联调
 */
@Slf4j
@Service
public class SmsService {

    private final StringRedisTemplate redis;

    @Value("${zhipao.tencent-cloud.secret-id:}")
    private String secretId;

    @Value("${zhipao.tencent-cloud.secret-key:}")
    private String secretKey;

    @Value("${zhipao.tencent-cloud.region:ap-guangzhou}")
    private String region;

    @Value("${zhipao.tencent-cloud.sms.sdk-app-id:}")
    private String sdkAppId;

    @Value("${zhipao.tencent-cloud.sms.sign-name:}")
    private String signName;

    @Value("${zhipao.tencent-cloud.sms.template-id:}")
    private String templateId;

    @Value("${zhipao.business.sms-daily-limit:10}")
    private int dailyLimit;

    /** Redis key 前缀 */
    private static final String CODE_KEY = "sms:code:";
    private static final String LIMIT_KEY = "sms:limit:";
    private static final String DAILY_KEY = "sms:daily:";

    /** 验证码有效期（分钟） */
    private static final int CODE_TTL_MINUTES = 5;
    /** 重发间隔（秒） */
    private static final int RESEND_INTERVAL_SECONDS = 60;

    private volatile SmsClient client;
    private volatile boolean clientReady = false;

    public SmsService(StringRedisTemplate redis) {
        this.redis = redis;
    }

    // ========================================================================
    // 发送
    // ========================================================================

    /**
     * 发送验证码
     *
     * @return devMode=true 表示走开发模式（验证码在日志里）
     */
    public SendResult sendCode(String phone) {
        assertPhone(phone);

        // ---- 频控 1：60 秒 ----
        String limitKey = LIMIT_KEY + phone;
        Boolean canSend = redis.opsForValue()
                .setIfAbsent(limitKey, "1", Duration.ofSeconds(RESEND_INTERVAL_SECONDS));
        if (!Boolean.TRUE.equals(canSend)) {
            Long ttl = redis.getExpire(limitKey, TimeUnit.SECONDS);
            throw BizException.badRequest("请 " + (ttl == null ? 60 : ttl) + " 秒后再试");
        }

        // ---- 频控 2：每日上限 ----
        String dailyKey = DAILY_KEY + phone + ":" + LocalDate.now();
        Long count = redis.opsForValue().increment(dailyKey);
        if (count != null && count == 1L) {
            redis.expire(dailyKey, Duration.ofHours(24));
        }
        if (count != null && count > dailyLimit) {
            // 超限时把频控键删掉，避免用户白等 60 秒
            redis.delete(limitKey);
            throw BizException.badRequest("今日验证码次数已达上限，请明天再试");
        }

        // ---- 生成并存储 ----
        String code = RandomUtil.randomNumbers(6);
        redis.opsForValue().set(CODE_KEY + phone, code, Duration.ofMinutes(CODE_TTL_MINUTES));

        // ---- 发送 ----
        SmsClient c = getClient();
        if (c == null) {
            log.warn("【开发模式】手机号 {} 的验证码为 {}（{} 分钟内有效）",
                    phone, code, CODE_TTL_MINUTES);
            return new SendResult(true);
        }

        doSend(c, phone, code);
        return new SendResult(false);
    }

    /** 真实发送 */
    private void doSend(SmsClient c, String phone, String code) {
        try {
            SendSmsRequest req = new SendSmsRequest();
            req.setPhoneNumberSet(new String[]{"+86" + phone});   // ★ 腾讯云要带国际区号
            req.setSmsSdkAppId(sdkAppId);
            req.setSignName(signName);
            req.setTemplateId(templateId);
            req.setTemplateParamSet(new String[]{code});          // ★ 腾讯云用数组，不是 JSON

            SendSmsResponse resp = c.SendSms(req);
            SendStatus[] statusSet = resp.getSendStatusSet();

            if (statusSet == null || statusSet.length == 0) {
                throw BizException.badRequest("短信发送失败：无返回状态");
            }

            String statusCode = statusSet[0].getCode();
            if (!"Ok".equals(statusCode)) {                       // ★ 成功码是 Ok，不是 OK
                String msg = statusSet[0].getMessage();
                log.warn("短信发送失败: {} {}", statusCode, msg);
                throw BizException.badRequest(mapSmsError(statusCode, msg));
            }

            log.info("短信已发送: {}", maskPhone(phone));

        } catch (BizException e) {
            throw e;
        } catch (Exception e) {
            log.error("短信发送异常: {}", e.getMessage());
            throw BizException.badRequest("短信服务异常，请稍后重试");
        }
    }

    /** 错误码 → 友好提示 */
    private String mapSmsError(String code, String message) {
        if (code == null) {
            return "短信发送失败，请稍后重试";
        }
        return switch (code) {
            case "FailedOperation.SignatureIncorrectOrUnapproved" -> "短信签名未通过审核";
            case "FailedOperation.TemplateIncorrectOrUnapproved" -> "短信模板未通过审核";
            case "FailedOperation.InsufficientBalanceInSmsPackage" -> "短信套餐包余量不足，请购买";
            case "LimitExceeded.PhoneNumberDailyLimit" -> "该号码今日发送次数超限";
            case "LimitExceeded.PhoneNumberOneHourLimit" -> "该号码发送过于频繁";
            case "FailedOperation.PhoneNumberInBlacklist" -> "该号码已被拉黑";
            default -> "短信发送失败：" + (message == null ? code : message);
        };
    }

    // ========================================================================
    // 校验
    // ========================================================================

    /**
     * 校验验证码
     *
     * ★ 验证成功后**立即删除**（一次性），防止重放攻击
     */
    public boolean verifyCode(String phone, String code) {
        if (StrUtil.isBlank(phone) || StrUtil.isBlank(code)) {
            return false;
        }

        String key = CODE_KEY + phone;
        String cached = redis.opsForValue().get(key);

        if (cached == null || !cached.equals(code)) {
            return false;
        }

        redis.delete(key);   // ★ 一次性
        return true;
    }

    // ========================================================================
    // 内部
    // ========================================================================

    /** 懒加载腾讯云客户端（未配置返回 null） */
    private SmsClient getClient() {
        if (clientReady) {
            return client;
        }
        synchronized (this) {
            if (clientReady) {
                return client;
            }
            clientReady = true;

            if (StrUtil.isBlank(secretId) || StrUtil.isBlank(secretKey)
                    || StrUtil.isBlank(sdkAppId) || StrUtil.isBlank(signName)
                    || StrUtil.isBlank(templateId)) {
                log.warn("腾讯云短信未配置 → 开发模式（验证码只打印到日志）");
                client = null;
                return null;
            }

            try {
                Credential cred = new Credential(secretId, secretKey);
                HttpProfile httpProfile = new HttpProfile();
                httpProfile.setEndpoint("sms.tencentcloudapi.com");
                httpProfile.setConnTimeout(5);
                httpProfile.setReadTimeout(10);

                ClientProfile clientProfile = new ClientProfile();
                clientProfile.setHttpProfile(httpProfile);

                client = new SmsClient(cred, region, clientProfile);
                log.info("腾讯云短信客户端初始化成功（region={}）", region);
                return client;

            } catch (Exception e) {
                log.error("腾讯云短信客户端初始化失败: {}（降级为开发模式）", e.getMessage());
                client = null;
                return null;
            }
        }
    }

    /** 手机号格式校验（中国大陆） */
    private void assertPhone(String phone) {
        if (StrUtil.isBlank(phone) || !phone.matches("^1[3-9]\\d{9}$")) {
            throw BizException.badRequest("手机号格式不正确");
        }
    }

    private String maskPhone(String phone) {
        if (phone == null || phone.length() < 7) {
            return phone;
        }
        return phone.substring(0, 3) + "****" + phone.substring(phone.length() - 4);
    }

    /** 发送结果 */
    public record SendResult(boolean devMode) {
    }
}
