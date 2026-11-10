package com.zhipao.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Builder;
import lombok.Data;

/**
 * 订单视图（管理后台专用，★ 不脱敏）
 *
 * 与 OrderVO 的区别：
 *   - 取件码始终明文（管理员需要核实）
 *   - 跑腿员昵称不脱敏
 *   - 额外暴露 publisherId / runnerId 原始值
 *
 * ⚠️ 仅限 /api/admin/** 接口使用，由 AdminInterceptor 强制校验管理员身份。
 */
@Data
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class AdminOrderVO {

    private String id;
    private String orderNo;
    private Integer deliveryType;
    private String deliveryTypeText;
    private String status;
    private String statusText;
    private Integer packageSize;
    private String packageSizeText;

    // ---------------- 取件 ----------------
    private String stationId;
    private String stationName;
    /** ★ 明文（管理员可见） */
    private String pickupCode;
    private String shopNo;
    private Double stationLng;
    private Double stationLat;

    // ---------------- 送达 ----------------
    private String buildingId;
    private String buildingName;
    private String roomNo;
    private Double buildingLng;
    private Double buildingLat;

    // ---------------- 金额与时间 ----------------
    private java.math.BigDecimal reward;
    private Integer itemCount;
    private String deadline;
    private String remark;
    private Boolean urgent;
    private Integer distanceMeters;

    // ---------------- 双方 ----------------
    private String publisherId;
    private String publisherName;
    private String publisherPhone;
    private String runnerId;
    private String runnerName;
    private Integer runnerCredit;

    // ---------------- 其他 ----------------
    private String cancelReason;
    private String createTime;
    private String acceptTime;
    private String completeTime;

    /** ★ 距离截止时间还剩多少（仅供后台参考） */
    private Boolean expired;
}
