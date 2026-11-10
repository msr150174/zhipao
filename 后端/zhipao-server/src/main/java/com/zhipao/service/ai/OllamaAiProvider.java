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
 * 本地 AI（Ollama）
 *
 * ★ 优点：快、免费、数据不出内网
 * ★ 未配置时 isAvailable() 返回 false，上层自动跳过，不影响启动
 *
 * 部署示例：
 *   1. 安装 Ollama：https://ollama.com
 *   2. ollama pull qwen2.5:7b
 *   3. 配置 OLLAMA_BASE_URL=http://localhost:11434  OLLAMA_MODEL=qwen2.5:7b
 */
@Slf4j
@Component
@Order(1)   // ★ 优先级最高（本地优先）
public class OllamaAiProvider implements AiProvider {

    @Value("${zhipao.ai.ollama.base-url:}")
    private String baseUrl;

    @Value("${zhipao.ai.ollama.model:}")
    private String model;

    @Value("${zhipao.ai.ollama.timeout-seconds:30}")
    private int timeoutSeconds;

    private final RestTemplate restTemplate;

    public OllamaAiProvider() {
        // 单独的超时配置（不与其他 HTTP 调用共用）
        org.springframework.http.client.SimpleClientHttpRequestFactory factory =
                new org.springframework.http.client.SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(5000);
        factory.setReadTimeout(30_000);
        this.restTemplate = new RestTemplate(factory);
    }

    @Override
    public String name() {
        return "ollama";
    }

    @Override
    public boolean isAvailable() {
        return StrUtil.isNotBlank(baseUrl) && StrUtil.isNotBlank(model);
    }

    @Override
    public AiAnswer chat(String userId, List<AiMessage> messages) {
        if (!isAvailable()) {
            return null;
        }

        try {
            Map<String, Object> body = new HashMap<>();
            body.put("model", model);
            body.put("stream", false);
            body.put("messages", buildMessages(messages));

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            String url = StrUtil.removeSuffix(baseUrl, "/") + "/api/chat";
            ResponseEntity<Map> resp = restTemplate.postForEntity(
                    url, new HttpEntity<>(body, headers), Map.class);

            String content = extractContent(resp.getBody());
            if (StrUtil.isBlank(content)) {
                log.warn("Ollama 返回空内容");
                return null;
            }

            return AiAnswer.builder()
                    .text(content.trim())
                    .provider("ollama")
                    .degraded(false)
                    .showManualEntry(false)
                    .build();

        } catch (Exception e) {
            log.warn("Ollama 调用失败（将降级到云 AI）: {}", e.getMessage());
            return null;   // ★ 返回 null，让上层降级
        }
    }

    /**
     * ★ 系统提示词：明确边界，防止 AI 泄露敏感信息
     *
     * 这是**安全关键** —— 必须在提示词里明确禁止，
     * 因为 AI 可能"友好地"把用户问的取件码复述出来。
     */
    private List<Map<String, String>> buildMessages(List<AiMessage> messages) {
        List<Map<String, String>> list = new ArrayList<>();

        list.add(Map.of("role", "system", "content", """
                你是「智跑校园」的客服助手，帮助学生解答校园代取快递/外卖的问题。

                重要规则（必须严格遵守）：
                1. 绝不能透露任何用户的取件码、手机号、身份证号、学号
                2. 涉及退款、封号、被盗、被骗等安全问题，引导用户转人工客服
                3. 回答要简洁，控制在 100 字以内
                4. 不确定的问题，建议用户查看订单或联系人工客服
                5. 不要编造订单信息，只能依据用户提供的内容回答
                """));

        // 最多带 10 轮历史（避免上下文过长）
        int start = Math.max(0, messages.size() - 10);
        for (int i = start; i < messages.size(); i++) {
            AiMessage m = messages.get(i);
            if (m.getContent() == null) {
                continue;
            }
            list.add(Map.of(
                    "role", m.getRole() == null ? "user" : m.getRole(),
                    "content", m.getContent()));
        }

        return list;
    }

    /** 从 Ollama 响应里取内容 */
    @SuppressWarnings("unchecked")
    private String extractContent(Map<?, ?> body) {
        if (body == null) {
            return null;
        }
        Object msg = body.get("message");
        if (msg instanceof Map<?, ?> m) {
            Object c = m.get("content");
            return c == null ? null : c.toString();
        }
        // 兼容 /api/generate 的 response 字段
        Object r = body.get("response");
        return r == null ? null : r.toString();
    }
}
