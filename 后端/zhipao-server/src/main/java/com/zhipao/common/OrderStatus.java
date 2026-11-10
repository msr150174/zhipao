package com.zhipao.common;

import lombok.Getter;

/**
 * 订单九态状态机（★ 契约锁定，禁止扩展）
 *
 * 与前端 Taro 的 order-status.ts 完全一致：
 *   CREATED / WAITING_ACCEPT / ACCEPTED / PICKING / DELIVERING
 *   / DELIVERED / COMPLETED / CANCELLED / APPEALING
 *
 * 迁移注意：数据库存的是**字符串**（VARCHAR(24)），不是序号，
 * 这样状态新增/调整不影响历史数据可读性。
 */
@Getter
public enum OrderStatus {

    /** 已创建（占位，当前流程不落库） */
    CREATED("已创建"),

    /** 待接单 */
    WAITING_ACCEPT("待接单"),

    /** 已接单 */
    ACCEPTED("已接单"),

    /** 取件中 */
    PICKING("取件中"),

    /** 配送中 */
    DELIVERING("配送中"),

    /** 已送达（待确认） */
    DELIVERED("已送达待确认"),

    /** 已完成 */
    COMPLETED("已完成"),

    /** 已取消 */
    CANCELLED("已取消"),

    /** 申诉中 */
    APPEALING("申诉中");

    /** 中文标签（给前端/AI 用） */
    private final String label;

    OrderStatus(String label) {
        this.label = label;
    }

    /** 字符串 → 枚举（不存在返回 null，不抛异常） */
    public static OrderStatus of(String code) {
        if (code == null) {
            return null;
        }
        for (OrderStatus s : values()) {
            if (s.name().equals(code)) {
                return s;
            }
        }
        return null;
    }

    /** 中文标签，未知状态返回「处理中」 */
    public static String labelOf(String code) {
        OrderStatus s = of(code);
        return s == null ? "处理中" : s.getLabel();
    }

    // ==================== 状态流转规则 ====================

    /**
     * 是否可接单
     * 只有「待接单」才能被接
     */
    public static boolean canAccept(String current) {
        return WAITING_ACCEPT.name().equals(current);
    }

    /**
     * 是否可取消
     * - 待接单：发布方可取消（全额退款）
     * - 已接单/取件中/配送中：可取消（会扣信用分，由业务层处理）
     * - 终态（已完成/已取消）：不可
     */
    public static boolean canCancel(String current) {
        return WAITING_ACCEPT.name().equals(current)
            || ACCEPTED.name().equals(current)
            || PICKING.name().equals(current)
            || DELIVERING.name().equals(current);
    }

    /**
     * 是否终态（不再变化）
     * ★ 前端轮询判断依据：终态不再轮询，省电
     */
    public static boolean isFinal(String current) {
        return COMPLETED.name().equals(current)
            || CANCELLED.name().equals(current);
    }

    /**
     * 是否进行中（用于轮询 / 查"我的进行中订单"）
     */
    public static boolean isActive(String current) {
        return WAITING_ACCEPT.name().equals(current)
            || ACCEPTED.name().equals(current)
            || PICKING.name().equals(current)
            || DELIVERING.name().equals(current)
            || DELIVERED.name().equals(current);
    }

    /**
     * 推进动作 → 目标状态
     *
     * 前端调用 POST /api/orders/:id/advance 时传 action：
     *   pick     → 取件中
     *   deliver  → 配送中
     *   arrive   → 已送达
     *
     * @return 目标状态；非法流转返回 null
     */
    public static OrderStatus nextOf(String current, String action) {
        if (ACCEPTED.name().equals(current) && "pick".equals(action)) {
            return PICKING;
        }
        if (PICKING.name().equals(current) && "deliver".equals(action)) {
            return DELIVERING;
        }
        if (DELIVERING.name().equals(current) && "arrive".equals(action)) {
            return DELIVERED;
        }
        return null;
    }
}
