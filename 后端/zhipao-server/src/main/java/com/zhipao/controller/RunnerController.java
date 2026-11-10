package com.zhipao.controller;

import com.zhipao.common.ApiResponse;
import com.zhipao.interceptor.AuthInterceptor;
import com.zhipao.service.RunnerService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * 跑腿员入驻接口
 *
 *   POST /api/runner/apply              提交申请
 *   GET  /api/runner/my-application     查我的申请状态
 */
@RestController
@RequestMapping("/runner")
@RequiredArgsConstructor
public class RunnerController {

    private final RunnerService runnerService;

    private String uid(HttpServletRequest req) {
        return (String) req.getAttribute(AuthInterceptor.ATTR_USER_ID);
    }

    @PostMapping("/apply")
    public ApiResponse<Map<String, Object>> apply(HttpServletRequest req,
                                                  @RequestBody Map<String, String> body) {
        return ApiResponse.ok(runnerService.apply(uid(req), body));
    }

    @GetMapping("/my-application")
    public ApiResponse<Map<String, Object>> myApplication(HttpServletRequest req) {
        return ApiResponse.ok(runnerService.myApplication(uid(req)));
    }
}
