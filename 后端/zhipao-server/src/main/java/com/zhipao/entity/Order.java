package com.zhipao.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 订单实体（对应 orders 表）
 *
 * ★ 字段命名：Java 用 camelCase，MyBatis-Plus 自动映射 snake_case
 *   （application.yml 里 map-underscore-to-camel-case: true）
 */
@Data
@TableName("orders")
public class Order {

    @TableId(type = IdType.INPUT)
    private String id;

    /** 订单号 */
    private String orderNo;

    /** 发布方 */
    private String publisherId;

    /** 跑腿员 */
    private String runnerId;

    /** 跑腿员昵称快照 */
    private String runnerName;

    /** 跑腿员信用分快照 */
    private Integer runnerCredit;

    /** 1 取件 / 2 取餐 */
    private Integer deliveryType;

    /** 九态 */
    private String status;

    /** 1 小 / 2 中 / 3 大 */
    private Integer packageSize;

    // ==================== 取件 ====================

    private String stationId;

    private String stationLng;

    private String stationLat;

    private String stationName;

    // ==================== 收件 ====================

    private String buildingId;

    private String buildingLng;

    private String buildingLat;

    private String buildingName;

    private String roomNo;

    // ==================== 内容 ====================

    /** 取件码（可能多个，逗号分隔） */
    private String pickupCode;

    /** 取餐号 */
    private String shopNo;

    private BigDecimal reward;

    private Integer itemCount;

    private LocalDateTime deadline;

    private String remark;

    private Boolean urgent;

    // ==================== 距离 ====================

    private Integer distanceMeters;

    private LocalDateTime distanceUpdatedAt;

    // ==================== 其他 ====================

    private String cancelReason;

    private String appealId;

    /** 乐观锁版本号 */
    private Integer version;

    private LocalDateTime acceptedAt;

    private LocalDateTime completedAt;

    /** 扩展字段（JSON） */
    private String ext;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}
