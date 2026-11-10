package com.zhipao.controller;

import com.zhipao.common.ApiResponse;
import com.zhipao.common.BizException;
import com.zhipao.interceptor.AuthInterceptor;
import com.zhipao.service.ai.AiAnswer;
import com.zhipao.service.ai.AiMessage;
import com.zhipao.service.ai.AiService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * AI 客服接口
 *
 *   POST /api/ai/chat    对话
 *
 * 请求体：
 * {
 *   "messages": [
 *     { "role": "user", "content": "信用分怎么算" }
 *   ]
 * }
 *
 * 响应：
 * {
 *   "code": 200,
 *   "data": {
 *     "text": "...",
 *     "provider": "local | ollama | coze | guard | cache | fallback",
 *     "degraded": false,
 *     "showManualEntry": true,
 *     "orderId": null
 *   }
 * }
 */
@RestController
@RequestMapping("/ai")
@RequiredArgsConstructor
public class AiController {

    private final AiService aiService;

    @PostMapping("/chat")
    public ApiResponse<AiAnswer> chat(HttpServletRequest req,
                                      @RequestBody Map<String, Object> body) {
        String userId = (String) req.getAttribute(AuthInterceptor.ATTR_USER_ID);

        Object messagesObj = body == null ? null : body.get("messages");
        if (!(messagesObj instanceof List<?> raw) || raw.isEmpty()) {
            throw BizException.badRequest("缺少对话内容");
        }

        List<AiMessage> messages = new ArrayList<>();
        for (Object item : raw) {
            if (item instanceof Map<?, ?> m) {
                Object role = m.get("role");
                Object content = m.get("content");
                if (content != null) {
                    messages.add(new AiMessage(
                            role == null ? "user" : role.toString(),
                            content.toString()));
                }
            }
        }

        if (messages.isEmpty()) {
            throw BizException.badRequest("对话内容为空");
        }

        // 最多带 10 轮（防止上下文过长）
        if (messages.size() > 10) {
            messages = new ArrayList<>(messages.subList(messages.size() - 10, messages.size()));
        }

        return ApiResponse.ok(aiService.chat(userId, messages));
    }

    /**
     * 查看当前可用的 AI 提供方（调试用）
     */
    @GetMapping("/providers")
    public ApiResponse<String> providers() {
        return ApiResponse.ok(aiService.availableProviders());
    }
}
