package com.zhipao.dto.response;

import lombok.Data;

import java.math.BigDecimal;

/**
 * 用户视图（对外输出）
 *
 * ★ 脱敏规则：
 *   - 手机号：138****1234
 *   - 学号：2021****1234
 *   - 昵称：不脱敏（是用户自己的信息）
 */
@Data
public class UserVO {

    private String id;

    private String nickname;

    private String avatarUrl;

    /** ★ 已脱敏 */
    private String studentNo;

    /** ★ 已脱敏：138****1234 */
    private String phone;

    /** 信用分 */
    private Integer creditScore;

    /** 可提现余额 */
    private BigDecimal balance;

    /** 累计收入 */
    private BigDecimal income;

    /** 是否认证跑腿员 */
    private Boolean isRunner;

    /** 是否管理员（前端据此决定是否显示审核入口） */
    private Boolean isAdmin;

    /** 是否实名认证 */
    private Boolean realNameVerified;
}
