package com.zhipao.service.ai;

import lombok.Builder;
import lombok.Data;

/**
 * AI 回答
 *
 * provider 取值（与前端契约一致）：
 *   guard    → 安全词拦截，转人工（不走 AI）
 *   local    → 本地查库/规则库
 *   ollama   → 本地 AI
 *   coze     → 云 AI
 *   cache    → 缓存命中
 *   fallback → 兜底
 */
@Data
@Builder
public class AiAnswer {

    /** 回答文本 */
    private String text;

    /** 是否降级（置信度低 / 走兜底） */
    private Boolean degraded;

    /** 是否显示"手动查看订单"入口 */
    private Boolean showManualEntry;

    /** 提供方 */
    private String provider;

    /** 关联订单 ID（查订单场景） */
    private String orderId;

    public static AiAnswer of(String text, String provider) {
        return AiAnswer.builder()
                .text(text)
                .provider(provider)
                .degraded(false)
                .showManualEntry(false)
                .build();
    }
}
