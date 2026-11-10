package com.zhipao.service;

import cn.hutool.core.util.StrUtil;
import cn.hutool.http.HttpUtil;
import cn.hutool.json.JSONObject;
import cn.hutool.json.JSONUtil;
import com.zhipao.entity.Order;
import com.zhipao.entity.User;
import com.zhipao.mapper.OrderMapper;
import com.zhipao.mapper.UserMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;

/**
 * 微信订阅消息推送服务
 *
 * ★ 关键点：
 *   1. access_token 需缓存（有效期 7200s，微信限制每日获取次数）→ 存 Redis
 *   2. 用户是「一次性订阅」—— 推一条消耗一次授权
 *   3. 推送失败**不影响主业务**（全部 try/catch 兜住）
 *   4. 未配置模板 ID → 跳过推送，不报错
 *
 * 四个推送时点：
 *   - 有人接单   → 通知发布方
 *   - 已送达     → 通知发布方
 *   - 订单取消   → 通知相关方
 *   - 申诉结果   → 通知申诉方
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class NotifyService {

    private final OrderMapper orderMapper;
    private final UserMapper userMapper;
    private final StringRedisTemplate redis;

    @Value("${zhipao.wechat.app-id:}")
    private String appId;

    @Value("${zhipao.wechat.app-secret:}")
    private String appSecret;

    @Value("${zhipao.wechat.tmpl-order-accepted:}")
    private String tmplOrderAccepted;

    @Value("${zhipao.wechat.tmpl-order-delivered:}")
    private String tmplOrderDelivered;

    @Value("${zhipao.wechat.tmpl-order-cancelled:}")
    private String tmplOrderCancelled;

    @Value("${zhipao.wechat.tmpl-appeal-result:}")
    private String tmplAppealResult;

    private static final String TOKEN_KEY = "wx:access_token";
    private static final String TOKEN_URL = "https://api.weixin.qq.com/cgi-bin/token";
    private static final String SEND_URL = "https://api.weixin.qq.com/cgi-bin/message/subscribe/send";

    // ========================================================================
    // 推送时点
    // ========================================================================

    /** 有人接单 → 通知发布方 */
    @Async
    public void notifyOrderAccepted(String orderId) {
        push(orderId, OrderNotifyTarget.PUBLISHER, tmplOrderAccepted, "有人接单", order -> {
            Map<String, Object> data = new HashMap<>();
            data.put("thing1", Map.of("value", safe(order.getOrderNo(), 20)));
            data.put("thing2", Map.of("value", safe(order.getRunnerName(), 20)));
            return data;
        });
    }

    /** 已送达 → 通知发布方确认 */
    @Async
    public void notifyOrderDelivered(String orderId) {
        push(orderId, OrderNotifyTarget.PUBLISHER, tmplOrderDelivered, "已送达", order -> {
            Map<String, Object> data = new HashMap<>();
            data.put("thing1", Map.of("value", safe(order.getOrderNo(), 20)));
            data.put("thing2", Map.of("value", "请及时确认收货"));
            return data;
        });
    }

    /** 订单取消 → 通知相关方 */
    @Async
    public void notifyOrderCancelled(String orderId) {
        push(orderId, OrderNotifyTarget.BOTH, tmplOrderCancelled, "订单取消", order -> {
            Map<String, Object> data = new HashMap<>();
            data.put("thing1", Map.of("value", safe(order.getOrderNo(), 20)));
            data.put("thing2", Map.of("value", safe(order.getCancelReason(), 20)));
            return data;
        });
    }

    // ========================================================================
    // 内部
    // ========================================================================

    private enum OrderNotifyTarget {PUBLISHER, RUNNER, BOTH}

    private interface DataBuilder {
        Map<String, Object> build(Order order);
    }

    /** 通用推送 */
    private void push(String orderId, OrderNotifyTarget target,
                      String templateId, String scene, DataBuilder builder) {
        // 未配置模板 → 跳过（不报错）
        if (StrUtil.isBlank(templateId)) {
            log.debug("订阅消息模板未配置，跳过推送: {}", scene);
            return;
        }

        try {
            Order order = orderMapper.selectById(orderId);
            if (order == null) {
                return;
            }

            String page = "pages/order-detail/index?id=" + orderId;
            Map<String, Object> data = builder.build(order);

            if (target == OrderNotifyTarget.PUBLISHER || target == OrderNotifyTarget.BOTH) {
                sendTo(order.getPublisherId(), templateId, page, data, scene);
            }
            if (target == OrderNotifyTarget.RUNNER || target == OrderNotifyTarget.BOTH) {
                sendTo(order.getRunnerId(), templateId, page, data, scene);
            }
        } catch (Exception e) {
            // ★ 推送失败绝不影响主业务
            log.warn("推送失败（已忽略）scene={}: {}", scene, e.getMessage());
        }
    }

    /** 发给某个用户 */
    private void sendTo(String userId, String templateId, String page,
                        Map<String, Object> data, String scene) {
        if (StrUtil.isBlank(userId)) {
            return;
        }

        User user = userMapper.selectById(userId);
        if (user == null || StrUtil.isBlank(user.getOpenid())) {
            log.debug("用户 {} 无 openid，跳过推送", userId);
            return;
        }

        String token = getAccessToken();
        if (token == null) {
            return;
        }

        try {
            Map<String, Object> body = new HashMap<>();
            body.put("touser", user.getOpenid());
            body.put("template_id", templateId);
            body.put("page", page);
            body.put("data", data);

            String resp = HttpUtil.post(SEND_URL + "?access_token=" + token,
                    JSONUtil.toJsonStr(body), 8000);

            JSONObject json = JSONUtil.parseObj(resp);
            Integer errcode = json.getInt("errcode");
            if (errcode != null && errcode != 0) {
                // 43101 用户未订阅；47003 模板参数不合法
                log.warn("订阅消息发送失败 scene={} errcode={} errmsg={}",
                        scene, errcode, json.getStr("errmsg"));
            } else {
                log.info("订阅消息已发送 scene={} userId={}", scene, userId);
            }
        } catch (Exception e) {
            log.warn("订阅消息异常 scene={}: {}", scene, e.getMessage());
        }
    }

    /**
     * 获取 access_token（Redis 缓存，提前 5 分钟过期）
     */
    private String getAccessToken() {
        if (StrUtil.isBlank(appId) || StrUtil.isBlank(appSecret)) {
            log.debug("微信密钥未配置，跳过推送");
            return null;
        }

        // ① 查缓存
        try {
            String cached = redis.opsForValue().get(TOKEN_KEY);
            if (StrUtil.isNotBlank(cached)) {
                return cached;
            }
        } catch (Exception e) {
            log.debug("token 缓存读取失败: {}", e.getMessage());
        }

        // ② 请求微信
        try {
            Map<String, Object> params = new HashMap<>();
            params.put("grant_type", "client_credential");
            params.put("appid", appId);
            params.put("secret", appSecret);

            String resp = HttpUtil.get(TOKEN_URL, params, 8000);
            JSONObject json = JSONUtil.parseObj(resp);

            String token = json.getStr("access_token");
            Integer expiresIn = json.getInt("expires_in");

            if (StrUtil.isBlank(token)) {
                log.warn("获取 access_token 失败: {}", json.getStr("errmsg"));
                return null;
            }

            // ③ 缓存（提前 5 分钟过期）
            long ttl = (expiresIn == null ? 7200 : expiresIn) - 300;
            if (ttl > 0) {
                try {
                    redis.opsForValue().set(TOKEN_KEY, token, Duration.ofSeconds(ttl));
                } catch (Exception e) {
                    log.debug("token 缓存写入失败: {}", e.getMessage());
                }
            }

            return token;

        } catch (Exception e) {
            log.warn("获取 access_token 异常: {}", e.getMessage());
            return null;
        }
    }

    /** 微信要求 thing 类型 ≤ 20 字符 */
    private String safe(String s, int max) {
        if (s == null) {
            return "—";
        }
        return s.length() <= max ? s : s.substring(0, max);
    }

    /**
     * 前端上报订阅授权结果（可选）
     *
     * 微信是一次性订阅，前端授权后可以调用此接口记录，
     * 后端推送时优先推给已授权的用户（避免 43101）。
     */
    public void recordSubscribe(String userId, String templateId, String result) {
        try {
            String key = "wx:sub:" + userId + ":" + templateId;
            if ("accept".equals(result)) {
                redis.opsForValue().set(key, "1", Duration.ofDays(7));
            } else {
                redis.delete(key);
            }
        } catch (Exception e) {
            log.debug("记录订阅状态失败: {}", e.getMessage());
        }
    }
}
