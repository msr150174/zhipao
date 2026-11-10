package com.zhipao.common;

import cn.hutool.core.util.StrUtil;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * 全局异常处理
 *
 * ★ 核心约定：所有异常都返回 HTTP 200 + 业务码
 *   保持与现有 Taro 前端契约一致（前端只看 code，不看 HTTP 状态码）
 *
 * 另外：数据库存储过程的 SIGNAL 异常会被包装成 DataAccessException，
 * 这里统一用 BizException.fromProcedure() 映射成中文提示。
 */
@Slf4j
@RestControllerAdvice
@RequiredArgsConstructor
public class GlobalExceptionHandler {

    /**
     * 业务异常（可预期）
     */
    @ExceptionHandler(BizException.class)
    public ApiResponse<Void> handleBiz(BizException e, HttpServletRequest req) {
        log.warn("业务异常 {} {}: {}", req.getMethod(), req.getRequestURI(), e.getMessage());
        return ApiResponse.fail(e.getCode(), e.getMessage());
    }

    /**
     * 数据库异常
     *
     * ★ 关键：存储过程用 SIGNAL SQLSTATE '45000' 抛出的业务错误，
     *   Spring 会包装成 DataAccessException，message 里含原始 MESSAGE_TEXT。
     *   这里提取后映射成中文（见 BizException.fromProcedure）。
     */
    @ExceptionHandler(org.springframework.dao.DataAccessException.class)
    public ApiResponse<Void> handleDataAccess(
            org.springframework.dao.DataAccessException e, HttpServletRequest req) {

        String raw = extractProcedureMessage(e);
        log.warn("数据库异常 {} {}: {}", req.getMethod(), req.getRequestURI(), raw);

        BizException mapped = BizException.fromProcedure(raw);
        return ApiResponse.fail(mapped.getCode(), mapped.getMessage());
    }

    /**
     * 参数校验异常（@Valid）
     */
    @ExceptionHandler(org.springframework.web.bind.MethodArgumentNotValidException.class)
    public ApiResponse<Void> handleValidation(
            org.springframework.web.bind.MethodArgumentNotValidException e) {

        String msg = e.getBindingResult().getFieldErrors().stream()
                .findFirst()
                .map(err -> err.getDefaultMessage())
                .orElse("参数校验失败");
        return ApiResponse.fail(400, msg);
    }

    /**
     * 兜底异常（不可预期）
     *
     * ★ 不把堆栈暴露给前端，只给通用提示
     */
    @ExceptionHandler(Exception.class)
    public ApiResponse<Void> handleOther(Exception e, HttpServletRequest req) {
        log.error("未处理异常 {} {}", req.getMethod(), req.getRequestURI(), e);
        return ApiResponse.fail(500, "服务暂时不可用，请稍后重试");
    }

    /**
     * 从 DataAccessException 里提取存储过程抛出的原始消息
     *
     * MySQL 的 SIGNAL MESSAGE_TEXT 会出现在最底层 cause 的 message 中，
     * 形如：「ALREADY_TAKEN」或包含在更长的 SQL 错误描述里。
     */
    private String extractProcedureMessage(Throwable e) {
        Throwable cur = e;
        String last = null;
        while (cur != null) {
            String m = cur.getMessage();
            if (StrUtil.isNotBlank(m)) {
                last = m;
            }
            cur = cur.getCause();
        }
        return last;
    }
}
