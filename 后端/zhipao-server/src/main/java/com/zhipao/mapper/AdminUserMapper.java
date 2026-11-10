package com.zhipao.mapper;

import com.zhipao.entity.User;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

/**
 * 后台 - 用户与资金查询
 *
 * 只被 /api/admin/** 使用。
 */
@Mapper
public interface AdminUserMapper {

    // ==================== 用户列表 ====================

    @Select("""
        <script>
        SELECT * FROM users
        <where>
          <if test="keyword != null">
            AND (nickname LIKE CONCAT('%', #{keyword}, '%')
                 OR phone LIKE CONCAT('%', #{keyword}, '%')
                 OR student_no LIKE CONCAT('%', #{keyword}, '%')
                 OR openid LIKE CONCAT('%', #{keyword}, '%'))
          </if>
          <if test="minCredit != null">AND credit_score &gt;= #{minCredit}</if>
          <if test="maxCredit != null">AND credit_score &lt;= #{maxCredit}</if>
          <if test="isRunner != null">AND is_runner = #{isRunner}</if>
          <if test="status != null">AND status = #{status}</if>
        </where>
        ORDER BY created_at DESC
        LIMIT #{offset}, #{limit}
        </script>
        """)
    List<User> adminSelectUsers(@Param("keyword") String keyword,
                                @Param("minCredit") Integer minCredit,
                                @Param("maxCredit") Integer maxCredit,
                                @Param("isRunner") Boolean isRunner,
                                @Param("status") Integer status,
                                @Param("offset") int offset,
                                @Param("limit") int limit);

    @Select("""
        <script>
        SELECT COUNT(*) FROM users
        <where>
          <if test="keyword != null">
            AND (nickname LIKE CONCAT('%', #{keyword}, '%')
                 OR phone LIKE CONCAT('%', #{keyword}, '%')
                 OR student_no LIKE CONCAT('%', #{keyword}, '%')
                 OR openid LIKE CONCAT('%', #{keyword}, '%'))
          </if>
          <if test="minCredit != null">AND credit_score &gt;= #{minCredit}</if>
          <if test="maxCredit != null">AND credit_score &lt;= #{maxCredit}</if>
          <if test="isRunner != null">AND is_runner = #{isRunner}</if>
          <if test="status != null">AND status = #{status}</if>
        </where>
        </script>
        """)
    long adminCountUsers(@Param("keyword") String keyword,
                         @Param("minCredit") Integer minCredit,
                         @Param("maxCredit") Integer maxCredit,
                         @Param("isRunner") Boolean isRunner,
                         @Param("status") Integer status);

    // ==================== 用户统计 ====================

    @Select("""
        SELECT
          COUNT(*)                                                      AS total,
          SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END)  AS today_new,
          SUM(CASE WHEN is_runner = 1 THEN 1 ELSE 0 END)                 AS runners,
          SUM(CASE WHEN status = 0 THEN 1 ELSE 0 END)                    AS frozen,
          SUM(CASE WHEN credit_score < 60 THEN 1 ELSE 0 END)             AS low_credit,
          COALESCE(SUM(balance), 0)                                      AS total_balance
        FROM users
        """)
    Map<String, Object> adminUserStats();

    /** 某用户的订单统计 */
    @Select("""
        SELECT
          COUNT(*)                                                              AS total,
          SUM(CASE WHEN publisher_id = #{userId} THEN 1 ELSE 0 END)              AS published,
          SUM(CASE WHEN runner_id = #{userId} THEN 1 ELSE 0 END)                 AS taken,
          SUM(CASE WHEN runner_id = #{userId} AND status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed,
          COALESCE(SUM(CASE WHEN runner_id = #{userId} AND status = 'COMPLETED'
                            THEN reward ELSE 0 END), 0)                          AS earned
        FROM orders
        WHERE publisher_id = #{userId} OR runner_id = #{userId}
        """)
    Map<String, Object> adminUserOrderStats(@Param("userId") String userId);

    // ==================== 用户操作 ====================

    @Update("UPDATE users SET credit_score = #{score}, updated_at = NOW(3) WHERE id = #{userId}")
    int adminUpdateCredit(@Param("userId") String userId, @Param("score") int score);

    @Update("UPDATE users SET status = #{status}, updated_at = NOW(3) WHERE id = #{userId}")
    int adminUpdateStatus(@Param("userId") String userId, @Param("status") int status);

