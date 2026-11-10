package com.zhipao.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.zhipao.entity.Order;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Options;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.util.List;
import java.util.Map;

/**
 * 订单 Mapper
 *
 * ★ 关键：6 个原子操作全部通过**存储过程**调用
 *   （并发保护在数据库层，不靠应用层加锁）
 *
 * MyBatis 调用存储过程的写法：
 *   {call proc_name(#{param1}, #{param2}, ...)}
 *   OUT 参数用 @Options 或直接在 statementType="CALLABLE" 的 XML 里声明
 */
@Mapper
public interface OrderMapper extends BaseMapper<Order> {

    // ==================== 原子操作（存储过程） ====================

    /**
     * 接单（原子 CAS）
     *
     * ★ 存储过程用 SELECT 返回结果集（而非 OUT 参数），
     *   因为 MyBatis 的 @Param 无法正确绑定 OUT 参数。
     *   返回列：result = 'ACCEPTED'
     *
     * ★ statementType=CALLABLE 是调用存储过程必需的
     */
    @Select("{call accept_order_atomic(#{orderId}, #{runnerId}, #{runnerName}, #{runnerCredit})}")
    @Options(statementType = org.apache.ibatis.mapping.StatementType.CALLABLE)
    Map<String, Object> acceptOrderAtomic(@Param("orderId") String orderId,
                                          @Param("runnerId") String runnerId,
                                          @Param("runnerName") String runnerName,
                                          @Param("runnerCredit") Integer runnerCredit);

    /**
     * 完成订单（确认收货 + 结算）
     *
     * 返回列：result, reward, runner_id
     */
    @Select("{call complete_order_atomic(#{orderId}, #{actorId})}")
    @Options(statementType = org.apache.ibatis.mapping.StatementType.CALLABLE)
    Map<String, Object> completeOrderAtomic(@Param("orderId") String orderId,
                                            @Param("actorId") String actorId);

    /**
     * 评价（写评价 + 信用分联动）
     *
     * 返回列：result, credit_delta
     */
    @Select("{call evaluate_order_atomic(#{orderId}, #{evaluatorId}, #{targetId}, #{score}, #{comment})}")
    @Options(statementType = org.apache.ibatis.mapping.StatementType.CALLABLE)
    Map<String, Object> evaluateOrderAtomic(@Param("orderId") String orderId,
                                            @Param("evaluatorId") String evaluatorId,
                                            @Param("targetId") String targetId,
                                            @Param("score") Integer score,
                                            @Param("comment") String comment);

    // ==================== 查询 ====================

    /**
     * 待接单列表（分页）
     *
     * ★ 只查 WAITING_ACCEPT，且截止时间未过
     */
    @Select("""
        <script>
        SELECT * FROM orders
         WHERE status = 'WAITING_ACCEPT'
           AND delivery_type = #{deliveryType}
           AND deadline &gt; NOW(3)
           <if test="keyword != null and keyword != ''">
             AND (station_name LIKE CONCAT('%', #{keyword}, '%')
                  OR building_name LIKE CONCAT('%', #{keyword}, '%')
                  OR order_no LIKE CONCAT('%', #{keyword}, '%'))
           </if>
         ORDER BY urgent DESC, deadline ASC
         LIMIT #{offset}, #{limit}
        </script>
        """)
    List<Order> selectAvailable(@Param("deliveryType") Integer deliveryType,
                                @Param("keyword") String keyword,
                                @Param("offset") int offset,
                                @Param("limit") int limit);

    /**
     * 我的订单（我是发布方 或 我是跑腿员）
     */
    @Select("""
        <script>
        SELECT * FROM orders
         WHERE (publisher_id = #{userId} OR runner_id = #{userId})
           AND status &lt;&gt; 'CANCELLED'
           <if test="status != null and status != ''">
             AND status = #{status}
           </if>
           <if test="role != null and role == 'publisher'">
             AND publisher_id = #{userId}
           </if>
           <if test="role != null and role == 'runner'">
             AND runner_id = #{userId}
           </if>
         ORDER BY created_at DESC
         LIMIT #{offset}, #{limit}
        </script>
        """)
    List<Order> selectMine(@Param("userId") String userId,
                           @Param("status") String status,
                           @Param("role") String role,
                           @Param("offset") int offset,
                           @Param("limit") int limit);

