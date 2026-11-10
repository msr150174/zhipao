package com.zhipao.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.zhipao.entity.RunnerApplication;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Options;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;
import java.util.Map;

/** 跑腿员入驻 Mapper */
@Mapper
public interface RunnerApplicationMapper extends BaseMapper<RunnerApplication> {

    // ==================== 原子操作（存储过程） ====================

    /**
     * 审核通过（同一事务内更新申请表 + 标记 users.is_runner = 1）
     *
     * ★ 存储过程用 SELECT 返回结果集（MyBatis 无法绑定 OUT 参数）
     * 返回列：result, user_id
     */
    @Select("{call approve_runner_atomic(#{appId}, #{reviewerId})}")
    @Options(statementType = org.apache.ibatis.mapping.StatementType.CALLABLE)
    Map<String, Object> approveRunnerAtomic(@Param("appId") Long appId,
                                            @Param("reviewerId") String reviewerId);

    /**
     * 审核驳回
     *
     * 返回列：result
     */
    @Select("{call reject_runner_atomic(#{appId}, #{reviewerId}, #{reason})}")
    @Options(statementType = org.apache.ibatis.mapping.StatementType.CALLABLE)
    Map<String, Object> rejectRunnerAtomic(@Param("appId") Long appId,
                                           @Param("reviewerId") String reviewerId,
                                           @Param("reason") String reason);

    // ==================== 查询 ====================

    /** 待审申请（用户维度，用于幂等判断） */
    @Select("SELECT * FROM runner_application WHERE user_id = #{userId} AND status = 0 LIMIT 1")
    RunnerApplication selectPendingByUser(@Param("userId") String userId);

    /** 最近一条申请（用户维度） */
    @Select("SELECT * FROM runner_application WHERE user_id = #{userId} ORDER BY created_at DESC LIMIT 1")
    RunnerApplication selectLatestByUser(@Param("userId") String userId);

    /** 按状态查列表（管理端） */
    @Select("""
        <script>
        SELECT * FROM runner_application
        <where>
          <if test="status != null">AND status = #{status}</if>
        </where>
         ORDER BY created_at DESC
         LIMIT #{offset}, #{limit}
        </script>
        """)
    List<RunnerApplication> selectByStatus(@Param("status") Integer status,
                                           @Param("offset") int offset,
                                           @Param("limit") int limit);

    /** 按状态统计 */
    @Select("""
        <script>
        SELECT COUNT(*) FROM runner_application
        <where>
          <if test="status != null">AND status = #{status}</if>
        </where>
        </script>
        """)
    long countByStatus(@Param("status") Integer status);
}
