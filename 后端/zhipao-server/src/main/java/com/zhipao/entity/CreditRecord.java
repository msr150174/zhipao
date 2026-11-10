package com.zhipao.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/** 信用分记录 */
@Data
@TableName("credit_records")
public class CreditRecord {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String userId;
    /** 变动值（可负） */
    private Integer change;
    /** 变动后信用分 */
    private Integer balance;
    private String reason;
    private String reasonCode;
    private String orderNo;
    private LocalDateTime createdAt;
}
