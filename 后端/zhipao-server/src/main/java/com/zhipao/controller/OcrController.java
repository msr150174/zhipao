package com.zhipao.controller;

import com.zhipao.common.ApiResponse;
import com.zhipao.interceptor.AuthInterceptor;
import com.zhipao.service.OcrService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 取件码识别接口
 *
 *   POST /api/ocr/pickup-code   传图片 URL，返回候选码
 *
 * ★ 未配置 OCR → 返回空数组（前端走手动输入）
 * ★ 识别结果必须让用户点选确认，不能自动填入
 */
@RestController
@RequestMapping("/ocr")
@RequiredArgsConstructor
public class OcrController {

    private final OcrService ocrService;

    @PostMapping("/pickup-code")
    public ApiResponse<Map<String, Object>> pickupCode(HttpServletRequest req,
                                                       @RequestBody Map<String, String> body) {
        String userId = (String) req.getAttribute(AuthInterceptor.ATTR_USER_ID);
        String imageUrl = body == null ? null : body.get("imageUrl");

        List<String> codes = ocrService.extractPickupCodes(imageUrl, userId);

        Map<String, Object> data = new HashMap<>();
        data.put("codes", codes);
        data.put("recognized", !codes.isEmpty());
        data.put("message", codes.isEmpty() ? "没识别到取件码，请手动输入" : null);
        return ApiResponse.ok(data);
    }
}
