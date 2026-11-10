package com.zhipao.interceptor;

import com.zhipao.common.ApiResponse;
import com.zhipao.entity.User;
import com.zhipao.mapper.UserMapper;
import com.zhipao.service.AuthService;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.jsonwebtoken.Claims;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.nio.charset.StandardCharsets;

/**
 * 鉴权拦截器
 *
 * 校验 Authorization: Bearer <token>
 * 通过后把 userId / isAdmin 放进 request attribute，供 Controller 取用。
 *
 * ★ 与原 NestJS 的 AuthGuard 行为一致
 * ★ 另外：账号已注销（status=0）也拒绝
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AuthInterceptor implements HandlerInterceptor {

    private final AuthService authService;
    private final UserMapper userMapper;
    private final ObjectMapper objectMapper;

    public static final String ATTR_USER_ID = "userId";
    public static final String ATTR_IS_ADMIN = "isAdmin";

    @Override
    public boolean preHandle(HttpServletRequest request,
                             HttpServletResponse response,
                             Object handler) throws Exception {

        // 放行 OPTIONS 预检
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }

        String auth = request.getHeader("Authorization");
        Claims claims = authService.parseClaims(auth);

        if (claims == null) {
            writeUnauthorized(response, "请先登录");
            return false;
        }

        String userId = claims.getSubject();

        // ★ 检查账号状态（已注销的账号即使 token 有效也拒绝）
        User user = userMapper.selectById(userId);
        if (user == null) {
            writeUnauthorized(response, "用户不存在");
            return false;
        }
        if (!user.isActive()) {
            writeUnauthorized(response, "账号已注销");
            return false;
        }

        // 注入上下文
        request.setAttribute(ATTR_USER_ID, userId);
        request.setAttribute(ATTR_IS_ADMIN, Boolean.TRUE.equals(user.getIsAdmin()));

        return true;
    }

    private void writeUnauthorized(HttpServletResponse response, String msg) throws Exception {
        response.setStatus(HttpServletResponse.SC_OK);   // ★ 统一 200
        response.setContentType("application/json;charset=UTF-8");
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());

        ApiResponse<Void> body = ApiResponse.fail(401, msg);
        response.getWriter().write(objectMapper.writeValueAsString(body));
    }
}
