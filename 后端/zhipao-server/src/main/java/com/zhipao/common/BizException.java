package com.zhipao.common;

import lombok.Getter;

/**
 * 业务异常
 *
 * ★ 约定：业务异常统一返回 HTTP 200 + code != 200
 *   这样前端只需看 code，不用同时处理 HTTP 状态码（与现有 Taro 前端契约一致）
 */
@Getter
public class BizException extends RuntimeException {

    /** 业务码 */
    private final int code;

    public BizException(String message) {
        super(message);
        this.code = 400;
    }

    public BizException(int code, String message) {
        super(message);
        this.code = code;
    }

    // ==================== 常用快捷方法 ====================

    public static BizException badRequest(String msg) {
        return new BizException(400, msg);
    }

    public static BizException unauthorized(String msg) {
        return new BizException(401, msg);
    }

    public static BizException forbidden(String msg) {
        return new BizException(403, msg);
    }

    public static BizException notFound(String msg) {
        return new BizException(404, msg);
    }

    // ==================== 存储过程错误码映射 ====================

    /**
     * 把 MySQL 存储过程抛出的 MESSAGE_TEXT 转成中文提示
     *
     * 存储过程用 SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'XXX' 抛错，
     * Spring 包装成 DataAccessException，message 里含原始文本。
     *
     * 这里做统一映射，避免把英文错误码直接暴露给用户。
     */
    public static BizException fromProcedure(String rawMessage) {
        if (rawMessage == null) {
            return new BizException(500, "操作失败");
        }

        // -------- 接单 --------
        if (rawMessage.contains("ORDER_NOT_FOUND")) {
            return notFound("订单不存在");
        }
        if (rawMessage.contains("CANNOT_ACCEPT_OWN_ORDER")) {
            return badRequest("不能接自己发布的订单");
        }
        if (rawMessage.contains("ALREADY_TAKEN")) {
            return badRequest("该订单已被接单或已失效");
        }

        // -------- 完成 --------
        if (rawMessage.contains("ORDER_NOT_COMPLETABLE")) {
            return badRequest("当前状态不可确认收货");
        }
        if (rawMessage.contains("NOT_PUBLISHER")) {
            return forbidden("只有发布方可以确认收货");
        }
        if (rawMessage.contains("NO_RUNNER")) {
            return badRequest("该订单还没有跑腿员");
        }

        // -------- 提现 --------
        if (rawMessage.contains("INVALID_AMOUNT")) {
            return badRequest("提现金额不合法");
        }
        if (rawMessage.contains("DUPLICATE_APPLY")) {
            return badRequest("该提现申请已提交，请勿重复操作");
        }
        if (rawMessage.contains("INSUFFICIENT_BALANCE")) {
            return badRequest("余额不足");
        }
        if (rawMessage.contains("USER_NOT_FOUND")) {
            return notFound("用户不存在");
        }

        // -------- 评价 --------
        if (rawMessage.contains("INVALID_SCORE")) {
            return badRequest("评分必须是 1~5 星");
        }
        if (rawMessage.contains("ORDER_NOT_COMPLETED")) {
            return badRequest("仅已完成订单可评价");
        }
        if (rawMessage.contains("ALREADY_EVALUATED")) {
            return badRequest("该订单已评价过");
        }

        // -------- 入驻审核 --------
        if (rawMessage.contains("APPLICATION_NOT_FOUND")) {
            return notFound("申请记录不存在");
        }
        if (rawMessage.contains("APPLICATION_NOT_PENDING")) {
            return badRequest("该申请已处理过");
        }
        if (rawMessage.contains("ALREADY_APPLIED")) {
            return badRequest("你已提交申请，请等待审核");
        }

        // 未识别：返回通用提示（不暴露原始英文错误码）
        return new BizException(500, "操作失败，请稍后重试");
    }
}
