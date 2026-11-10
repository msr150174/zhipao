package com.zhipao.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.zhipao.entity.Building;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

/** 楼栋 Mapper */
@Mapper
public interface BuildingMapper extends BaseMapper<Building> {

    @Select("SELECT * FROM building WHERE status = 1 ORDER BY sort ASC")
    List<Building> selectAllEnabled();

    @Select("""
        <script>
        SELECT * FROM building
         WHERE status = 1
         <if test="keyword != null and keyword != ''">
           AND (name LIKE CONCAT('%', #{keyword}, '%')
                OR alias LIKE CONCAT('%', #{keyword}, '%')
                OR campus LIKE CONCAT('%', #{keyword}, '%'))
         </if>
         ORDER BY sort ASC
         LIMIT 50
        </script>
        """)
    List<Building> search(@Param("keyword") String keyword);

    @Select("SELECT * FROM building WHERE name = #{name} OR alias = #{name} LIMIT 1")
    Building selectByName(@Param("name") String name);
}
