package com.zhipao.service.ai;

import java.util.List;

/**
 * AI 提供方接口
 *
 * ★ 双 AI 架构的关键抽象：
 *   上层 AiService 只依赖这个接口，不关心具体是 Ollama 还是 Coze。
 *
 * 实现类：
 *   OllamaAiProvider    本地 AI（优先，快且数据不出内网）
 *   CozeAiProvider      云 AI（兜底，能力强）
 *   LocalRuleAiProvider 规则库（保底，永远可用）
 */
public interface AiProvider {

    /** 提供方名称：ollama / coze / local */
    String name();

    /**
     * 是否可用
     * ★ 未配置密钥时返回 false，上层自动跳过（不报错）
     */
    boolean isAvailable();

    /**
     * 对话
     *
     * @param userId   用户 ID（用于多轮上下文隔离）
     * @param messages 对话历史（最后一条是用户提问）
     */
    AiAnswer chat(String userId, List<AiMessage> messages);
}
