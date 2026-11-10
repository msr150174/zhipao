package com.zhipao.interceptor;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.zhipao.common.ApiResponse;
import com.zhipao.entity.User;
import com.zhipao.mapper.UserMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.nio.charset.StandardCharsets;

/**
 * 管理员拦截器
 *
 * ★★ 安全红线 ★★
 *   管理接口**必须后端校验**，绝不能只在前端隐藏入口 ——
 *   否则任何人构造请求就能审核入驻申请。
 *
 * 只在 AuthInterceptor 之后执行（此时 userId 已注入）
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AdminInterceptor implements HandlerInterceptor {

    private final UserMapper userMapper;
    private final ObjectMapper objectMapper;

    @Override
    public boolean preHandle(HttpServletRequest request,
                             HttpServletResponse response,
                             Object handler) throws Exception {

        // AuthInterceptor 已校验登录态，这里取 userId
        Object userId = request.getAttribute(AuthInterceptor.ATTR_USER_ID);
        if (userId == null) {
            writeForbidden(response, "请先登录");
            return false;
        }

        User user = userMapper.selectById(userId.toString());
        if (user == null || !Boolean.TRUE.equals(user.getIsAdmin())) {
            log.warn("非管理员访问管理接口: userId={} uri={}", userId, request.getRequestURI());
            writeForbidden(response, "无管理权限");
            return false;
        }

        return true;
    }

    private void writeForbidden(HttpServletResponse response, String msg) throws Exception {
        response.setStatus(HttpServletResponse.SC_OK);   // ★ 统一 200
        response.setContentType("application/json;charset=UTF-8");
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());

        ApiResponse<Void> body = ApiResponse.fail(403, msg);
        response.getWriter().write(objectMapper.writeValueAsString(body));
    }
}
