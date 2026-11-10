package com.zhipao.service.ai;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * AI 对话消息
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class AiMessage {

    /** user / assistant / system */
    private String role;

    private String content;

    public static AiMessage user(String content) {
        return new AiMessage("user", content);
    }

    public static AiMessage assistant(String content) {
        return new AiMessage("assistant", content);
    }

    public static AiMessage system(String content) {
        return new AiMessage("system", content);
    }

    /** 便捷构造：单轮对话 */
    public static List<AiMessage> of(String userText) {
        return List.of(user(userText));
    }
}