    @Update("UPDATE users SET is_admin = #{isAdmin}, updated_at = NOW(3) WHERE id = #{userId}")
    int adminUpdateIsAdmin(@Param("userId") String userId, @Param("isAdmin") boolean isAdmin);

    @Insert("""
        INSERT INTO credit_records (user_id, `change`, balance, reason, reason_code, order_no)
        VALUES (#{userId}, #{delta}, #{balance}, #{reason}, #{reasonCode}, #{orderNo})
        """)
    int adminInsertCreditRecord(@Param("userId") String userId,
                                @Param("delta") int delta,
                                @Param("balance") int balance,
                                @Param("reason") String reason,
                                @Param("reasonCode") String reasonCode,
                                @Param("orderNo") String orderNo);

    // ==================== 资金 ====================

    @Select("""
        <script>
        SELECT t.id, t.user_id, t.type, t.amount, t.balance, t.order_no, t.apply_no,
               t.status, t.remark, t.created_at, u.nickname, u.phone
        FROM transactions t
        LEFT JOIN users u ON u.id = t.user_id
        <where>
          <if test="type != null">AND t.type = #{type}</if>
          <if test="keyword != null">
            AND (t.order_no LIKE CONCAT('%', #{keyword}, '%')
                 OR t.apply_no LIKE CONCAT('%', #{keyword}, '%')
                 OR u.nickname LIKE CONCAT('%', #{keyword}, '%')
                 OR u.phone LIKE CONCAT('%', #{keyword}, '%'))
          </if>
        </where>
        ORDER BY t.created_at DESC
        LIMIT #{offset}, #{limit}
        </script>
        """)
    List<Map<String, Object>> adminSelectTransactions(@Param("type") String type,
                                                      @Param("keyword") String keyword,
                                                      @Param("offset") int offset,
                                                      @Param("limit") int limit);

    @Select("""
        <script>
        SELECT COUNT(*) FROM transactions t
        LEFT JOIN users u ON u.id = t.user_id
        <where>
          <if test="type != null">AND t.type = #{type}</if>
          <if test="keyword != null">
            AND (t.order_no LIKE CONCAT('%', #{keyword}, '%')
                 OR t.apply_no LIKE CONCAT('%', #{keyword}, '%')
                 OR u.nickname LIKE CONCAT('%', #{keyword}, '%')
                 OR u.phone LIKE CONCAT('%', #{keyword}, '%'))
          </if>
        </where>
        </script>
        """)
    long adminCountTransactions(@Param("type") String type, @Param("keyword") String keyword);

    // ---------- 提现 ----------

    @Select("""
        <script>
        SELECT t.id, t.user_id, t.amount, t.balance, t.apply_no, t.status,
               t.remark, t.created_at, u.nickname, u.phone, u.balance AS user_balance
        FROM transactions t
        LEFT JOIN users u ON u.id = t.user_id
        WHERE t.type = 'WITHDRAW'
        <if test="status != null">AND t.status = #{status}</if>
        ORDER BY t.created_at DESC
        LIMIT #{offset}, #{limit}
        </script>
        """)
    List<Map<String, Object>> adminSelectWithdrawals(@Param("status") String status,
                                                     @Param("offset") int offset,
                                                     @Param("limit") int limit);

    @Select("""
        <script>
        SELECT COUNT(*) FROM transactions
        WHERE type = 'WITHDRAW'
        <if test="status != null">AND status = #{status}</if>
        </script>
        """)
    long adminCountWithdrawals(@Param("status") String status);

    @Select("SELECT * FROM transactions WHERE id = #{id}")
    Map<String, Object> adminSelectTransactionById(@Param("id") Long id);

    @Update("UPDATE transactions SET status = #{status}, remark = #{remark} WHERE id = #{id}")
    int adminUpdateTxStatus(@Param("id") Long id,
                            @Param("status") String status,
                            @Param("remark") String remark);

    @Update("UPDATE users SET balance = balance + #{amount}, updated_at = NOW(3) WHERE id = #{userId}")
    int adminRefundBalance(@Param("userId") String userId, @Param("amount") BigDecimal amount);

    /** 待处理的提现数 */
    @Select("SELECT COUNT(*) FROM transactions WHERE type = 'WITHDRAW' AND status = 'PENDING'")
    long adminCountPendingWithdrawals();

    /** 待审核的跑腿员申请数 */
    @Select("SELECT COUNT(*) FROM runner_application WHERE status = 0")
    long adminCountPendingRunnerApps();
}
