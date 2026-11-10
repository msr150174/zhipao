package com.zhipao.controller;

import com.zhipao.common.ApiResponse;
import com.zhipao.common.BizException;
import com.zhipao.dto.request.PublishOrderRequest;
import com.zhipao.dto.response.OrderVO;
import com.zhipao.interceptor.AuthInterceptor;
import com.zhipao.service.EvaluateService;
import com.zhipao.service.OrderService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * 订单接口（10 个路由）
 *
 *   GET    /api/orders/available       待接单列表
 *   GET    /api/orders/mine            我的订单
 *   GET    /api/orders/:id             订单详情
 *   POST   /api/orders                 发布订单
 *   POST   /api/orders/:id/accept      接单
 *   POST   /api/orders/:id/advance     推进状态（取件中/配送中/已送达）
 *   POST   /api/orders/:id/complete    确认收货
 *   POST   /api/orders/:id/cancel      取消订单
 *   POST   /api/orders/parse-demand    一句话发布解析
 */
@RestController
@RequestMapping("/orders")
@RequiredArgsConstructor
public class OrderController {

    private final OrderService orderService;
    private final EvaluateService evaluateService;

    private String uid(HttpServletRequest req) {
        return (String) req.getAttribute(AuthInterceptor.ATTR_USER_ID);
    }

    // ==================== 查询 ====================

    /** 待接单列表 */
    @GetMapping("/available")
    public ApiResponse<Map<String, Object>> available(
            HttpServletRequest req,
            @RequestParam(required = false) Integer deliveryType,
            @RequestParam(required = false) String keyword,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int pageSize) {

        return ApiResponse.ok(orderService.listAvailable(
                uid(req), deliveryType, keyword, page, Math.min(pageSize, 50)));
    }

    /** 我的订单 */
    @GetMapping("/mine")
    public ApiResponse<Map<String, Object>> mine(
            HttpServletRequest req,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String role,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int pageSize) {

        return ApiResponse.ok(orderService.listMine(
                uid(req), status, role, page, Math.min(pageSize, 50)));
    }

    /** 订单详情 */
    @GetMapping("/{id}")
    public ApiResponse<OrderVO> detail(HttpServletRequest req, @PathVariable String id) {
        return ApiResponse.ok(orderService.detail(uid(req), id));
    }

    // ==================== 操作 ====================

    /** 发布订单 */
    @PostMapping
    public ApiResponse<OrderVO> publish(HttpServletRequest req,
                                        @Valid @RequestBody PublishOrderRequest body) {
        return ApiResponse.ok(orderService.publish(uid(req), body));
    }

    /** 接单 */
    @PostMapping("/{id}/accept")
    public ApiResponse<OrderVO> accept(HttpServletRequest req, @PathVariable String id) {
        return ApiResponse.ok(orderService.accept(uid(req), id));
    }

    /**
     * 推进状态
     *
     * 请求体：{ "action": "pick" | "deliver" | "arrive" }
     */
    @PostMapping("/{id}/advance")
    public ApiResponse<OrderVO> advance(HttpServletRequest req,
                                        @PathVariable String id,
                                        @RequestBody Map<String, String> body) {
        String action = body == null ? null : body.get("action");
        if (action == null || action.isBlank()) {
            throw BizException.badRequest("缺少 action");
        }
        return ApiResponse.ok(orderService.advance(uid(req), id, action));
    }

    /** 确认收货（结算） */
    @PostMapping("/{id}/complete")
    public ApiResponse<OrderVO> complete(HttpServletRequest req, @PathVariable String id) {
        return ApiResponse.ok(orderService.complete(uid(req), id));
    }

    /**
     * 提交评价
     *
     * 请求体：{ "score": 5, "tags": ["准时"], "comment": "很快" }
     */
    @PostMapping("/{id}/evaluate")
    public ApiResponse<Map<String, Object>> evaluate(HttpServletRequest req,
                                                     @PathVariable String id,
                                                     @RequestBody Map<String, Object> body) {
        Integer score = null;
        if (body.get("score") != null) {
            try {
                score = Integer.valueOf(body.get("score").toString());
            } catch (NumberFormatException e) {
                throw BizException.badRequest("评分格式不正确");
            }
        }

        java.util.List<String> tags = new java.util.ArrayList<>();
        if (body.get("tags") instanceof java.util.List<?> rawTags) {
            for (Object t : rawTags) {
                if (t != null) {
                    tags.add(t.toString());
                }
            }
        }

        String comment = body.get("comment") == null ? null : body.get("comment").toString();

        return ApiResponse.ok(evaluateService.evaluate(uid(req), id, score, tags, comment));
    }

    /** 某订单的评价列表 */
    @GetMapping("/{id}/evaluations")
    public ApiResponse<java.util.List<Map<String, Object>>> evaluations(@PathVariable String id) {
        return ApiResponse.ok(evaluateService.byOrder(id));
    }

    /** 取消订单 */
    @PostMapping("/{id}/cancel")
    public ApiResponse<OrderVO> cancel(HttpServletRequest req,
                                       @PathVariable String id,
                                       @RequestBody(required = false) Map<String, String> body) {
        String reason = body == null ? "" : body.getOrDefault("reason", "");
        return ApiResponse.ok(orderService.cancel(uid(req), id, reason));
    }

    /**
     * 一句话发布解析（AI 辅助）
     *
     * 请求体：{ "text": "明天中午12点前 菜鸟驿站取2个快递送到3号楼203，报酬5元" }
     *
     * ⚠️ 当前为规则解析（与前端 parseDemand 对齐）；后续可接 AI
     */
    @PostMapping("/parse-demand")
    public ApiResponse<Map<String, Object>> parseDemand(@RequestBody Map<String, String> body) {
        String text = body == null ? null : body.get("text");
        if (text == null || text.isBlank()) {
            throw BizException.badRequest("缺少解析文本");
        }
        return ApiResponse.ok(parseDemandText(text));
    }

    /**
     * 规则解析（正则提取）
     *
     * TODO 可替换为 AI 解析（走 AiService）
     */
    private Map<String, Object> parseDemandText(String text) {
        java.util.Map<String, Object> r = new java.util.HashMap<>();
        java.util.List<String> codes = new java.util.ArrayList<>();

        // 提取取件码：形如 8-2-3021 或 A-32
        java.util.regex.Matcher m1 = java.util.regex.Pattern
                .compile("\\b(\\d{1,3}-\\d{1,3}-\\d{3,5})\\b").matcher(text);
        while (m1.find()) {
            codes.add(m1.group(1));
        }
        java.util.regex.Matcher m2 = java.util.regex.Pattern
                .compile("\\b([A-Z]\\d{1,3})\\b").matcher(text);
        while (m2.find()) {
            codes.add(m2.group(1));
        }

        // 提取报酬
        java.util.regex.Matcher mr = java.util.regex.Pattern
                .compile("(\\d+(?:\\.\\d+)?)\\s*元").matcher(text);

        r.put("pickupCodes", codes);
        r.put("reward", mr.find() ? new java.math.BigDecimal(mr.group(1)) : null);
        r.put("rawText", text);
        r.put("parsed", !codes.isEmpty());
        return r;
    }
}
