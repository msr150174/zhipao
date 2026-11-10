package com.zhipao.common;

import lombok.Data;

/**
 * 统一响应结构
 *
 * ★ 契约锁定：与前端约定的信封模式
 *   { "code": 200, "msg": "ok", "data": ... }
 *
 * 前端解包约定（重要，避免"嵌套 data 陷阱"）：
 *   const res = await Network.request(...)
 *   res.data       → 完整信封 { code, msg, data }
 *   res.data.data  → 真正的业务数据
 */
@Data
public class ApiResponse<T> {

    /** 业务码：200 成功，其它为错误码 */
    private Integer code;

    /** 提示信息 */
    private String msg;

    /** 业务数据 */
    private T data;

    private ApiResponse(Integer code, String msg, T data) {
        this.code = code;
        this.msg = msg;
        this.data = data;
    }

    public static <T> ApiResponse<T> ok(T data) {
        return new ApiResponse<>(200, "ok", data);
    }

    public static <T> ApiResponse<T> ok() {
        return new ApiResponse<>(200, "ok", null);
    }

    public static <T> ApiResponse<T> fail(Integer code, String msg) {
        return new ApiResponse<>(code, msg, null);
    }

    public static <T> ApiResponse<T> fail(String msg) {
        return new ApiResponse<>(500, msg, null);
    }
}