    /**
     * 我的最新进行中订单（AI 客服查订单用）
     *
     * ★ 安全关键：必须按归属过滤，防止越权查到别人的订单
     */
    @Select("""
        SELECT * FROM orders
         WHERE (publisher_id = #{userId} OR runner_id = #{userId})
           AND status IN ('WAITING_ACCEPT','ACCEPTED','PICKING','DELIVERING','DELIVERED')
         ORDER BY created_at DESC
         LIMIT 1
        """)
    Order selectLatestActive(@Param("userId") String userId);

    /**
     * 超时未接单的订单（定时任务用）
     */
    @Select("""
        SELECT * FROM orders
         WHERE status = 'WAITING_ACCEPT'
           AND deadline < DATE_SUB(NOW(3), INTERVAL #{minutes} MINUTE)
         LIMIT #{limit}
        """)
    List<Order> selectOverdueWaiting(@Param("minutes") int minutes,
                                     @Param("limit") int limit);

    /**
     * 已接单但超时未送达的订单（定时任务用）
     */
    @Select("""
        SELECT * FROM orders
         WHERE status IN ('ACCEPTED','PICKING','DELIVERING')
           AND deadline < DATE_SUB(NOW(3), INTERVAL #{minutes} MINUTE)
         LIMIT #{limit}
        """)
    List<Order> selectOverdueDelivering(@Param("minutes") int minutes,
                                        @Param("limit") int limit);

    /**
     * 回填坐标（geo 服务用）
     *
     * 返回受影响行数，用于判断是否真的更新了
     */
    @Update("""
        UPDATE orders
           SET station_lng = COALESCE(station_lng, #{stationLng}),
               station_lat = COALESCE(station_lat, #{stationLat}),
               building_lng = COALESCE(building_lng, #{buildingLng}),
               building_lat = COALESCE(building_lat, #{buildingLat}),
               updated_at = NOW(3)
         WHERE id = #{orderId}
        """)
    int backfillCoordinates(@Param("orderId") String orderId,
                            @Param("stationLng") String stationLng,
                            @Param("stationLat") String stationLat,
                            @Param("buildingLng") String buildingLng,
                            @Param("buildingLat") String buildingLat);

    /**
     * 更新距离
     */
    @Update("""
        UPDATE orders
           SET distance_meters = #{meters},
               distance_updated_at = NOW(3),
               updated_at = NOW(3)
         WHERE id = #{orderId}
        """)
    int updateDistance(@Param("orderId") String orderId,
                       @Param("meters") Integer meters);

    /**
     * 状态推进（CAS：只有当前状态匹配才更新）
     */
    @Update("""
        UPDATE orders
           SET status = #{nextStatus},
               version = version + 1,
               updated_at = NOW(3)
         WHERE id = #{orderId}
           AND status = #{expectStatus}
           AND runner_id = #{runnerId}
        """)
    int advanceStatus(@Param("orderId") String orderId,
                      @Param("expectStatus") String expectStatus,
                      @Param("nextStatus") String nextStatus,
                      @Param("runnerId") String runnerId);

    /**
     * 取消订单
     */
    @Update("""
        UPDATE orders
           SET status = 'CANCELLED',
               cancel_reason = #{reason},
               version = version + 1,
               updated_at = NOW(3)
         WHERE id = #{orderId}
           AND status IN ('WAITING_ACCEPT','ACCEPTED','PICKING','DELIVERING')
        """)
    int cancelOrder(@Param("orderId") String orderId,
                    @Param("reason") String reason);

    /** 统计待接单数量 */
    @Select("SELECT COUNT(*) FROM orders WHERE status = 'WAITING_ACCEPT' AND delivery_type = #{deliveryType}")
    long countAvailable(@Param("deliveryType") Integer deliveryType);

    /** 统计我的订单数量 */
    @Select("""
        SELECT COUNT(*) FROM orders
         WHERE (publisher_id = #{userId} OR runner_id = #{userId})
           AND status <> 'CANCELLED'
        """)
    long countMine(@Param("userId") String userId);
}
