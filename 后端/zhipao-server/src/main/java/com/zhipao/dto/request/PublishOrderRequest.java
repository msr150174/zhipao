package com.zhipao.dto.request;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 发布订单请求
 *
 * 字段与前端 publish 页提交的一致。
 */
@Data
public class PublishOrderRequest {

    /** 1 取件 / 2 取餐 */
    @NotNull(message = "请选择类型")
    private Integer deliveryType;

    /** 驿站 / 店铺 ID */
    private String stationId;

    /** 驿站 / 店铺名称 */
    @NotBlank(message = "请选择取件地点")
    private String stationName;

    /** 取件码（取件单必填，可能有多个） */
    private List<String> pickupCodes;

    /** 取餐号（取餐单） */
    private String shopNo;

    /** 包裹大小：1 小 / 2 中 / 3 大 */
    @NotNull(message = "请选择包裹大小")
    private Integer packageSize;

    /** 送达楼栋 ID */
    private String buildingId;

    /** 送达楼栋名称 */
    @NotBlank(message = "请选择送达地点")
    private String buildingName;

    /** 房间号 */
    @NotBlank(message = "请填写详细地址")
    private String roomNo;

    /** 报酬 */
    @NotNull(message = "请填写报酬")
    @DecimalMin(value = "0.01", message = "报酬至少 0.01 元")
    @DecimalMax(value = "500", message = "报酬最多 500 元")
    private BigDecimal reward;

    /** 截止时间 */
    @NotNull(message = "请选择截止时间")
    private LocalDateTime deadline;

    /** 备注 */
    private String remark;

    /** 是否加急 */
    private Boolean urgent;
}
