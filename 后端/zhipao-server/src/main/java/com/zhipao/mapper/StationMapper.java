package com.zhipao.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.zhipao.entity.Station;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

/** 驿站 / 店铺 Mapper */
@Mapper
public interface StationMapper extends BaseMapper<Station> {

    @Select("SELECT * FROM station WHERE status = 1 ORDER BY sort ASC")
    List<Station> selectAllEnabled();

    @Select("""
        <script>
        SELECT * FROM station
         WHERE status = 1
         <if test="keyword != null and keyword != ''">
           AND (name LIKE CONCAT('%', #{keyword}, '%')
                OR campus LIKE CONCAT('%', #{keyword}, '%'))
         </if>
         ORDER BY sort ASC
         LIMIT 50
        </script>
        """)
    List<Station> search(@Param("keyword") String keyword);

    @Select("SELECT * FROM station WHERE name = #{name} LIMIT 1")
    Station selectByName(@Param("name") String name);
}
