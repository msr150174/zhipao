package com.zhipao.service.ai;

import lombok.extern.slf4j.Slf4j;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.regex.Pattern;

/**
 * 本地规则 AI（保底）
 *
 * ★ 作用：即使 Ollama 和 Coze 都不可用，客服也不失效
 *   这是从原 NestJS 的 ai.service.ts 的 answerRule() 原样搬过来的。
 *
 * 覆盖 7 类高频问题：
 *   收费 / 信用分 / 取件码 / 超时 / 取消 / 提现 / 怎么取
 */
@Slf4j
@Component
@Order(3)
public class LocalRuleAiProvider implements AiProvider {

    /**
     * 规则表：正则 → 回答
     *
     * ★ 顺序很重要：越具体的规则要放在越前面
     *   （如「取件码填错了」必须在「取件码」之前）
     */
    private static final List<Rule> RULES = List.of(
            // ---------- 问候 / 自我介绍（放最前，避免被其他规则截胡）----------
            new Rule(Pattern.compile("^(你好|您好|hi|hello|在吗|在么|哈喽)[!！。~～\\s]*$",
                            Pattern.CASE_INSENSITIVE),
                    "你好！我是智跑校园的智能助手 🏃\n"
                            + "可以帮你：查订单进度、了解信用分与收费规则、解答发布与接单问题。\n"
                            + "涉及退款、账号安全的问题会转人工客服。"),

            new Rule(Pattern.compile("你是谁|你叫什么|什么助手|你能做什么|你会什么|能帮我做什么"),
                    "我是智跑校园的智能助手，主要帮你解答：\n"
                            + "· 订单进度查询（直接说「我的订单到哪了」）\n"
                            + "· 信用分、收费、超时、取消等规则\n"
                            + "· 发布需求、接单、提现的操作问题\n"
                            + "复杂或涉及资金安全的问题，我会帮你转人工客服。"),

            // ---------- 取件码相关（★ 具体问题在前）----------
            new Rule(Pattern.compile("取件码.*(错|不对|填错|改|修改)|改.*取件码|填错.*取件码"),
                    "取件码填错了：待接单状态下可取消订单后重新发布；"
                            + "已接单请联系接单的跑腿员说明情况，或转人工客服协助修改。"),

            new Rule(Pattern.compile("取件码"),
                    "取件码请在本订单详情页查看。为保障取件安全，智能助手不展示取件码。"),

            // ---------- 收费 / 信用 / 规则 ----------
            new Rule(Pattern.compile("收费|费用|价格|报酬|怎么算|多少钱"),
                    "跑腿报酬由发布方自定义；平台按信用分和服务保障托管资金，交易完成后结算给跑腿员。"),

            new Rule(Pattern.compile("信用|诚信分"),
                    "信用分满分 100 分：实名认证 +20、完成一单(跑腿方)+2、收到好评+1、连续 7 天无违规 +3；"
                            + "超时未送达 -5、接单后取消 -10、虚假发单 -20、被有效申诉 -15、收到差评 -3。"
                            + "低于 60 禁止接单，低于 50 禁止发单，低于 40 冻结 7 天。"),

            new Rule(Pattern.compile("超时"),
                    "无人接单超过截止时间系统会自动取消并全额退款；接单后超时未送达会按每超 30 分钟追加扣信用分 2 分。"),

            new Rule(Pattern.compile("取消"),
                    "待接单状态下发布方可取消并全额退款；接单后取消会被判定为违规并扣除信用分 10 分。"),

            new Rule(Pattern.compile("提现"),
                    "完成跑腿订单的收入会进入可提现余额。提现申请提交后进入待处理队列，由平台统一处理。"),

            new Rule(Pattern.compile("拒收|怎么取|拿快递|怎么拿"),
                    "请先到我的订单详情查看取件码，按提示到对应驿站取件。"),

            new Rule(Pattern.compile("人工|客服|联系平台"),
                    "人工客服工作时间 9:00–21:00。您可以在「我的 → 联系客服」发起咨询，"
                            + "涉及资金与账号安全的问题我们会优先处理。"),

            new Rule(Pattern.compile("怎么发布|如何发布|怎么下单|发布需求"),
                    "在首页点右下角「＋」进入发布页：选择取快递/取外卖 → 填取件地点与取件码 → "
                            + "填送达楼栋与房间号 → 设置报酬和时间 → 提交。"),

            new Rule(Pattern.compile("怎么接单|如何接单|想赚|跑腿费"),
                    "首页看到的待接订单点进去，确认顺路后点「立即接单」。"
                            + "接单需要信用分 ≥ 60；按时送达可 +2 信用分并获得报酬。"),

            new Rule(Pattern.compile("怎么成为跑腿|入驻|实名"),
                    "在「我的 → 成为跑腿员」提交真实姓名、学号和手机号，"
                            + "审核通过后即可接单。要求信用分不低于 60。"),

            new Rule(Pattern.compile("余额|收入|钱不到|没收到钱"),
                    "订单完成后报酬会进入可提现余额。若长时间未到账，"
                            + "请到「钱包」查看明细，或联系我们人工客服核实。"),

            new Rule(Pattern.compile("评价|评分|差评"),
                    "订单完成后双方都可以评价，5 星好评 +1 信用分，"
                            + "1-2 星会扣减信用分。评价提交后不可修改。"),

            new Rule(Pattern.compile("隐私|信息泄露|安全吗"),
                    "我们仅收集完成代取所必需的信息。取件码只对订单双方可见，"
                            + "手机号、学号在展示时均已脱敏。详见「隐私政策」。"),

            new Rule(Pattern.compile("退款|退钱"),
                    "待接单状态取消可全额退款；订单完成后如有争议，"
                            + "请联系人工客服并提供订单号，我们会核实处理。"),

            new Rule(Pattern.compile("投诉|举报|态度不好|迟到"),
                    "非常抱歉给你带来不好的体验。请提供订单号与具体情况，"
                            + "我们会核实并对违规方扣减信用分。也可直接转人工客服。"),

            // ---------- 常见业务问题 ----------
            new Rule(Pattern.compile("配送范围|哪些地方|能送到哪|覆盖|哪些学校|支持.*学校"),
                    "当前服务范围为所在校区内的宿舍楼与教学楼。"
                            + "发布时可以从楼栋列表中选择，也可以在地图上手动选点。"),

            new Rule(Pattern.compile("接几单|一次.*单|同时.*单|上限"),
                    "目前没有硬性接单数量上限，但请量力而行 —— "
                            + "超时未送达会按每超 30 分钟扣信用分 2 分，接单后取消扣 10 分。"),

            new Rule(Pattern.compile("加急|急|快点|催"),
                    "发布时可以勾选「加急」，加急订单会排在列表前面优先展示给跑腿员，"
                            + "但建议同时适当提高报酬，接单会更快。"),

            new Rule(Pattern.compile("改地址|修改地址|地址写错|换地址"),
                    "待接单状态下可取消后重新发布；已接单请直接联系跑腿员沟通，"
                            + "或转人工客服协助处理。"),

            new Rule(Pattern.compile("发票|开票|报销"),
                    "目前平台暂不支持开具发票，如有特殊需求请联系人工客服。"),

            new Rule(Pattern.compile("优惠|折扣|红包|便宜|免费"),
                    "目前暂未推出优惠活动，跑腿报酬由发布方自定义，"
                            + "你可以根据距离和件数自主定价。"),

            new Rule(Pattern.compile("时间|多久|几点|晚上|半夜|营业"),
                    "平台 7×24 小时可用。但驿站和店铺有各自营业时间，"
                            + "发布时请留意截止时间设置，避免错过取件时段。"),

            new Rule(Pattern.compile("靠谱|安全|信任|保障|押金"),
                    "平台通过信用分体系保障交易：初始 60 分，按时完成 +2，"
                            + "违规最高扣 20 分，低于 60 分无法接单。资金由平台托管，"
                            + "确认收货后才结算给跑腿员。"),

            new Rule(Pattern.compile("注册|登录|怎么用|新手|第一次"),
                    "微信一键登录即可使用。发布需求：首页点「＋」；"
                            + "接单赚钱：先在「我的 → 成为跑腿员」提交申请，审核通过后即可接单。"),

            new Rule(Pattern.compile("注销|删除账号|不用了|退网"),
                    "在「我的 → 账户设置 → 注销账号」可以注销。"
                            + "注销前需处理完进行中的订单并提现余额，"
                            + "注销后订单与资金记录会依法保留存档。")
    );

