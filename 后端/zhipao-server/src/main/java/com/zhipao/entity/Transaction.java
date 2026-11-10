package com.zhipao.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/** 交易流水 */
@Data
@TableName("transactions")
public class Transaction {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String userId;
    /** INCOME / EXPENSE / WITHDRAW / REFUND */
    private String type;
    private BigDecimal amount;
    private BigDecimal balance;
    private String orderNo;
    private String applyNo;
    private String status;
    private String idempotencyKey;
    private String remark;
    private LocalDateTime createdAt;
}
