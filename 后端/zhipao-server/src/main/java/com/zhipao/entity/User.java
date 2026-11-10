package com.zhipao.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 用户实体（对应 users 表）
 */
@Data
@TableName("users")
public class User {

    @TableId(type = IdType.INPUT)
    private String id;

    /** 微信 openid */
    private String openid;

    private String nickname;

    private String avatarUrl;

    private String studentNo;

    private String phone;

    /** 信用分（初始 60，满分 100） */
    private Integer creditScore;

    /** 可提现余额 */
    private BigDecimal balance;

    /** 累计收入 */
    private BigDecimal income;

    /** 是否已认证跑腿员 */
    private Boolean isRunner;

    /** 是否管理员 */
    private Boolean isAdmin;

    /** 是否实名认证 */
    private Boolean realNameVerified;

    /** 1 正常 / 0 已注销 */
    private Integer status;

    private LocalDateTime deletedAt;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    // ==================== 便捷判断 ====================

    /** 是否可接单（信用分 ≥ 60） */
    public boolean canAcceptOrder() {
        return creditScore != null && creditScore >= 60;
    }

    /** 是否可发单（信用分 ≥ 50） */
    public boolean canPublishOrder() {
        return creditScore != null && creditScore >= 50;
    }

    /** 账号是否正常（未注销） */
    public boolean isActive() {
        return status == null || status == 1;
    }
}
