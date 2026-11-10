package com.zhipao.controller;

import com.zhipao.common.ApiResponse;
import com.zhipao.common.BizException;
import com.zhipao.dto.response.AdminOrderVO;
import com.zhipao.interceptor.AuthInterceptor;
import com.zhipao.service.AdminManageService;
import com.zhipao.service.AdminService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * 后台管理接口
 *
 * ★★ 全部由 AdminInterceptor 强制校验管理员身份（后端拦截，非前端隐藏）★★
 *
 * ── 跑腿员审核 ──
 *   GET  /api/admin/runner-applications
 *   POST /api/admin/runner-applications/{id}/approve
 *   POST /api/admin/runner-applications/{id}/reject
 *
 * ── 数据看板 ──
 *   GET  /api/admin/dashboard
 *
 * ── 订单管理 ──
 *   GET  /api/admin/orders
 *   GET  /api/admin/orders/{id}
 *   POST /api/admin/orders/{id}/cancel
 *   POST /api/admin/orders/{id}/complete
 *
 * ── 用户管理 ──
 *   GET  /api/admin/users
 *   GET  /api/admin/users/{id}
 *   POST /api/admin/users/{id}/credit
 *   POST /api/admin/users/{id}/freeze
 *   POST /api/admin/users/{id}/unfreeze
 *   POST /api/admin/users/{id}/admin
 *
 * ── 资金管理 ──
 *   GET  /api/admin/transactions
 *   GET  /api/admin/withdrawals
 *   POST /api/admin/withdrawals/{id}/review
 */
@RestController
@RequestMapping("/admin")
@RequiredArgsConstructor
public class AdminController {

    private final AdminService adminService;
    private final AdminManageService adminManageService;

    private String uid(HttpServletRequest req) {
        return (String) req.getAttribute(AuthInterceptor.ATTR_USER_ID);
    }

    // ========================================================================
    // 跑腿员审核（原有）
    // ========================================================================

    @GetMapping("/runner-applications")
    public ApiResponse<Map<String, Object>> listApplications(
            @RequestParam(required = false) Integer status,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize) {
        return ApiResponse.ok(adminService.listApplications(status, page, Math.min(pageSize, 100)));
    }

    @PostMapping("/runner-applications/{id}/approve")
    public ApiResponse<Map<String, Object>> approveRunner(HttpServletRequest req,
                                                          @PathVariable Long id) {
        return ApiResponse.ok(adminService.approve(id, uid(req)));
    }

    @PostMapping("/runner-applications/{id}/reject")
    public ApiResponse<Map<String, Object>> rejectRunner(HttpServletRequest req,
                                                         @PathVariable Long id,
                                                         @RequestBody Map<String, String> body) {
        String reason = body == null ? null : body.get("reason");
        return ApiResponse.ok(adminService.reject(id, uid(req), reason));
    }

    // ========================================================================
    // 数据看板
    // ========================================================================

    /** 汇总数据（订单/用户/待办/趋势） */
    @GetMapping("/dashboard")
    public ApiResponse<Map<String, Object>> dashboard() {
        return ApiResponse.ok(adminManageService.dashboard());
    }

    // ========================================================================
    // 订单管理
    // ========================================================================

    /** 订单列表（多条件筛选） */
    @GetMapping("/orders")
    public ApiResponse<Map<String, Object>> listOrders(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Integer deliveryType,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize) {

        return ApiResponse.ok(adminManageService.listOrders(
                status, deliveryType, keyword, startDate, endDate,
                page, Math.min(pageSize, 100)));
    }

    /** 订单详情（★ 不脱敏，管理员可见取件码） */
    @GetMapping("/orders/{id}")
    public ApiResponse<AdminOrderVO> orderDetail(@PathVariable String id) {
        return ApiResponse.ok(adminManageService.orderDetail(id));
    }

    /** 强制取消订单（body: { "reason": "..." }） */
    @PostMapping("/orders/{id}/cancel")
    public ApiResponse<Map<String, Object>> cancelOrder(
            @PathVariable String id,
            @RequestBody(required = false) Map<String, String> body) {
        String reason = body == null ? null : body.get("reason");
        return ApiResponse.ok(adminManageService.forceCancelOrder(id, reason));
    }

