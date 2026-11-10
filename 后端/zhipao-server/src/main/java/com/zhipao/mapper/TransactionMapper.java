package com.zhipao.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.zhipao.entity.Transaction;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

/** 交易流水 Mapper */
@Mapper
public interface TransactionMapper extends BaseMapper<Transaction> {

    @Select("""
        SELECT * FROM transactions
         WHERE user_id = #{userId}
         ORDER BY created_at DESC
         LIMIT #{offset}, #{limit}
        """)
    List<Transaction> selectByUser(@Param("userId") String userId,
                                   @Param("offset") int offset,
                                   @Param("limit") int limit);

    @Select("SELECT * FROM transactions WHERE apply_no = #{applyNo} LIMIT 1")
    Transaction selectByApplyNo(@Param("applyNo") String applyNo);
}
