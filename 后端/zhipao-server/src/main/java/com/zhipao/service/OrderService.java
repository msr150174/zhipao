package com.zhipao.service;

import cn.hutool.core.util.StrUtil;
import com.zhipao.common.BizException;
import com.zhipao.common.MaskUtil;
import com.zhipao.common.OrderNoGenerator;
import com.zhipao.common.OrderStatus;
import com.zhipao.dto.request.PublishOrderRequest;
import com.zhipao.dto.response.OrderVO;
import com.zhipao.entity.Order;
import com.zhipao.entity.User;
import com.zhipao.mapper.OrderMapper;
import com.zhipao.mapper.UserMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 订单服务（转换核心，原 NestJS 567 行）
 *
 * ★ 三条安全红线（必须保持）：
 *   1. 所有对外输出必须走 toOrderView()（唯一脱敏通道）
 *   2. 取件码只对相关方（发布方/跑腿员）明文可见
 *   3. 跑腿员昵称脱敏
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class OrderService {

    private final OrderMapper orderMapper;
    private final UserMapper userMapper;
    private final GeoService geoService;

    @Value("${zhipao.credit.accept-threshold:60}")
    private int acceptThreshold;

    @Value("${zhipao.credit.publish-threshold:50}")
    private int publishThreshold;

    // ========================================================================
    // 查询
    // ========================================================================

    /**
     * 待接单列表（分页）
     */
    public Map<String, Object> listAvailable(String userId, Integer deliveryType,
                                             String keyword, int page, int pageSize) {
        int offset = (page - 1) * pageSize;
        List<Order> rows = orderMapper.selectAvailable(
                deliveryType == null ? 1 : deliveryType,
                StrUtil.trimToNull(keyword), offset, pageSize);

        long total = orderMapper.countAvailable(deliveryType == null ? 1 : deliveryType);

        List<OrderVO> list = rows.stream()
                .map(o -> toOrderView(o, userId))
                .collect(Collectors.toList());

        return pageResult(list, total, page, pageSize);
    }

    /**
     * 我的订单（分页）
     */
    public Map<String, Object> listMine(String userId, String status, String role,
                                        int page, int pageSize) {
        int offset = (page - 1) * pageSize;
        List<Order> rows = orderMapper.selectMine(userId, status, role, offset, pageSize);
        long total = orderMapper.countMine(userId);

        List<OrderVO> list = rows.stream()
                .map(o -> toOrderView(o, userId))
                .collect(Collectors.toList());

        return pageResult(list, total, page, pageSize);
    }

    /**
     * 订单详情
     */
    public OrderVO detail(String userId, String orderId) {
        Order order = orderMapper.selectById(orderId);
        if (order == null) {
            throw BizException.notFound("订单不存在");
        }
        return toOrderView(order, userId);
    }

    /**
     * 我的最新进行中订单（AI 客服查订单用）
     *
     * ★ 安全关键：按归属过滤，防止越权
     */
    public OrderVO findLatestActive(String userId) {
        Order order = orderMapper.selectLatestActive(userId);
        return order == null ? null : toOrderView(order, userId);
    }

    // ========================================================================
    // 发布
    // ========================================================================

    /**
     * 发布订单
     */
    @Transactional(rollbackFor = Exception.class)
    public OrderVO publish(String userId, PublishOrderRequest req) {
        User user = userMapper.selectById(userId);
        if (user == null) {
            throw BizException.notFound("用户不存在");
        }

        // ★ 信用分门槛
        if (user.getCreditScore() < publishThreshold) {
            throw BizException.badRequest(String.format(
                    "信用分不足（当前 %d，需 ≥ %d），暂不能发单",
                    user.getCreditScore(), publishThreshold));
        }

        // 取驿站坐标（供详情页地图）
        String[] stationCoord = geoService.resolveStationCoord(req.getStationId(), req.getStationName());
        // 取楼栋坐标
        String[] buildingCoord = geoService.resolveBuildingCoord(req.getBuildingId(), req.getBuildingName());

        Order order = new Order();
        order.setId(OrderNoGenerator.uuid());
        order.setOrderNo(OrderNoGenerator.generate());
        order.setPublisherId(userId);
        order.setDeliveryType(req.getDeliveryType());
        order.setStatus(OrderStatus.WAITING_ACCEPT.name());
        order.setPackageSize(req.getPackageSize());

        // 取件
        order.setStationId(req.getStationId());
        order.setStationName(req.getStationName());
        order.setStationLng(stationCoord[0]);
        order.setStationLat(stationCoord[1]);
        order.setPickupCode(req.getPickupCodes() == null || req.getPickupCodes().isEmpty()
                ? null : String.join(",", req.getPickupCodes()));
        order.setShopNo(StrUtil.trimToNull(req.getShopNo()));

        // 收件
        order.setBuildingId(req.getBuildingId());
        order.setBuildingName(req.getBuildingName());
        order.setBuildingLng(buildingCoord[0]);
        order.setBuildingLat(buildingCoord[1]);
        order.setRoomNo(req.getRoomNo());

        // 金额与时间
        order.setReward(req.getReward());
        order.setItemCount(req.getPickupCodes() == null ? 1 : Math.max(1, req.getPickupCodes().size()));
        order.setDeadline(req.getDeadline());
        order.setRemark(StrUtil.nullToEmpty(req.getRemark()));
        order.setUrgent(Boolean.TRUE.equals(req.getUrgent()));
        order.setVersion(0);

        orderMapper.insert(order);

        // ★ 异步算距离（失败不影响发布）
        try {
            geoService.refreshOrderDistanceAsync(order.getId());
        } catch (Exception e) {
            log.warn("距离计算入队失败（不影响发布）: {}", e.getMessage());
        }

        return toOrderView(order, userId);
    }

    // ========================================================================
    // 状态流转
    // ========================================================================

    /**
     * 接单
     *
     * 应用层先校验（给友好提示），再走存储过程 CAS（防并发）
     */
    public OrderVO accept(String userId, String orderId) {
        User user = userMapper.selectById(userId);
        if (user == null) {
            throw BizException.notFound("用户不存在");
        }

        // ★ 信用分门槛（应用层先拦，给友好提示）
        if (user.getCreditScore() < acceptThreshold) {
            throw BizException.badRequest(String.format(
                    "信用分不足（当前 %d，需 ≥ %d），暂不能接单",
                    user.getCreditScore(), acceptThreshold));
        }

        // ★ 存储过程 CAS（防并发重复接单）
        //   返回结果集：result = ACCEPTED
        try {
            Map<String, Object> ret = orderMapper.acceptOrderAtomic(orderId, userId,
                    StrUtil.nullToEmpty(user.getNickname()),
                    user.getCreditScore());
            log.debug("接单存储过程返回: {}", ret);
        } catch (Exception e) {
            throw BizException.fromProcedure(e.getMessage());
        }

        return detail(userId, orderId);
    }

    /**
     * 推进状态（取件中 / 配送中 / 已送达）
     */
    public OrderVO advance(String userId, String orderId, String action) {
        Order order = orderMapper.selectById(orderId);
        if (order == null) {
            throw BizException.notFound("订单不存在");
        }

        // 只有跑腿员能推进
        if (!userId.equals(order.getRunnerId())) {
            throw BizException.forbidden("只有接单的跑腿员可以推进状态");
        }

        OrderStatus next = OrderStatus.nextOf(order.getStatus(), action);
        if (next == null) {
            throw BizException.badRequest("当前状态不支持该操作");
        }

        int affected = orderMapper.advanceStatus(orderId, order.getStatus(),
                next.name(), userId);
        if (affected == 0) {
            throw BizException.badRequest("订单状态已变化，请刷新后重试");
        }

        return detail(userId, orderId);
    }

    /**
     * 确认收货（已完成）
     *
     * ★ 走存储过程：结算资金 + 加信用分 + 写流水
     */
    public OrderVO complete(String userId, String orderId) {
        // 返回结果集：result=COMPLETED, reward, runner_id
        try {
            Map<String, Object> ret = orderMapper.completeOrderAtomic(orderId, userId);
            log.debug("完成订单存储过程返回: {}", ret);
        } catch (Exception e) {
            throw BizException.fromProcedure(e.getMessage());
        }
        return detail(userId, orderId);
    }

    /**
     * 取消订单
     */
    public OrderVO cancel(String userId, String orderId, String reason) {
        Order order = orderMapper.selectById(orderId);
        if (order == null) {
            throw BizException.notFound("订单不存在");
        }

        // 只有相关方能取消
        if (!MaskUtil.isStakeholder(order.getPublisherId(), order.getRunnerId(), userId)) {
            throw BizException.forbidden("无权取消该订单");
        }

        if (OrderStatus.isFinal(order.getStatus())) {
            throw BizException.badRequest("订单已结束，无法取消");
        }

        int affected = orderMapper.cancelOrder(orderId, StrUtil.nullToEmpty(reason));
        if (affected == 0) {
            throw BizException.badRequest("订单状态已变化，请刷新后重试");
        }

        return detail(userId, orderId);
    }

    // ========================================================================
    // ★ 核心：订单 → 视图（唯一脱敏通道）
    // ========================================================================

    /**
     * 订单 → 对外视图
     *
     * ★★ 这是**唯一**允许对外输出订单的方法 ★★
     *
     * 脱敏规则：
     *   1. 取件码：只有相关方（发布方/跑腿员）可见明文，其他人 [已隐藏]
     *   2. 跑腿员昵称：一律脱敏（张*明）
     *
     * 禁止在 Controller 或别处手拼订单字符串输出 ——
     * 原 NestJS 版曾因手拼导致越权泄露（AI 客服能查到别人订单）。
     */
    public OrderVO toOrderView(Order row, String selfUserId) {
        boolean owner = MaskUtil.isStakeholder(
                row.getPublisherId(), row.getRunnerId(), selfUserId);

        return OrderVO.builder()
                .id(row.getId())
                .orderNo(row.getOrderNo())
                .deliveryType(row.getDeliveryType())
                .status(row.getStatus())
                .packageSize(row.getPackageSize())
                // ---- 取件 ----
                .stationId(row.getStationId())
                .stationName(row.getStationName())
                .stationLng(parseDouble(row.getStationLng()))
                .stationLat(parseDouble(row.getStationLat()))
                // ★ 取件码脱敏
                .pickupCode(MaskUtil.pickupCode(row.getPickupCode(), owner))
                .shopNo(row.getShopNo())
                // ---- 收件 ----
                .buildingId(row.getBuildingId())
                .buildingName(row.getBuildingName())
                .buildingLng(parseDouble(row.getBuildingLng()))
                .buildingLat(parseDouble(row.getBuildingLat()))
                .roomNo(row.getRoomNo())
                // ---- 金额与时间 ----
                .reward(row.getReward())
                .itemCount(row.getItemCount())
                .deadline(formatDateTime(row.getDeadline()))
                .deadlineText(formatDeadline(row.getDeadline()))
                .remark(row.getRemark())
                .urgent(row.getUrgent())
                // ---- 距离（null = 测量中） ----
                .distanceMeters(row.getDistanceMeters())
                // ---- 跑腿员（脱敏） ----
                .publisherId(row.getPublisherId())
                .runnerId(row.getRunnerId())
                .runnerName(MaskUtil.nickname(row.getRunnerName()))
                .runnerCredit(row.getRunnerCredit())
                // ---- 其他 ----
                .cancelReason(row.getCancelReason())
                .createTime(formatDateTime(row.getCreatedAt()))
                .acceptTime(formatDateTime(row.getAcceptedAt()))
                .completeTime(formatDateTime(row.getCompletedAt()))
                .build();
    }

    // ========================================================================
    // 内部工具
    // ========================================================================

    private static final DateTimeFormatter DT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private String formatDateTime(LocalDateTime t) {
        return t == null ? null : t.format(DT);
    }

    /**
     * 截止时间展示
     * - 已过 → 已截止
     * - < 1 小时 → 剩余 X 分钟
     * - 其他 → 具体时间
     */
    private String formatDeadline(LocalDateTime deadline) {
        if (deadline == null) {
            return null;
        }
        LocalDateTime now = LocalDateTime.now();
        if (deadline.isBefore(now)) {
            return "已截止";
        }
        long minutes = Duration.between(now, deadline).toMinutes();
        if (minutes < 60) {
            return "剩余 " + minutes + " 分钟";
        }
        if (minutes < 24 * 60) {
            return "剩余 " + (minutes / 60) + " 小时";
        }
        return deadline.format(DateTimeFormatter.ofPattern("MM-dd HH:mm"));
    }

    private Double parseDouble(String s) {
        if (StrUtil.isBlank(s)) {
            return null;
        }
        try {
            return Double.parseDouble(s);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private Map<String, Object> pageResult(Object list, long total, int page, int pageSize) {
        Map<String, Object> m = new HashMap<>();
        m.put("list", list);
        m.put("total", total);
        m.put("page", page);
        m.put("pageSize", pageSize);
        m.put("hasMore", (long) page * pageSize < total);
        return m;
    }

    // ========================================================================
    // 定时任务支持
    // ========================================================================

    /** 查出超时未接单的订单（供定时任务自动取消） */
    public List<Order> findOverdueWaiting(int minutes, int limit) {
        return orderMapper.selectOverdueWaiting(minutes, limit);
    }

    /** 查出已接单但超时未送达的订单（供定时任务扣分） */
    public List<Order> findOverdueDelivering(int minutes, int limit) {
        return orderMapper.selectOverdueDelivering(minutes, limit);
    }
}
