package com.zhipao.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/** 驿站 / 店铺 */
@Data
@TableName("station")
public class Station {
    @TableId(type = IdType.INPUT)
    private String id;
    private String name;
    /** 1 驿站 / 2 快递柜 / 3 食堂 / 4 店铺 */
    private Integer type;
    private String campus;
    private String address;
    private BigDecimal lng;
    private BigDecimal lat;
    /** 0 未解析 / 1 人工 / 2 地理编码 */
    private Integer geoSource;
    private LocalDateTime geoAt;
    private String openTime;
    private String express;
    private Integer sort;
    private Integer status;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
