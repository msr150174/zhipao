package com.zhipao.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.zhipao.entity.Evaluation;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

/** 评价 Mapper */
@Mapper
public interface EvaluationMapper extends BaseMapper<Evaluation> {

    /** 某订单收到的评价 */
    @Select("SELECT * FROM evaluation WHERE order_no = #{orderNo} ORDER BY created_at ASC")
    List<Evaluation> selectByOrderNo(@Param("orderNo") String orderNo);

    /** 某用户收到的评价（分页） */
    @Select("""
        SELECT * FROM evaluation
         WHERE to_user = #{userId} AND status = 1
         ORDER BY created_at DESC
         LIMIT #{offset}, #{limit}
        """)
    List<Evaluation> selectByToUser(@Param("userId") String userId,
                                    @Param("offset") int offset,
                                    @Param("limit") int limit);

    /** 某用户收到的平均分 */
    @Select("SELECT COALESCE(AVG(score), 0) FROM evaluation WHERE to_user = #{userId} AND status = 1")
    double avgScore(@Param("userId") String userId);
}
