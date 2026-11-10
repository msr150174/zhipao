package com.zhipao.controller;

import com.zhipao.common.ApiResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * 根路径接口
 */
@RestController
public class AppController {

    @GetMapping("/hello")
    public ApiResponse<Map<String, Object>> hello() {
        return ApiResponse.ok(Map.of(
                "service", "智跑校园服务端",
                "version", "1.0.0",
                "stack", "Spring Boot + MySQL + Redis"
        ));
    }
}
