package com.zhipao.controller;

import com.zhipao.common.ApiResponse;
import com.zhipao.common.BizException;
import com.zhipao.service.GeoQueryService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 地理接口（无需登录，发布页要用）
 *
 *   GET /api/geo/stations          驿站/店铺列表
 *   GET /api/geo/buildings         楼栋列表
 *   GET /api/geo/nearby-stations   附近驿站（按距离排序）
 */
@RestController
@RequestMapping("/geo")
@RequiredArgsConstructor
public class GeoController {

    private final GeoQueryService geoQueryService;

    @GetMapping("/stations")
    public ApiResponse<List<Map<String, Object>>> stations(
            @RequestParam(required = false) String keyword) {
        return ApiResponse.ok(geoQueryService.stations(keyword));
    }

    @GetMapping("/buildings")
    public ApiResponse<List<Map<String, Object>>> buildings(
            @RequestParam(required = false) String keyword) {
        return ApiResponse.ok(geoQueryService.buildings(keyword));
    }

    @GetMapping("/nearby-stations")
    public ApiResponse<List<Map<String, Object>>> nearbyStations(
            @RequestParam String lng,
            @RequestParam String lat,
            @RequestParam(defaultValue = "10") int limit) {
        try {
            double lngN = Double.parseDouble(lng);
            double latN = Double.parseDouble(lat);
            return ApiResponse.ok(geoQueryService.nearbyStations(lngN, latN, Math.min(limit, 50)));
        } catch (NumberFormatException e) {
            throw BizException.badRequest("坐标不合法");
        }
    }
}