    /** 强制完成订单（仅 DELIVERED 可用） */
    @PostMapping("/orders/{id}/complete")
    public ApiResponse<Map<String, Object>> completeOrder(
            @PathVariable String id,
            @RequestBody(required = false) Map<String, String> body) {
        String reason = body == null ? null : body.get("reason");
        return ApiResponse.ok(adminManageService.forceCompleteOrder(id, reason));
    }

    // ========================================================================
    // 用户管理
    // ========================================================================

    /** 用户列表 */
    @GetMapping("/users")
    public ApiResponse<Map<String, Object>> listUsers(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Integer minCredit,
            @RequestParam(required = false) Integer maxCredit,
            @RequestParam(required = false) Boolean isRunner,
            @RequestParam(required = false) Integer status,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize) {

        return ApiResponse.ok(adminManageService.listUsers(
                keyword, minCredit, maxCredit, isRunner, status,
                page, Math.min(pageSize, 100)));
    }

    /** 用户详情（含订单统计） */
    @GetMapping("/users/{id}")
    public ApiResponse<Map<String, Object>> userDetail(@PathVariable String id) {
        return ApiResponse.ok(adminManageService.userDetail(id));
    }

    /** 调整信用分（body: { "delta": -10, "reason": "虚假发单" }） */
    @PostMapping("/users/{id}/credit")
    public ApiResponse<Map<String, Object>> adjustCredit(@PathVariable String id,
                                                         @RequestBody Map<String, Object> body) {
        Object deltaObj = body == null ? null : body.get("delta");
        if (deltaObj == null) {
            throw BizException.badRequest("缺少 delta");
        }

        int delta;
        try {
            delta = Integer.parseInt(deltaObj.toString());
        } catch (NumberFormatException e) {
            throw BizException.badRequest("delta 必须是整数");
        }

        String reason = body.get("reason") == null ? null : body.get("reason").toString();
        return ApiResponse.ok(adminManageService.adjustCredit(id, delta, reason));
    }

    /** 冻结账号（body: { "reason": "..." }） */
    @PostMapping("/users/{id}/freeze")
    public ApiResponse<Map<String, Object>> freezeUser(
            @PathVariable String id,
            @RequestBody(required = false) Map<String, String> body) {
        String reason = body == null ? null : body.get("reason");
        return ApiResponse.ok(adminManageService.toggleUserStatus(id, true, reason));
    }

    /** 解冻账号 */
    @PostMapping("/users/{id}/unfreeze")
    public ApiResponse<Map<String, Object>> unfreezeUser(@PathVariable String id) {
        return ApiResponse.ok(adminManageService.toggleUserStatus(id, false, null));
    }

    /** 设置/取消管理员（body: { "isAdmin": true }） */
    @PostMapping("/users/{id}/admin")
    public ApiResponse<Map<String, Object>> setAdmin(@PathVariable String id,
                                                     @RequestBody Map<String, Object> body) {
        Object v = body == null ? null : body.get("isAdmin");
        boolean isAdmin = v != null && Boolean.parseBoolean(v.toString());
        return ApiResponse.ok(adminManageService.setAdmin(id, isAdmin));
    }

    // ========================================================================
    // 资金管理
    // ========================================================================

    /** 全局流水 */
    @GetMapping("/transactions")
    public ApiResponse<Map<String, Object>> listTransactions(
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String keyword,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize) {

        return ApiResponse.ok(adminManageService.listTransactions(
                type, keyword, page, Math.min(pageSize, 100)));
    }

    /** 提现申请列表 */
    @GetMapping("/withdrawals")
    public ApiResponse<Map<String, Object>> listWithdrawals(
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize) {

        return ApiResponse.ok(adminManageService.listWithdrawals(
                status, page, Math.min(pageSize, 100)));
    }

    /** 审核提现（body: { "pass": true, "reason": "已转账" }） */
    @PostMapping("/withdrawals/{id}/review")
    public ApiResponse<Map<String, Object>> reviewWithdrawal(@PathVariable Long id,
                                                             @RequestBody Map<String, Object> body) {
        Object passObj = body == null ? null : body.get("pass");
        if (passObj == null) {
            throw BizException.badRequest("缺少 pass 参数");
        }
        boolean pass = Boolean.parseBoolean(passObj.toString());
        String reason = body.get("reason") == null ? null : body.get("reason").toString();

        return ApiResponse.ok(adminManageService.reviewWithdrawal(id, pass, reason));
    }
}
