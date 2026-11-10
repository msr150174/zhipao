package com.zhipao.controller;

import com.zhipao.common.ApiResponse;
import com.zhipao.interceptor.AuthInterceptor;
import com.zhipao.service.NotifyService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * 订阅消息接口
 *
 *   POST /api/subscribe/request   上报订阅授权结果
 *
 * 前端调 Taro.requestSubscribeMessage 后，
 * 把每个模板的 accept/reject/ban 结果报给后端。
 */
@RestController
@RequestMapping("/subscribe")
@RequiredArgsConstructor
public class NotifyController {

    private final NotifyService notifyService;

    @PostMapping("/request")
    public ApiResponse<Map<String, Object>> request(HttpServletRequest req,
                                                    @RequestBody Map<String, Object> body) {
        String userId = (String) req.getAttribute(AuthInterceptor.ATTR_USER_ID);

        Object results = body == null ? null : body.get("results");
        if (results instanceof Map<?, ?> m) {
            for (Map.Entry<?, ?> e : m.entrySet()) {
                notifyService.recordSubscribe(
                        userId, e.getKey().toString(),
                        e.getValue() == null ? "" : e.getValue().toString());
            }
        }

        return ApiResponse.ok(Map.of("recorded", true));
    }
}
