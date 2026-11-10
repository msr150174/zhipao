package com.zhipao.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/** 跑腿员入驻申请 */
@Data
@TableName("runner_application")
public class RunnerApplication {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String userId;
    private String realName;
    private String studentNo;
    private String phone;
    private String campus;
    /** 证件照 URL */
    private String idCardImg;
    private String intro;
    /** 0 待审 / 1 通过 / 2 驳回 */
    private Integer status;
    private String rejectReason;
    private String reviewedBy;
    private LocalDateTime reviewedAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
