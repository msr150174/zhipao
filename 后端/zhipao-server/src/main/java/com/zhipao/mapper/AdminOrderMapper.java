package com.zhipao.mapper;

import com.zhipao.entity.Order;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;
import java.util.Map;

/**
 * 后台 - 订单统计查询
 *
 * 这些查询只被 /api/admin/** 使用。
 * 表结构：orders（见 db/V1__init_schema.sql）
 */
@Mapper
public interface AdminOrderMapper {

    // ==================== 列表 ====================

    @Select("""
        <script>
        SELECT * FROM orders
        <where>
          <if test="status != null">AND status = #{status}</if>
          <if test="deliveryType != null">AND delivery_type = #{deliveryType}</if>
          <if test="keyword != null">
            AND (order_no LIKE CONCAT('%', #{keyword}, '%')
                 OR station_name LIKE CONCAT('%', #{keyword}, '%')
                 OR building_name LIKE CONCAT('%', #{keyword}, '%')
                 OR room_no LIKE CONCAT('%', #{keyword}, '%'))
          </if>
          <if test="startDate != null">AND created_at &gt;= CONCAT(#{startDate}, ' 00:00:00')</if>
          <if test="endDate != null">AND created_at &lt;= CONCAT(#{endDate}, ' 23:59:59')</if>
        </where>
        ORDER BY created_at DESC
        LIMIT #{offset}, #{limit}
        </script>
        """)
    List<Order> adminSelectOrders(@Param("status") String status,
                                  @Param("deliveryType") Integer deliveryType,
                                  @Param("keyword") String keyword,
                                  @Param("startDate") String startDate,
                                  @Param("endDate") String endDate,
                                  @Param("offset") int offset,
                                  @Param("limit") int limit);

    @Select("""
        <script>
        SELECT COUNT(*) FROM orders
        <where>
          <if test="status != null">AND status = #{status}</if>
          <if test="deliveryType != null">AND delivery_type = #{deliveryType}</if>
          <if test="keyword != null">
            AND (order_no LIKE CONCAT('%', #{keyword}, '%')
                 OR station_name LIKE CONCAT('%', #{keyword}, '%')
                 OR building_name LIKE CONCAT('%', #{keyword}, '%')
                 OR room_no LIKE CONCAT('%', #{keyword}, '%'))
          </if>
          <if test="startDate != null">AND created_at &gt;= CONCAT(#{startDate}, ' 00:00:00')</if>
          <if test="endDate != null">AND created_at &lt;= CONCAT(#{endDate}, ' 23:59:59')</if>
        </where>
        </script>
        """)
    long adminCountOrders(@Param("status") String status,
                          @Param("deliveryType") Integer deliveryType,
                          @Param("keyword") String keyword,
                          @Param("startDate") String startDate,
                          @Param("endDate") String endDate);

    // ==================== 统计 ====================

    /** 订单总览 */
    @Select("""
        SELECT
          COUNT(*)                                                   AS total,
          SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) AS today_total,
          SUM(CASE WHEN status = 'WAITING_ACCEPT' THEN 1 ELSE 0 END)    AS waiting_accept,
          SUM(CASE WHEN status IN ('ACCEPTED','PICKING','DELIVERING') THEN 1 ELSE 0 END) AS in_progress,
          SUM(CASE WHEN status = 'DELIVERED' THEN 1 ELSE 0 END)         AS delivered,
          SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END)         AS completed,
          SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END)         AS cancelled,
          SUM(CASE WHEN status = 'APPEALING' THEN 1 ELSE 0 END)         AS appealing,
          COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN reward ELSE 0 END), 0) AS total_amount,
          COALESCE(SUM(CASE WHEN status = 'COMPLETED' AND DATE(completed_at) = CURDATE()
                            THEN reward ELSE 0 END), 0)                 AS today_amount
        FROM orders
        """)
    Map<String, Object> adminOrderStats();

    /** 按状态计数 */
    @Select("SELECT COUNT(*) FROM orders WHERE status = #{status}")
    long adminCountByStatus(@Param("status") String status);

    /** 超时未接单 */
    @Select("SELECT COUNT(*) FROM orders WHERE status = 'WAITING_ACCEPT' AND deadline < NOW(3)")
    long adminCountOverdue();

    /** 近 N 天每日订单量 + 成交额 */
    @Select("""
        SELECT
          DATE(created_at) AS day,
          COUNT(*)         AS order_count,
          COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN reward ELSE 0 END), 0) AS amount
        FROM orders
        WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL #{days} DAY)
        GROUP BY DATE(created_at)
        ORDER BY day ASC
        """)
    List<Map<String, Object>> adminDailyTrend(@Param("days") int days);
}
