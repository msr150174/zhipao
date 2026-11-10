package com.zhipao.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Builder;
import lombok.Data;

/**
 * 订单视图（对外输出）
 *
 * ★ 安全关键：这是**唯一**允许对外输出订单的通道
 *   所有脱敏逻辑集中在 OrderService.toOrderView() 里，
 *   禁止在别处手拼订单字符串输出（原 NestJS 版就因手拼导致过越权泄露）。
 *
 * 字段命名保持 camelCase，与前端 Order 类型一一对应。
 */
@Data
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class OrderVO {

    private String id;

    /** 订单号 */
    private String orderNo;

    /** 1 取件 / 2 取餐 */
    private Integer deliveryType;

    /** 九态之一 */
    private String status;

    /** 包裹大小：1 小 / 2 中 / 3 大 */
    private Integer packageSize;

    // ==================== 取件信息 ====================

    private String stationName;

    private String stationId;

    /**
     * ★ 取件码 —— 脱敏规则：
     *   相关方（发布方/跑腿员）→ 明文
     *   其他人 → [已隐藏]
     */
    private String pickupCode;

    /** 取餐号（仅取餐订单） */
    private String shopNo;

    /** 驿站坐标（详情页地图用） */
    private Double stationLng;

    private Double stationLat;

    // ==================== 收件信息 ====================

    private String buildingName;

    private String buildingId;

    private String roomNo;

    /** 楼栋坐标（详情页地图用） */
    private Double buildingLng;

    private Double buildingLat;

    // ==================== 金额与时间 ====================

    /** 报酬（BigDecimal → JSON 数字） */
    private java.math.BigDecimal reward;

    private Integer itemCount;

    private String deadline;

    /** 后端预格式化的截止展示（倒计时/绝对时间） */
    private String deadlineText;

    private String remark;

    private Boolean urgent;

    // ==================== 距离 ====================

    /**
     * 距离（米）
     * null 表示未算出 → 前端显示「测量中」
     */
    private Integer distanceMeters;

    // ==================== 跑腿员（已脱敏） ====================

    private String publisherId;

    private String runnerId;

    /** ★ 跑腿员昵称已脱敏（张*明） */
    private String runnerName;

    private Integer runnerCredit;

    // ==================== 其他 ====================

    private String cancelReason;

    private String createTime;

    private String acceptTime;

    private String completeTime;
}
