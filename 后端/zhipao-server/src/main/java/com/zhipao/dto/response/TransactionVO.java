package com.zhipao.dto.response;

import lombok.Data;

import java.math.BigDecimal;

/** 交易流水视图 */
@Data
public class TransactionVO {
    private Long id;
    private String type;
    /** 中文标签：跑腿收入 / 提现 / 退款 */
    private String typeText;
    private BigDecimal amount;
    private BigDecimal balance;
    private String orderNo;
    private String status;
    private String remark;
    private String createTime;
}
