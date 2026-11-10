package com.zhipao.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/** 楼栋 */
@Data
@TableName("building")
public class Building {
    @TableId(type = IdType.INPUT)
    private String id;
    private String name;
    private String alias;
    private String campus;
    private BigDecimal lng;
    private BigDecimal lat;
    private Integer geoSource;
    private LocalDateTime geoAt;
    private Integer floors;
    private Integer sort;
    private Integer status;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
