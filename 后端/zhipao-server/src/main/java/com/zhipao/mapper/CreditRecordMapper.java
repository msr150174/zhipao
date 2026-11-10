package com.zhipao.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.zhipao.entity.CreditRecord;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

/** 信用分记录 Mapper */
@Mapper
public interface CreditRecordMapper extends BaseMapper<CreditRecord> {

    @Select("""
        SELECT * FROM credit_records
         WHERE user_id = #{userId}
         ORDER BY created_at DESC
         LIMIT #{offset}, #{limit}
        """)
    List<CreditRecord> selectByUser(@Param("userId") String userId,
                                    @Param("offset") int offset,
                                    @Param("limit") int limit);
}
