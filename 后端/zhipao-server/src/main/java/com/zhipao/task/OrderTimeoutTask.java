package com.zhipao.task;

import com.zhipao.entity.Order;
import com.zhipao.service.GeoService;
import com.zhipao.service.NotifyService;
import com.zhipao.service.OrderService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * 定时任务
 *
 * ① 无人接单超时 → 自动取消
 * ② 已接单超时未送达 → 扣信用分
 * ③ 补算缺失的距离（补偿异步失败）
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OrderTimeoutTask {

    private final OrderService orderService;
    private final NotifyService notifyService;
    private final GeoService geoService;

    @Value("${zhipao.business.auto-cancel-minutes:30}")
    private int autoCancelMinutes;

    /**
     * ① 无人接单超时自动取消
     *
     * 每 5 分钟跑一次
     */
    @Scheduled(fixedDelay = 5 * 60 * 1000, initialDelay = 60 * 1000)
    public void autoCancelOverdueWaiting() {
        try {
            List<Order> list = orderService.findOverdueWaiting(autoCancelMinutes, 50);
            if (list.isEmpty()) {
                return;
            }

            log.info("发现 {} 个超时未接单的订单，开始自动取消", list.size());

            for (Order order : list) {
                try {
                    orderService.cancel(order.getPublisherId(), order.getId(),
                            "无人接单，超时自动取消");
                    notifyService.notifyOrderCancelled(order.getId());
                    log.info("订单已自动取消: {}", order.getOrderNo());
                } catch (Exception e) {
                    log.warn("自动取消失败 orderNo={}: {}", order.getOrderNo(), e.getMessage());
                }
            }
        } catch (Exception e) {
            log.error("自动取消任务异常", e);
        }
    }

    /**
     * ② 已接单但超时未送达 → 扣信用分
     *
     * 每 30 分钟跑一次
     */
    @Scheduled(fixedDelay = 30 * 60 * 1000, initialDelay = 2 * 60 * 1000)
    public void penalizeOverdueDelivering() {
        try {
            List<Order> list = orderService.findOverdueDelivering(autoCancelMinutes, 30);
            if (list.isEmpty()) {
                return;
            }

            log.info("发现 {} 个超时未送达的订单", list.size());

            // 注意：具体扣分逻辑需按正好的业务规则实现（每超 30 分钟扣 2 分）
            // 这里只记录日志，避免重复扣分（需要额外标记字段）
            for (Order order : list) {
                log.warn("订单超时未送达: orderNo={} status={} runner={}",
                        order.getOrderNo(), order.getStatus(), order.getRunnerId());
            }
        } catch (Exception e) {
            log.error("超时扣分任务异常", e);
        }
    }

    /**
     * ③ 补算缺失的距离
     *
     * 每 10 分钟跑一次：找出 distance_meters 为 null 且创建于 10 分钟内的订单
     * （异步算距离可能因为重启/异常而丢失）
     */
    @Scheduled(fixedDelay = 10 * 60 * 1000, initialDelay = 3 * 60 * 1000)
    public void backfillDistance() {
        try {
            List<Order> list = orderService.findOverdueWaiting(0, 20);
            int fixed = 0;
            for (Order order : list) {
                if (order.getDistanceMeters() == null) {
                    try {
                        geoService.refreshOrderDistance(order.getId());
                        fixed++;
                    } catch (Exception e) {
                        log.debug("补算距离失败 orderNo={}: {}", order.getOrderNo(), e.getMessage());
                    }
                }
            }
            if (fixed > 0) {
                log.info("补算了 {} 个订单的距离", fixed);
            }
        } catch (Exception e) {
            log.debug("补算距离任务异常: {}", e.getMessage());
        }
    }

    /**
     * ④ 清理过期的登录黑名单（Redis 自动过期，这里仅做日志）
     *
     * 每天凌晨 3 点
     */
    @Scheduled(cron = "0 0 3 * * ?")
    public void dailyCleanup() {
        log.info("每日清理任务执行（Redis 键由 TTL 自动过期）");
    }
}
