package com.zhipao.controller;

import com.zhipao.common.ApiResponse;
import com.zhipao.common.BizException;
import com.zhipao.dto.response.UserVO;
import com.zhipao.service.AuthService;
import com.zhipao.service.SmsService;
import com.zhipao.service.UserService;
import com.zhipao.interceptor.AuthInterceptor;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

/**
 * 鉴权接口
 *
 * 路由（context-path 已含 /api，所以这里是相对路径）：
 *   POST /api/auth/wx-login     微信登录
 *   POST /api/auth/sms/send     发送验证码
 *   POST /api/auth/sms/login    手机号登录
 *   GET  /api/auth/me           当前用户
 *   POST /api/auth/logout       登出
 */
@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final SmsService smsService;
    private final UserService userService;

    /**
     * 微信登录
     *
     * 请求体：
     *   { "code": "微信登录凭证" }                      真实模式
     *   { "code": "...", "devUser": "a" }              开发模式指定身份
     */
    @PostMapping("/wx-login")
    public ApiResponse<Map<String, Object>> wxLogin(@RequestBody Map<String, String> body) {
        String code = body == null ? null : body.get("code");
        String devUser = body == null ? null : body.get("devUser");
        return ApiResponse.ok(authService.wxLogin(code, devUser));
    }

    /** 发送短信验证码 */
    @PostMapping("/sms/send")
    public ApiResponse<Map<String, Object>> sendSms(@RequestBody Map<String, String> body) {
        String phone = body == null ? null : body.get("phone");
        if (phone == null || phone.isBlank()) {
            throw BizException.badRequest("缺少手机号");
        }

        SmsService.SendResult result = smsService.sendCode(phone.trim());

        Map<String, Object> data = new HashMap<>();
        data.put("sent", true);
        data.put("devMode", result.devMode());
        return ApiResponse.ok(data);
    }

    /** 手机号 + 验证码登录 */
    @PostMapping("/sms/login")
    public ApiResponse<Map<String, Object>> smsLogin(@RequestBody Map<String, String> body) {
        String phone = body == null ? null : body.get("phone");
        String code = body == null ? null : body.get("code");

        if (phone == null || phone.isBlank() || code == null || code.isBlank()) {
            throw BizException.badRequest("缺少手机号或验证码");
        }

        // ★ 验证码校验（一次性，成功后失效）
        if (!smsService.verifyCode(phone.trim(), code.trim())) {
            throw BizException.badRequest("验证码错误或已过期");
        }

        return ApiResponse.ok(authService.loginByPhone(phone.trim()));
    }

    /** 当前用户 */
    @GetMapping("/me")
    public ApiResponse<UserVO> me(HttpServletRequest request) {
        String userId = (String) request.getAttribute(AuthInterceptor.ATTR_USER_ID);
        return ApiResponse.ok(userService.profile(userId));
    }

    /** 登出（把 jti 加黑名单） */
    @PostMapping("/logout")
    public ApiResponse<Void> logout(HttpServletRequest request) {
        String auth = request.getHeader("Authorization");
        authService.logout(auth);
        return ApiResponse.ok();
    }
}
