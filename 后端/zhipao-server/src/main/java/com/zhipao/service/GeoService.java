package com.zhipao.service;

import cn.hutool.core.util.StrUtil;
import cn.hutool.crypto.digest.DigestUtil;
import cn.hutool.http.HttpUtil;
import cn.hutool.json.JSONObject;
import cn.hutool.json.JSONUtil;
import com.zhipao.common.BizException;
import com.zhipao.entity.Building;
import com.zhipao.entity.Station;
import com.zhipao.mapper.BuildingMapper;
import com.zhipao.mapper.OrderMapper;
import com.zhipao.mapper.StationMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;

/**
 * 地理位置服务
 *
 * ★ 两级来源（与原 NestJS 版一致）：
 *   ① 先查 station/building 表里已存的坐标
 *   ② 没有 → 调腾讯地图地理编码实时解析
 *
 * ★★ 关键修复（v10 的问题）★★
 *   原实现解析出的坐标**只用于算距离，没有回填到 orders 表**
 *   → 发布时表里没坐标就永远存 null → 详情页地图不显示
 *   本实现把坐标**一并回写**到 orders（COALESCE，不覆盖已有值）
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class GeoService {

    private final StationMapper stationMapper;
    private final BuildingMapper buildingMapper;
    private final OrderMapper orderMapper;
    private final StringRedisTemplate redis;

    @Value("${zhipao.tencent-map.key:}")
    private String mapKey;

    @Value("${zhipao.tencent-map.geocoder-url:https://apis.map.qq.com/ws/geocoder/v1/}")
    private String geocoderUrl;

    private static final String CACHE_PREFIX = "geo:";

    // ========================================================================
    // 坐标解析（发布订单时用）
    // ========================================================================

    /**
     * 解析驿站坐标
     *
     * @return [lng, lat]，任一为空则返回 [null, null]
     */
    public String[] resolveStationCoord(String stationId, String stationName) {
        // ① 先查表
        if (StrUtil.isNotBlank(stationId)) {
            Station s = stationMapper.selectById(stationId);
            if (s != null && s.getLng() != null && s.getLat() != null) {
                return new String[]{s.getLng().toPlainString(), s.getLat().toPlainString()};
            }
        }
        // ② 再按名称查
        if (StrUtil.isNotBlank(stationName)) {
            Station s = stationMapper.selectByName(stationName);
            if (s != null && s.getLng() != null && s.getLat() != null) {
                return new String[]{s.getLng().toPlainString(), s.getLat().toPlainString()};
            }
        }
        // ③ 地理编码兜底
        double[] pt = geocode(stationName);
        if (pt != null) {
            return new String[]{String.valueOf(pt[0]), String.valueOf(pt[1])};
        }
        return new String[]{null, null};
    }

    /**
     * 解析楼栋坐标
     */
    public String[] resolveBuildingCoord(String buildingId, String buildingName) {
        if (StrUtil.isNotBlank(buildingId)) {
            Building b = buildingMapper.selectById(buildingId);
            if (b != null && b.getLng() != null && b.getLat() != null) {
                return new String[]{b.getLng().toPlainString(), b.getLat().toPlainString()};
            }
        }
        if (StrUtil.isNotBlank(buildingName)) {
            Building b = buildingMapper.selectByName(buildingName);
            if (b != null && b.getLng() != null && b.getLat() != null) {
                return new String[]{b.getLng().toPlainString(), b.getLat().toPlainString()};
            }
        }
        double[] pt = geocode(buildingName);
        if (pt != null) {
            return new String[]{String.valueOf(pt[0]), String.valueOf(pt[1])};
        }
        return new String[]{null, null};
    }

    // ========================================================================
    // 距离计算
    // ========================================================================

    /**
     * 异步刷新订单距离（发布后调用，不阻塞主流程）
     */
    @Async
    public void refreshOrderDistanceAsync(String orderId) {
        try {
            refreshOrderDistance(orderId);
        } catch (Exception e) {
            log.warn("异步算距离失败 orderId={}: {}", orderId, e.getMessage());
        }
    }

    /**
     * 计算并回写距离 + 坐标
     *
     * ★★ 这是"取件没地图"的修复点 ★★
     *   原实现只回写 distance_meters，
     *   本实现同时回写 station_lng/lat 和 building_lng/lat（COALESCE 不覆盖已有值）
     */
    public Integer refreshOrderDistance(String orderId) {
        com.zhipao.entity.Order order = orderMapper.selectById(orderId);
        if (order == null) {
            return null;
        }

        // ---- 解析两点坐标 ----
        String[] st = resolveStationCoord(order.getStationId(), order.getStationName());
        String[] bd = resolveBuildingCoord(order.getBuildingId(), order.getBuildingName());

        // ★ 回写坐标（COALESCE：只在原来为 null 时才写）
        if (st[0] != null || bd[0] != null) {
            orderMapper.backfillCoordinates(orderId, st[0], st[1], bd[0], bd[1]);
        }

        // ---- 算距离 ----
        if (st[0] == null || st[1] == null || bd[0] == null || bd[1] == null) {
            // 拿不到坐标 → 保持 null（前端显示「测量中」），不写假值
            orderMapper.updateDistance(orderId, null);
            return null;
        }

        int meters = (int) Math.round(haversine(
                Double.parseDouble(st[0]), Double.parseDouble(st[1]),
                Double.parseDouble(bd[0]), Double.parseDouble(bd[1])));

        orderMapper.updateDistance(orderId, meters);
        log.debug("订单 {} 距离 {} 米", order.getOrderNo(), meters);
        return meters;
    }

    /**
     * Haversine 球面距离（米）
     */
    private double haversine(double lng1, double lat1, double lng2, double lat2) {
        final double R = 6371000.0;   // 地球半径（米）
        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        return 2 * R * Math.asin(Math.sqrt(a));
    }

    // ========================================================================
    // 腾讯地图地理编码
    // ========================================================================

    /**
     * 地理编码：地址 → 经纬度
     *
     * 带 Redis 缓存（location_cache 表的等价实现），避免重复调用烧配额。
     *
     * @return [lng, lat]，失败返回 null
     */
    public double[] geocode(String address) {
        if (StrUtil.isBlank(address) || StrUtil.isBlank(mapKey)) {
            if (StrUtil.isBlank(mapKey)) {
                log.debug("腾讯地图 Key 未配置，跳过地理编码");
            }
            return null;
        }

        String key = CACHE_PREFIX + DigestUtil.md5Hex(address);

        // ① 查缓存
        try {
            String cached = redis.opsForValue().get(key);
            if (StrUtil.isNotBlank(cached)) {
                String[] parts = cached.split(",");
                return new double[]{Double.parseDouble(parts[0]), Double.parseDouble(parts[1])};
            }
        } catch (Exception e) {
            log.debug("地理编码缓存读取失败: {}", e.getMessage());
        }

        // ② 调腾讯地图
        try {
            Map<String, Object> params = new HashMap<>();
            params.put("address", address);
            params.put("key", mapKey);

            String resp = HttpUtil.get(geocoderUrl, params, 5000);
            JSONObject json = JSONUtil.parseObj(resp);

            Integer status = json.getInt("status");
            if (status == null || status != 0) {
                log.debug("地理编码失败 address={} status={} msg={}",
                        address, status, json.getStr("message"));
                return null;
            }

            JSONObject result = json.getJSONObject("result");
            if (result == null) {
                return null;
            }
            JSONObject location = result.getJSONObject("location");
            if (location == null) {
                return null;
            }

            double lng = location.getDouble("lng");
            double lat = location.getDouble("lat");

            // ③ 写缓存（30 天）
            try {
                redis.opsForValue().set(key, lng + "," + lat, Duration.ofDays(30));
            } catch (Exception e) {
                log.debug("地理编码缓存写入失败: {}", e.getMessage());
            }

            return new double[]{lng, lat};

        } catch (Exception e) {
            log.warn("地理编码异常 address={}: {}", address, e.getMessage());
            return null;
        }
    }

    /**
     * 校验坐标合法性
     */
    public void assertValidCoord(Double lng, Double lat) {
        if (lng == null || lat == null) {
            throw BizException.badRequest("缺少坐标");
        }
        if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
            throw BizException.badRequest("坐标不合法");
        }
        // 0,0 是"几内亚湾"，通常是默认值/解析失败
        if (Math.abs(lng) < 0.0001 && Math.abs(lat) < 0.0001) {
            throw BizException.badRequest("坐标无效（不能是 0,0）");
        }
    }
}
