package com.zhipao.config;

import com.zhipao.interceptor.AdminInterceptor;
import com.zhipao.interceptor.AuthInterceptor;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Web 配置：注册拦截器
 *
 * ★ 路由前缀说明：
 *   application.yml 里配了 server.servlet.context-path: /api
 *   所以这里的路径**不用**再写 /api
 *
 * 拦截规则：
 *   /auth/wx-login、/auth/sms/**、/health、/geo/**  → 放行（无需登录）
 *   其余全部                                          → 需登录
 *   /admin/**                                        → 需管理员
 */
@Configuration
@RequiredArgsConstructor
public class WebConfig implements WebMvcConfigurer {

    private final AuthInterceptor authInterceptor;
    private final AdminInterceptor adminInterceptor;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {

        // ---------- 鉴权拦截器 ----------
        registry.addInterceptor(authInterceptor)
                .addPathPatterns("/**")
                .excludePathPatterns(
                        // 登录相关（无需 token）
                        "/auth/wx-login",
                        "/auth/sms/send",
                        "/auth/sms/login",
                        "/auth/logout",
                        // 健康检查
                        "/health",
                        "/health/**",
                        // 驿站/楼栋（发布页未登录也要能看）
                        "/geo/stations",
                        "/geo/buildings",
                        // 错误页
                        "/error"
                );

        // ---------- 管理员拦截器（只拦 /admin/**） ----------
        registry.addInterceptor(adminInterceptor)
                .addPathPatterns("/admin/**");
    }
}
