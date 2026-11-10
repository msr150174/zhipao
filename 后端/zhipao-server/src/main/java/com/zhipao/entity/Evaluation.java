package com.zhipao.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/** 订单评价 */
@Data
@TableName("evaluation")
public class Evaluation {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String orderNo;
    private String fromUser;
    private String toUser;
    /** 1 需求方评跑腿 / 2 跑腿评需求方 */
    private Integer role;
    /** 1~5 星 */
    private Integer score;
    private String tags;
    private String comment;
    private Boolean isAuto;
    private Integer status;
    private LocalDateTime createdAt;
}
