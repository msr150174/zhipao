package com.zhipao.service.ai;

import cn.hutool.core.util.StrUtil;
import cn.hutool.crypto.digest.DigestUtil;
import com.zhipao.common.OrderStatus;
import com.zhipao.dto.response.OrderVO;
import com.zhipao.service.OrderService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.List;

/**
 * AI 客服服务（双 AI 路由）
 *
 * ★ 架构：
 *
 *                  ┌─ 【安全词】→ 直接转人工（不走任何 AI）
 *   用户提问 → 路由 ├─ 【查订单】→ 本地查库（走脱敏视图，不交给 AI）
 *                  └─ 【其他】 → ① 本地 AI（Ollama）优先
 *                                ② 云 AI（Coze）兜底
 *                                ③ 规则库保底
 *
 * ★ 三条安全红线：
 *   1. 安全词（退款/封号/被骗）**不走 AI**，直接转人工（防数据出境）
 *   2. 查订单**走 toOrderView 脱敏视图**，不把订单内容交给 AI
 *   3. provider 提示词里明确禁止泄露取件码/手机号
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AiService {

    private final OrderService orderService;
    private final LocalRuleAiProvider localProvider;
    private final OllamaAiProvider ollamaProvider;
    private final CozeAiProvider cozeProvider;
    private final StringRedisTemplate redis;

    /** 总开关 */
    @Value("${zhipao.ai.enabled:true}")
    private boolean aiEnabled;

    /** AI 结果缓存时长（小时） */
    @Value("${zhipao.ai.cache-hours:1}")
    private long cacheHours;

    /**
     * 安全词：命中则强制转人工，不交给任何 AI
     *
     * ★ 覆盖资金、账号安全、投诉三类
     */
    private static final List<String> SAFETY_WORDS = List.of(
            // 资金
            "退款", "退钱", "提现失败", "余额不对", "扣款", "乱收费",
            // 账号安全
            "冻结", "封号", "被封", "解封", "盗刷", "被盗", "被骗", "诈骗", "报警", "举报",
            // 转人工 & 投诉
            "人工", "客服人工", "转人工", "找客服", "投诉", "曝光", "维权"
    );

    /**
     * 投诉 / 异常类关键词 → 转人工
     *
     * ★ 这些涉及物品损坏、丢失、纠纷，必须人工介入，
     *   不能交给规则库（会答非所问）或查订单（会答成订单进度）。
     */
    private static final List<String> COMPLAINT_WORDS = List.of(
            "被拆", "拆开", "丢了", "丢失", "少了", "缺了", "损坏", "弄坏", "打翻", "洒了",
            "不接电话", "联系不上", "态度", "骂人", "纠纷", "赔偿", "赔付", "争议",
            "没送到", "送错", "拿错", "没收到"
    );

    /**
     * 「问规则」的问题词
     *
     * ★ 必须优先于「查订单」判断 ——
     *   否则「怎么取消订单」会因为含「订单」被当成查询请求。
     */
    private static final List<String> FAQ_WORDS = List.of(
            "怎么", "如何", "怎样", "为什么", "能不能", "可以吗", "规则", "是什么", "多少"
    );

    /**
     * 查订单意图关键词
     *
     * ★ 收紧：去掉过于宽泛的「订单」（会误判"怎么取消订单"）
     */
    private static final List<String> ORDER_WORDS = List.of(
            "查到哪", "到哪了", "到哪儿", "在哪里", "在哪儿", "什么进度", "进度如何",
            "我的快递", "我的外卖", "我的单", "单号是", "订单号是", "骑手在哪", "跑腿在哪"
    );

    /**
     * 对话入口
     */
    public AiAnswer chat(String userId, List<AiMessage> messages) {
        String text = LocalRuleAiProvider.lastUserText(messages);

        if (StrUtil.isBlank(text)) {
            return AiAnswer.builder()
                    .text("请描述您想咨询的问题。")
                    .provider("fallback")
                    .degraded(true)
                    .showManualEntry(true)
                    .build();
        }

        try {
            // ① 安全词 → 转人工（不走 AI）
            if (containsAny(text, SAFETY_WORDS)) {
                return humanHandoff("这涉及您的资金或账号安全，已为您转接人工客服"
                        + "（工作时间 9:00–21:00）。智能助手暂不处理此类问题。");
            }

            // ② 投诉 / 异常 → 转人工（★ 必须先于 规则库 与 查订单）
            //    否则「我的快递被拆了」会被"我的快递"命中而答成订单进度
            if (containsAny(text, COMPLAINT_WORDS)) {
                return humanHandoff("很抱歉给您带来困扰。这属于需要人工核实的问题，"
                        + "已为您转接人工客服（9:00–21:00），请准备好订单号。");
            }

            // ③ 规则库（★ 本地、零延迟、零成本）
            AiAnswer rule = localProvider.chat(userId, messages);
            boolean ruleHit = rule != null && !"fallback".equals(rule.getProvider());
            if (ruleHit) {
                return rule;
            }

            // ④ 查订单 → 本地查库（★ 走脱敏视图，不交给 AI）
            if (containsAny(text, ORDER_WORDS)) {
                return queryMyOrder(userId);
            }

            // ⑤ 其他 → 走 AI 引擎（本地 Ollama → 云端 Coze → 规则兜底）
            return askAi(userId, messages, text);

        } catch (Exception e) {
            // 任何异常都降级，不让用户看到报错
            log.warn("AI 客服异常: {}", e.getMessage());
            return AiAnswer.builder()
                    .text("智能助手暂时不可用，您可以点击下方按钮直接查看订单。")
                    .provider("fallback")
                    .degraded(true)
                    .showManualEntry(true)
                    .build();
        }
    }

    /**
     * 转人工回复（安全词 / 投诉类共用）
     */
    private AiAnswer humanHandoff(String text) {
        return AiAnswer.builder()
                .text(text)
                .provider("guard")
                .degraded(true)
                .showManualEntry(false)
                .build();
    }

    /**
     * AI 引擎路由：本地优先 → 云兜底 → 规则保底
     */
    private AiAnswer askAi(String userId, List<AiMessage> messages, String text) {
        // 结果缓存（相同问题复用，省 token / 省算力）
        String cacheKey = "ai:cache:" + DigestUtil.md5Hex(text);
        String cached = redis.opsForValue().get(cacheKey);
        if (StrUtil.isNotBlank(cached)) {
            return AiAnswer.builder()
                    .text(cached)
                    .provider("cache")
                    .degraded(false)
                    .showManualEntry(false)
                    .build();
        }

        if (aiEnabled) {
            // ① 本地 AI（Ollama）—— 快、免费、数据不出内网
            if (ollamaProvider.isAvailable()) {
                AiAnswer ans = ollamaProvider.chat(userId, messages);
                if (ans != null && StrUtil.isNotBlank(ans.getText())) {
                    cacheAnswer(cacheKey, ans.getText());
                    return ans;
                }
                log.debug("本地 AI 未返回有效内容，降级到云 AI");
            }

            // ② 云 AI（Coze）—— 兜底
            if (cozeProvider.isAvailable()) {
                AiAnswer ans = cozeProvider.chat(userId, messages);
                if (ans != null && StrUtil.isNotBlank(ans.getText())) {
                    cacheAnswer(cacheKey, ans.getText());
                    return ans;
                }
                log.debug("云 AI 未返回有效内容，降级到规则库");
            }
        }

        // ③ 规则兜底（永远可用）
        return localProvider.chat(userId, messages);
    }

    /**
     * 查我的进行中订单
     *
     * ★★ 安全关键 ★★
     *   - 只查**自己的**订单（OrderService 内部按归属过滤）
     *   - 走 toOrderView 脱敏视图（取件码不会明文出现）
     *   - 结果**不交给 AI**，由后端直接组装文案
     */
    private AiAnswer queryMyOrder(String userId) {
        OrderVO vo = orderService.findLatestActive(userId);

        if (vo == null) {
            return AiAnswer.builder()
                    .text("您当前没有进行中的订单。如需查看全部订单，请到「我的订单」。")
                    .provider("local")
                    .degraded(false)
                    .showManualEntry(true)
                    .build();
        }

        String statusText = OrderStatus.labelOf(vo.getStatus());
        String text = String.format("您有 1 个进行中的订单：%s %s，送达地址 %s%s。",
                vo.getOrderNo(), statusText,
                StrUtil.nullToEmpty(vo.getBuildingName()),
                StrUtil.nullToEmpty(vo.getRoomNo()));

        return AiAnswer.builder()
                .text(text)
                .provider("local")
                .degraded(false)
                .showManualEntry(true)
                .orderId(vo.getId())
                .build();
    }

    /** 缓存 AI 回答 */
    private void cacheAnswer(String key, String text) {
        try {
            redis.opsForValue().set(key, text, Duration.ofHours(cacheHours));
        } catch (Exception e) {
            log.debug("AI 结果缓存失败（不影响返回）: {}", e.getMessage());
        }
    }

    private boolean containsAny(String text, List<String> words) {
        return words.stream().anyMatch(text::contains);
    }

    /**
     * 当前可用的 AI 提供方（供健康检查/调试用）
     */
    public String availableProviders() {
        StringBuilder sb = new StringBuilder("local");
        if (ollamaProvider.isAvailable()) {
            sb.append(",ollama");
        }
        if (cozeProvider.isAvailable()) {
            sb.append(",coze");
        }
        return sb.toString();
    }
}
