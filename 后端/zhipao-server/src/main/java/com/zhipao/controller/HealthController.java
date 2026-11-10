package com.zhipao.controller;

import com.zhipao.common.ApiResponse;
import com.zhipao.mapper.BuildingMapper;
import com.zhipao.mapper.OrderMapper;
import com.zhipao.mapper.StationMapper;
import com.zhipao.mapper.UserMapper;
import com.zhipao.service.ai.AiService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.ibatis.session.SqlSessionFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 健康检查
 *
 * ★ 用途：一键验证「后端 ↔ 数据库 ↔ Redis」是否连通
 *
 * 访问：GET /api/health
 *
 * 返回示例：
 * {
 *   "code": 200,
 *   "data": {
 *     "status": "UP",
 *     "mysql": { "connected": true, "database": "xyzp", "version": "8.0.35",
 *                "tables": 10, "stations": 7, "buildings": 8 },
 *     "redis": { "connected": true },
 *     "procedures": 6,
 *     "ai": "local"
 *   }
 * }
 */
@Slf4j
@RestController
@RequestMapping("/health")
@RequiredArgsConstructor
public class HealthController {

    private final DataSource dataSource;
    private final StringRedisTemplate redis;
    private final UserMapper userMapper;
    private final OrderMapper orderMapper;
    private final StationMapper stationMapper;
    private final BuildingMapper buildingMapper;
    private final SqlSessionFactory sqlSessionFactory;
    private final AiService aiService;

    @Value("${spring.datasource.url:}")
    private String datasourceUrl;

    /**
     * 完整健康检查
     */
    @GetMapping
    public ApiResponse<Map<String, Object>> health() {
        Map<String, Object> result = new LinkedHashMap<>();

        // ---------- MySQL ----------
        Map<String, Object> mysql = new LinkedHashMap<>();
        boolean dbOk = false;
        try (Connection conn = dataSource.getConnection()) {
            DatabaseMetaData meta = conn.getMetaData();
            mysql.put("connected", true);
            mysql.put("database", conn.getCatalog());
            mysql.put("version", meta.getDatabaseProductVersion());
            mysql.put("driver", meta.getDriverName());

            // 关键表数量
            mysql.put("tables", countTables(conn));

            // 种子数据
            mysql.put("stations", stationMapper.selectAllEnabled().size());
            mysql.put("buildings", buildingMapper.selectAllEnabled().size());
            mysql.put("users", userMapper.selectCount(null));

            dbOk = true;
        } catch (Exception e) {
            mysql.put("connected", false);
            mysql.put("error", e.getMessage());
            log.error("MySQL 连接失败", e);
        }
        result.put("mysql", mysql);

        // ---------- 存储过程 ----------
        try {
            result.put("procedures", countProcedures());
        } catch (Exception e) {
            result.put("procedures", -1);
        }

        // ---------- Redis ----------
        Map<String, Object> redisInfo = new LinkedHashMap<>();
        try {
            redis.opsForValue().set("health:ping", "ok", java.time.Duration.ofSeconds(10));
            String v = redis.opsForValue().get("health:ping");
            redisInfo.put("connected", "ok".equals(v));
        } catch (Exception e) {
            redisInfo.put("connected", false);
            redisInfo.put("error", e.getMessage());
            log.error("Redis 连接失败", e);
        }
        result.put("redis", redisInfo);

        // ---------- AI ----------
        result.put("ai", aiService.availableProviders());

        // ---------- 总状态 ----------
        boolean redisOk = Boolean.TRUE.equals(redisInfo.get("connected"));
        result.put("status", (dbOk && redisOk) ? "UP" : "DEGRADED");

        // 提示信息
        if (!dbOk) {
            result.put("hint", "MySQL 未连接，请检查 MYSQL_HOST/USER/PASSWORD 与库名（当前默认 xyzp）");
        } else if (!redisOk) {
            result.put("hint", "Redis 未连接，短信验证码与 AI 缓存将不可用");
        }

        return ApiResponse.ok(result);
    }

    /**
     * 极简探针（给负载均衡用）
     */
    @GetMapping("/ping")
    public ApiResponse<String> ping() {
        return ApiResponse.ok("pong");
    }

    // ========================================================================
    // 内部
    // ========================================================================

    /** 统计业务表数量 */
    private int countTables(Connection conn) throws Exception {
        String[] tables = {
                "users", "orders", "credit_records", "transactions",
                "station", "building", "location_cache",
                "evaluation", "runner_application", "health_check"
        };
        int found = 0;
        try (var rs = conn.getMetaData().getTables(conn.getCatalog(), null, "%", new String[]{"TABLE"})) {
            List<String> existing = new ArrayList<>();
            while (rs.next()) {
                existing.add(rs.getString("TABLE_NAME").toLowerCase());
            }
            for (String t : tables) {
                if (existing.contains(t)) {
                    found++;
                }
            }
        }
        return found;
    }

    /** 统计存储过程数量 */
    private int countProcedures() throws Exception {
        try (Connection conn = dataSource.getConnection();
             var ps = conn.prepareStatement(
                     "SELECT COUNT(*) FROM information_schema.ROUTINES " +
                             "WHERE ROUTINE_SCHEMA = DATABASE() AND ROUTINE_TYPE = 'PROCEDURE'");
             var rs = ps.executeQuery()) {
            return rs.next() ? rs.getInt(1) : 0;
        }
    }
}