    @Override
    public String name() {
        return "local";
    }

    /** ★ 规则库永远可用（不需配置） */
    @Override
    public boolean isAvailable() {
        return true;
    }

    @Override
    public AiAnswer chat(String userId, List<AiMessage> messages) {
        String text = lastUserText(messages);
        if (text.isEmpty()) {
            return fallback("请描述您想咨询的问题。");
        }

        for (Rule rule : RULES) {
            if (rule.pattern().matcher(text).find()) {
                return AiAnswer.builder()
                        .text(rule.answer())
                        .provider("local")
                        .degraded(false)
                        .showManualEntry(false)
                        .build();
            }
        }

        return fallback("智能助手暂时无法回答该问题，您可以到「我的订单」查看订单进度，或转人工客服。");
    }

    /** 取最后一条用户消息 */
    static String lastUserText(List<AiMessage> messages) {
        if (messages == null || messages.isEmpty()) {
            return "";
        }
        for (int i = messages.size() - 1; i >= 0; i--) {
            AiMessage m = messages.get(i);
            if ("user".equals(m.getRole()) && m.getContent() != null) {
                return m.getContent().trim();
            }
        }
        return "";
    }

    private AiAnswer fallback(String text) {
        return AiAnswer.builder()
                .text(text)
                .provider("fallback")
                .degraded(true)
                .showManualEntry(true)
                .build();
    }

    /** 规则定义 */
    private record Rule(Pattern pattern, String answer) {
    }
}
