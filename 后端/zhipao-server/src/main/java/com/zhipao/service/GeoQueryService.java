package com.zhipao.service;

import cn.hutool.core.util.StrUtil;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.zhipao.common.BizException;
import com.zhipao.entity.Building;
import com.zhipao.entity.Station;
import com.zhipao.mapper.BuildingMapper;
import com.zhipao.mapper.StationMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 地理接口服务
 *
 *   GET /api/geo/stations    驿站/店铺列表
 *   GET /api/geo/buildings   楼栋列表
 *
 * ★ 带 Redis 缓存（1 小时），减少数据库压力
 * ★ 未登录也可访问（发布页需要）
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class GeoQueryService {

    private final StationMapper stationMapper;
    private final BuildingMapper buildingMapper;
    private final StringRedisTemplate redis;

    /** ★ 用于把缓存 JSON 反序列化成 List<Map> */
    private final ObjectMapper objectMapper;

    private static final String CACHE_STATIONS = "geo:stations";
    private static final String CACHE_BUILDINGS = "geo:buildings";

    /** Jackson 泛型类型（复用，避免每次新建） */
    private static final TypeReference<List<Map<String, Object>>> LIST_MAP_TYPE =
            new TypeReference<>() {
            };

    /**
     * 驿站/店铺列表
     */
    public List<Map<String, Object>> stations(String keyword) {
        // 无关键词 → 走缓存
        if (StrUtil.isBlank(keyword)) {
            List<Map<String, Object>> cached = getCachedList(CACHE_STATIONS);
            if (cached != null) {
                return cached;
            }
        }

        List<Station> list = StrUtil.isBlank(keyword)
                ? stationMapper.selectAllEnabled()
                : stationMapper.search(keyword.trim());

        List<Map<String, Object>> result = new ArrayList<>();
        for (Station s : list) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", s.getId());
            m.put("name", s.getName());
            m.put("type", s.getType());
            m.put("campus", s.getCampus());
            m.put("address", s.getAddress());
            m.put("lng", s.getLng());
            m.put("lat", s.getLat());
            m.put("openTime", s.getOpenTime());
            m.put("express", s.getExpress());
            result.add(m);
        }

        if (StrUtil.isBlank(keyword)) {
            cacheList(CACHE_STATIONS, result);
        }
        return result;
    }

    /**
     * 楼栋列表
     */
    public List<Map<String, Object>> buildings(String keyword) {
        if (StrUtil.isBlank(keyword)) {
            List<Map<String, Object>> cached = getCachedList(CACHE_BUILDINGS);
            if (cached != null) {
                return cached;
            }
        }

        List<Building> list = StrUtil.isBlank(keyword)
                ? buildingMapper.selectAllEnabled()
                : buildingMapper.search(keyword.trim());

        List<Map<String, Object>> result = new ArrayList<>();
        for (Building b : list) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", b.getId());
            m.put("name", b.getName());
            m.put("alias", b.getAlias());
            m.put("campus", b.getCampus());
            m.put("lng", b.getLng());
            m.put("lat", b.getLat());
            result.add(m);
        }

        if (StrUtil.isBlank(keyword)) {
            cacheList(CACHE_BUILDINGS, result);
        }
        return result;
    }

    /**
     * 附近驿站（按距离排序）
     *
     * @param lng 用户经度
     * @param lat 用户纬度
     */
    public List<Map<String, Object>> nearbyStations(double lng, double lat, int limit) {
        if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
            throw BizException.badRequest("坐标不合法");
        }

        List<Station> all = stationMapper.selectAllEnabled();
        List<Map<String, Object>> result = new ArrayList<>();

        for (Station s : all) {
            if (s.getLng() == null || s.getLat() == null) {
                continue;
            }
            double d = haversine(lng, lat,
                    s.getLng().doubleValue(), s.getLat().doubleValue());

            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", s.getId());
            m.put("name", s.getName());
            m.put("campus", s.getCampus());
            m.put("lng", s.getLng());
            m.put("lat", s.getLat());
            m.put("distanceMeters", Math.round(d));
            result.add(m);
        }

        result.sort((a, b) -> Long.compare(
                ((Number) a.get("distanceMeters")).longValue(),
                ((Number) b.get("distanceMeters")).longValue()));

        return result.subList(0, Math.min(limit, result.size()));
    }

    // ========================================================================
    // 工具
    // ========================================================================

    private double haversine(double lng1, double lat1, double lng2, double lat2) {
        final double R = 6371000.0;
        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        return 2 * R * Math.asin(Math.sqrt(a));
    }

    private void cacheList(String key, List<Map<String, Object>> list) {
        try {
            String json = cn.hutool.json.JSONUtil.toJsonStr(list);
            redis.opsForValue().set(key, json, Duration.ofHours(1));
        } catch (Exception e) {
            log.debug("缓存写入失败 {}: {}", key, e.getMessage());
        }
    }

    private List<Map<String, Object>> getCachedList(String key) {
        try {
            String json = redis.opsForValue().get(key);
            if (StrUtil.isBlank(json)) {
                return null;
            }
            // ★ 用 Jackson 反序列化（Hutool 没有 toList(String, TypeReference) 这个重载）
            return objectMapper.readValue(json, LIST_MAP_TYPE);
        } catch (Exception e) {
            log.debug("缓存读取失败 {}: {}", key, e.getMessage());
            return null;
        }
    }

    /** 清缓存（驿站/楼栋变更后调用） */
    public void clearCache() {
        redis.delete(CACHE_STATIONS);
        redis.delete(CACHE_BUILDINGS);
    }
}
