package com.zhipao.service;

import cn.hutool.core.util.StrUtil;
import com.zhipao.common.BizException;
import com.zhipao.entity.Evaluation;
import com.zhipao.entity.Order;
import com.zhipao.mapper.EvaluationMapper;
import com.zhipao.mapper.OrderMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 评价服务
 *
 *   POST /api/orders/{id}/evaluate    提交评价
 *
 * ★ 走存储过程 evaluate_order_atomic：
 *   - 写评价
 *   - 更新被评价人信用分（5星+1 / 2星-1 / 1星-3）
 *   - 写信用分记录
 *   - 幂等（同订单同一人只能评一次）
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class EvaluateService {

    private final OrderMapper orderMapper;
    private final EvaluationMapper evaluationMapper;

    /**
     * 提交评价
     */
    public Map<String, Object> evaluate(String userId, String orderId,
                                        Integer score, List<String> tags, String comment) {
        if (score == null || score < 1 || score > 5) {
            throw BizException.badRequest("评分必须是 1~5 星");
        }

        Order order = orderMapper.selectById(orderId);
        if (order == null) {
            throw BizException.notFound("订单不存在");
        }

        // 判断评价方向
        String targetId;
        if (userId.equals(order.getPublisherId())) {
            targetId = order.getRunnerId();
        } else if (userId.equals(order.getRunnerId())) {
            targetId = order.getPublisherId();
        } else {
            throw BizException.forbidden("你不是该订单的参与方");
        }

        if (StrUtil.isBlank(targetId)) {
            throw BizException.badRequest("该订单还没有跑腿员");
        }

        // 拼接标签 + 内容
        String tagStr = (tags == null || tags.isEmpty())
                ? null : String.join("、", tags.subList(0, Math.min(tags.size(), 5)));
        String full = tagStr == null
                ? StrUtil.nullToEmpty(comment)
                : (StrUtil.isBlank(comment) ? tagStr : tagStr + "。" + comment);
        if (full.length() > 500) {
            full = full.substring(0, 500);
        }

        // ★ 走存储过程（返回结果集：result, credit_delta）
        try {
            Map<String, Object> ret = orderMapper.evaluateOrderAtomic(orderId, userId, targetId, score, full);
            log.debug("评价存储过程返回: {}", ret);
        } catch (Exception e) {
            throw BizException.fromProcedure(e.getMessage());
        }

        log.info("评价提交: orderId={} from={} to={} score={}", orderId, userId, targetId, score);

        Map<String, Object> result = new HashMap<>();
        result.put("ok", true);
        result.put("message", score >= 4 ? "感谢你的好评" : "感谢反馈，我们会改进");
        return result;
    }

    /**
     * 某订单的评价列表
     */
    public List<Map<String, Object>> byOrder(String orderId) {
        Order order = orderMapper.selectById(orderId);
        if (order == null) {
            throw BizException.notFound("订单不存在");
        }

        List<Evaluation> list = evaluationMapper.selectByOrderNo(order.getOrderNo());
        List<Map<String, Object>> result = new ArrayList<>();
        for (Evaluation e : list) {
            Map<String, Object> m = new HashMap<>();
            m.put("id", e.getId());
            m.put("fromUser", e.getFromUser());
            m.put("toUser", e.getToUser());
            m.put("role", e.getRole());
            m.put("score", e.getScore());
            m.put("tags", e.getTags());
            m.put("comment", e.getComment());
            m.put("createTime", e.getCreatedAt() == null ? null : e.getCreatedAt().toString());
            result.add(m);
        }
        return result;
    }

    /**
     * 某用户收到的评价（含平均分）
     */
    public Map<String, Object> byUser(String userId, int page, int pageSize) {
        int offset = (page - 1) * pageSize;
        List<Evaluation> list = evaluationMapper.selectByToUser(userId, offset, pageSize);
        double avg = evaluationMapper.avgScore(userId);

        List<Map<String, Object>> views = new ArrayList<>();
        for (Evaluation e : list) {
            Map<String, Object> m = new HashMap<>();
            m.put("score", e.getScore());
            m.put("tags", e.getTags());
            m.put("comment", e.getComment());
            m.put("createTime", e.getCreatedAt() == null ? null : e.getCreatedAt().toString());
            views.add(m);
        }

        Map<String, Object> result = new HashMap<>();
        result.put("list", views);
        result.put("avgScore", Math.round(avg * 10) / 10.0);
        result.put("count", views.size());
        return result;
    }
}
