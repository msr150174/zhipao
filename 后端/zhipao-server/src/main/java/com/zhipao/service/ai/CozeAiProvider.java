package com.zhipao.service.ai;

import cn.hutool.core.util.StrUtil;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 云 AI（扣子 / Coze）
 *
 * ★ 定位：本地 AI 不可用时的兜底
 * ★ 未配置时 isAvailable() 返回 false，不影响启动
 *
 * 配置：
 *   COZE_API_TOKEN=pat_xxx
 *   COZE_BOT_ID=7xxxxxxxxxxxxxxx
 *
 * ⚠️ 数据出境提醒：
 *   云端 AI 会把用户问题发到外部。因此 AiService 在调用前
 *   已经过滤了安全词，且查订单走本地库不走 AI。
 */
@Slf4j
@Component
@Order(2)   // ★ 次于本地 AI
public class CozeAiProvider implements AiProvider {

    @Value("${zhipao.ai.coze.base-url:https://api.coze.cn}")
    private String baseUrl;

    @Value("${zhipao.ai.coze.api-token:}")
    private String apiToken;

    @Value("${zhipao.ai.coze.bot-id:}")
    private String botId;

    private final RestTemplate restTemplate;

    public CozeAiProvider() {
        org.springframework.http.client.SimpleClientHttpRequestFactory factory =
                new org.springframework.http.client.SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(5000);
        factory.setReadTimeout(30_000);
        this.restTemplate = new RestTemplate(factory);
    }

    @Override
    public String name() {
        return "coze";
    }

    @Override
    public boolean isAvailable() {
        return StrUtil.isNotBlank(apiToken) && StrUtil.isNotBlank(botId);
    }

    @Override
    public AiAnswer chat(String userId, List<AiMessage> messages) {
        if (!isAvailable()) {
            return null;
        }

        try {
            String url = StrUtil.removeSuffix(baseUrl, "/") + "/v3/chat";

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBearerAuth(apiToken);

            Map<String, Object> body = new HashMap<>();
            body.put("bot_id", botId);
            body.put("user_id", userId);
            body.put("stream", false);
            body.put("auto_save_history", true);
            body.put("additional_messages", toCozeMessages(messages));

            ResponseEntity<Map> resp = restTemplate.postForEntity(
                    url, new HttpEntity<>(body, headers), Map.class);

            String content = extractCozeContent(resp.getBody());
            if (StrUtil.isBlank(content)) {
                log.warn("Coze 返回空内容");
                return null;
            }

            return AiAnswer.builder()
                    .text(content.trim())
                    .provider("coze")
                    .degraded(false)
                    .showManualEntry(false)
                    .build();

        } catch (Exception e) {
            log.warn("Coze 调用失败（将降级到规则库）: {}", e.getMessage());
            return null;
        }
    }

    /**
     * 转成 Coze 的消息格式
     *
     * Coze v3/chat 要求：
     *   [{ role: 'user', content: '...', content_type: 'text' }]
     */
    private List<Map<String, Object>> toCozeMessages(List<AiMessage> messages) {
        List<Map<String, Object>> list = new ArrayList<>();

        int start = Math.max(0, messages.size() - 10);
        for (int i = start; i < messages.size(); i++) {
            AiMessage m = messages.get(i);
            if (m.getContent() == null) {
                continue;
            }
            // Coze 只接受 user / assistant
            String role = "assistant".equals(m.getRole()) ? "assistant" : "user";

            Map<String, Object> item = new HashMap<>();
            item.put("role", role);
            item.put("content", m.getContent());
            item.put("content_type", "text");
            list.add(item);
        }

        return list;
    }

    /**
     * 从 Coze 响应里取内容
     *
     * ★ Coze v3/chat 是**异步**的：首次调用返回 chat_id + conversation_id，
     *   需要再调 /v3/chat/retrieve 查状态，完成后调 /v3/chat/message/list 取回答。
     *
     * 本实现做**有限轮询**（最多 3 次，每次间隔 1 秒），
     * 若仍未完成则返回 null，由上层降级到规则库。
     *
     * ⚠️ 生产环境更优方案：用 Coze 的**流式接口**（stream=true）边收边拼。
     */
    private String extractCozeContent(Map<?, ?> body) {
        if (body == null) {
            return null;
        }

        // 某些情况下（如非流式快速返回）直接带 messages
        Object data = body.get("data");
        if (!(data instanceof Map<?, ?> d)) {
            return null;
        }

        String chatId = str(d.get("id"));
        String conversationId = str(d.get("conversation_id"));

        // ① 先看首次响应里有没有 answer
        String direct = pickAnswer(d.get("messages"));
        if (StrUtil.isNotBlank(direct)) {
            return direct;
        }

        if (StrUtil.isBlank(chatId) || StrUtil.isBlank(conversationId)) {
            return null;
        }

        // ② 轮询取消息（最多 3 次）
        for (int i = 0; i < 3; i++) {
            try {
                Thread.sleep(1000L);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return null;
            }

            String url = StrUtil.removeSuffix(baseUrl, "/")
                    + "/v3/chat/message/list"
                    + "?conversation_id=" + conversationId
                    + "&chat_id=" + chatId;

            HttpHeaders headers = new HttpHeaders();
            headers.setBearerAuth(apiToken);

            try {
                ResponseEntity<Map> resp = restTemplate.exchange(
                        url, org.springframework.http.HttpMethod.GET,
                        new HttpEntity<>(headers), Map.class);

                Map<?, ?> respBody = resp.getBody();
                if (respBody != null && respBody.get("data") instanceof List<?> list) {
                    String ans = pickAnswer(list);
                    if (StrUtil.isNotBlank(ans)) {
                        return ans;
                    }
                }
            } catch (Exception e) {
                log.debug("Coze 取消息失败（第 {} 次）: {}", i + 1, e.getMessage());
            }
        }

        return null;
    }

    /** 从消息列表里挑出 type=answer 的内容 */
    private String pickAnswer(Object messages) {
        if (!(messages instanceof List<?> list)) {
            return null;
        }
        for (Object item : list) {
            if (item instanceof Map<?, ?> m) {
                if ("answer".equals(str(m.get("type")))) {
                    String c = str(m.get("content"));
                    if (StrUtil.isNotBlank(c)) {
                        return c;
                    }
                }
            }
        }
        return null;
    }

    private String str(Object o) {
        return o == null ? null : o.toString();
    }
}
