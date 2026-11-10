package com.zhipao.controller;

import com.zhipao.common.ApiResponse;
import com.zhipao.common.BizException;
import com.zhipao.dto.response.TransactionVO;
import com.zhipao.dto.response.UserVO;
import com.zhipao.interceptor.AuthInterceptor;
import com.zhipao.service.SmsService;
import com.zhipao.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

/**
 * 用户接口
 *
 *   GET    /api/user/profile           个人信息
 *   PATCH  /api/user/profile           改昵称/头像
 *   POST   /api/user/change-phone      更换手机号
 *   GET    /api/user/credit-records    信用分记录
 *   GET    /api/user/transactions      交易明细
 *   POST   /api/user/withdraw          提现
 *   DELETE /api/user/account           注销账号
 */
@RestController
@RequestMapping("/user")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;
    private final SmsService smsService;

    private String uid(HttpServletRequest req) {
        return (String) req.getAttribute(AuthInterceptor.ATTR_USER_ID);
    }

    /** 个人信息 */
    @GetMapping("/profile")
    public ApiResponse<UserVO> profile(HttpServletRequest req) {
        return ApiResponse.ok(userService.profile(uid(req)));
    }

    /**
     * 修改资料（昵称 / 头像）
     *
     * 请求体：
     *   { "nickname": "小明" } 或 { "avatarUrl": "https://..." }
     */
    @PatchMapping("/profile")
    public ApiResponse<UserVO> updateProfile(HttpServletRequest req,
                                             @RequestBody Map<String, String> body) {
        String userId = uid(req);

        if (body.containsKey("nickname")) {
            return ApiResponse.ok(userService.updateNickname(userId, body.get("nickname")));
        }
        if (body.containsKey("avatarUrl")) {
            return ApiResponse.ok(userService.updateAvatar(userId, body.get("avatarUrl")));
        }
        throw BizException.badRequest("没有可更新的字段");
    }

    /**
     * 更换手机号
     *
     * 请求体：{ "phone": "13800001234", "code": "123456" }
     * ★ 必须先通过短信验证码校验
     */
    @PostMapping("/change-phone")
    public ApiResponse<UserVO> changePhone(HttpServletRequest req,
                                           @RequestBody Map<String, String> body) {
        String userId = uid(req);
        String phone = body.get("phone");
        String code = body.get("code");

        if (phone == null || phone.isBlank() || code == null || code.isBlank()) {
            throw BizException.badRequest("缺少手机号或验证码");
        }
        if (!smsService.verifyCode(phone.trim(), code.trim())) {
            throw BizException.badRequest("验证码错误或已过期");
        }

        return ApiResponse.ok(userService.changePhone(userId, phone.trim()));
    }

    /** 信用分记录 */
    @GetMapping("/credit-records")
    public ApiResponse<List<Map<String, Object>>> creditRecords(
            HttpServletRequest req,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize) {
        return ApiResponse.ok(userService.creditRecords(uid(req), page, Math.min(pageSize, 50)));
    }

    /** 交易明细 */
    @GetMapping("/transactions")
    public ApiResponse<List<TransactionVO>> transactions(
            HttpServletRequest req,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize) {
        return ApiResponse.ok(userService.transactions(uid(req), page, Math.min(pageSize, 50)));
    }

    /**
     * 提现
     *
     * 请求体：{ "amount": 10.00, "idempotencyKey": "uuid" }
     */
    @PostMapping("/withdraw")
    public ApiResponse<Map<String, Object>> withdraw(HttpServletRequest req,
                                                     @RequestBody Map<String, Object> body) {
        String userId = uid(req);

        Object amountObj = body.get("amount");
        if (amountObj == null) {
            throw BizException.badRequest("缺少提现金额");
        }

        BigDecimal amount;
        try {
            amount = new BigDecimal(amountObj.toString());
        } catch (NumberFormatException e) {
            throw BizException.badRequest("提现金额格式不正确");
        }

        String idemKey = body.get("idempotencyKey") == null
                ? null : body.get("idempotencyKey").toString();

        return ApiResponse.ok(userService.withdraw(userId, amount, idemKey));
    }

    /** 注销账号（标记删除） */
    @DeleteMapping("/account")
    public ApiResponse<Void> deactivate(HttpServletRequest req) {
        userService.deactivate(uid(req));
        return ApiResponse.ok();
    }
}
