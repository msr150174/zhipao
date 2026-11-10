package com.zhipao;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * 智跑校园 · 服务端入口
 *
 * 技术栈：Spring Boot 3.2 + MyBatis-Plus + MySQL 8 + Redis 7
 *
 * ★ 与前端契约（保持与 Taro 版完全一致）：
 *   - 全局路由前缀 /api
 *   - 统一响应 { code, msg, data }
 *   - 所有响应 HTTP 200（业务码在 body 里）
 */
@SpringBootApplication
@MapperScan("com.zhipao.mapper")
@EnableAsync          // 异步算距离、发推送
@EnableScheduling     // 定时任务（超时订单自动取消）
public class ZhipaoApplication {

    public static void main(String[] args) {
        SpringApplication.run(ZhipaoApplication.class, args);
    }
}
