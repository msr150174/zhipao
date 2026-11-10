package com.zhipao.controller;

import com.zhipao.common.ApiResponse;
import com.zhipao.interceptor.AuthInterceptor;
import com.zhipao.service.StorageService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.HashMap;
import java.util.Map;

/**
 * 文件上传接口
 *
 *   POST /api/upload?scene=avatar|idcard
 *
 * ★ 未配置对象存储 → 返回占位 URL（不报错）
 */
@RestController
@RequiredArgsConstructor
public class StorageController {

    private final StorageService storageService;

    @PostMapping("/upload")
    public ApiResponse<Map<String, Object>> upload(
            HttpServletRequest req,
            @RequestParam(required = false) String scene,
            @RequestParam("file") MultipartFile file) {

        String userId = (String) req.getAttribute(AuthInterceptor.ATTR_USER_ID);

        StorageService.UploadResult result = storageService.upload(file, userId, scene);

        Map<String, Object> data = new HashMap<>();
        data.put("url", result.url());
        data.put("devMode", result.devMode());
        return ApiResponse.ok(data);
    }
}
