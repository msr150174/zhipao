package com.zhipao.service;

import cn.hutool.core.util.StrUtil;
import com.zhipao.common.BizException;
import com.zhipao.common.OrderStatus;
import com.zhipao.dto.response.AdminOrderVO;
import com.zhipao.entity.Order;
import com.zhipao.entity.User;
import com.zhipao.mapper.AdminOrderMapper;
import com.zhipao.mapper.AdminUserMapper;
import com.zhipao.mapper.OrderMapper;
import com.zhipao.mapper.UserMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 后台 - 订单与用户管理
 *
 * ★★ 安全：本服务所有方法仅由 /api/admin/** 调用，
 *         由 AdminInterceptor 强制校验管理员身份 ★★
 *
 * 提供的管理能力：
 *   - 订单：全量查询（多条件筛选）、详情、强制取消、强制完成、统计
 *   - 用户：全量查询、详情、冻结/解冻、调整信用分、设为管理员
 *   - 看板：今日汇总数据
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AdminManageService {

    private final OrderMapper orderMapper;
    private final UserMapper userMapper;
    private final AdminOrderMapper adminOrderMapper;
    private final AdminUserMapper adminUserMapper;

    private static final DateTimeFormatter DT =
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    /** 包裹大小文案（与前端一致：按配送类型区分） */
    private static String sizeText(Integer size, Integer deliveryType) {
        int s = size == null ? 2 : size;
        boolean meal = deliveryType != null && deliveryType == 2;
        if (meal) {
            return switch (s) {
                case 1 -> "小份";
                case 3 -> "大份";
                default -> "中份";
            };
        }
        return switch (s) {
            case 1 -> "小件";
            case 3 -> "大件";
            default -> "中件";
        };
    }

    private static String deliveryText(Integer type) {
        return type != null && type == 2 ? "取外卖" : "取快递";
    }

    private static Double parseDouble(String s) {
        if (StrUtil.isBlank(s)) return null;
        try {
            return Double.parseDouble(s);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    // ========================================================================
    // 订单管理
    // ========================================================================

    /**
     * 订单列表（多条件筛选）
     *
     * @param status       订单状态（null = 全部）
     * @param deliveryType 1 取件 / 2 取餐（null = 全部）
     * @param keyword      订单号 / 驿站 / 楼栋 / 房间号
     * @param startDate    起始日期（yyyy-MM-dd，可空）
     * @param endDate      截止日期（yyyy-MM-dd，可空）
     */
    public Map<String, Object> listOrders(String status, Integer deliveryType, String keyword,
                                          String startDate, String endDate,
                                          int page, int pageSize) {
        int offset = (page - 1) * pageSize;

        List<Order> rows = adminOrderMapper.adminSelectOrders(
                StrUtil.trimToNull(status),
                deliveryType,
                StrUtil.trimToNull(keyword),
                StrUtil.trimToNull(startDate),
                StrUtil.trimToNull(endDate),
                offset, pageSize);

        long total = adminOrderMapper.adminCountOrders(
                StrUtil.trimToNull(status),
                deliveryType,
                StrUtil.trimToNull(keyword),
                StrUtil.trimToNull(startDate),
                StrUtil.trimToNull(endDate));

        // 批量取用户昵称，避免 N+1
        Map<String, User> userCache = new HashMap<>();
        List<Map<String, Object>> list = new ArrayList<>();
        for (Order o : rows) {
            list.add(toAdminOrderBrief(o, userCache));
        }

        Map<String, Object> result = new HashMap<>();
        result.put("list", list);
        result.put("total", total);
        result.put("page", page);
        result.put("pageSize", pageSize);
        result.put("hasMore", (long) page * pageSize < total);
        return result;
    }

    /** 订单详情（完整字段，不脱敏） */
    public AdminOrderVO orderDetail(String orderId) {
        Order o = orderMapper.selectById(orderId);
        if (o == null) {
            throw BizException.notFound("订单不存在");
        }

        User publisher = userMapper.selectById(o.getPublisherId());
        User runner = StrUtil.isBlank(o.getRunnerId()) ? null : userMapper.selectById(o.getRunnerId());

        boolean expired = o.getDeadline() != null && o.getDeadline().isBefore(LocalDateTime.now());

        return AdminOrderVO.builder()
                .id(o.getId())
                .orderNo(o.getOrderNo())
                .deliveryType(o.getDeliveryType())
                .deliveryTypeText(deliveryText(o.getDeliveryType()))
                .status(o.getStatus())
                .statusText(OrderStatus.labelOf(o.getStatus()))
                .packageSize(o.getPackageSize())
                .packageSizeText(sizeText(o.getPackageSize(), o.getDeliveryType()))
                // 取件
                .stationId(o.getStationId())
                .stationName(o.getStationName())
                .pickupCode(o.getPickupCode())          // ★ 管理员可见明文
                .shopNo(o.getShopNo())
                .stationLng(parseDouble(o.getStationLng()))
                .stationLat(parseDouble(o.getStationLat()))
                // 送达
                .buildingId(o.getBuildingId())
                .buildingName(o.getBuildingName())
                .roomNo(o.getRoomNo())
                .buildingLng(parseDouble(o.getBuildingLng()))
                .buildingLat(parseDouble(o.getBuildingLat()))
                // 金额时间
                .reward(o.getReward())
                .itemCount(o.getItemCount())
                .deadline(o.getDeadline() == null ? null : o.getDeadline().format(DT))
                .remark(o.getRemark())
                .urgent(o.getUrgent())
                .distanceMeters(o.getDistanceMeters())
                // 双方
                .publisherId(o.getPublisherId())
                .publisherName(publisher == null ? null : publisher.getNickname())
                .publisherPhone(publisher == null ? null : publisher.getPhone())
                .runnerId(o.getRunnerId())
                .runnerName(o.getRunnerName())
                .runnerCredit(o.getRunnerCredit())
                // 其他
                .cancelReason(o.getCancelReason())
                .createTime(o.getCreatedAt() == null ? null : o.getCreatedAt().format(DT))
                .acceptTime(o.getAcceptedAt() == null ? null : o.getAcceptedAt().format(DT))
                .completeTime(o.getCompletedAt() == null ? null : o.getCompletedAt().format(DT))
                .expired(expired)
                .build();
    }

    /** 列表用的精简视图（带发布方/跑腿员昵称） */
    private Map<String, Object> toAdminOrderBrief(Order o, Map<String, User> cache) {
        User pub = cache.computeIfAbsent(o.getPublisherId(),
                id -> userMapper.selectById(id));

        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", o.getId());
        m.put("orderNo", o.getOrderNo());
        m.put("status", o.getStatus());
        m.put("statusText", OrderStatus.labelOf(o.getStatus()));
        m.put("deliveryType", o.getDeliveryType());
        m.put("deliveryTypeText", deliveryText(o.getDeliveryType()));
        m.put("packageSizeText", sizeText(o.getPackageSize(), o.getDeliveryType()));
        m.put("stationName", o.getStationName());
        m.put("buildingName", o.getBuildingName());
        m.put("roomNo", o.getRoomNo());
        m.put("reward", o.getReward());
        m.put("urgent", o.getUrgent());
        m.put("publisherId", o.getPublisherId());
        m.put("publisherName", pub == null ? null : pub.getNickname());
        m.put("runnerId", o.getRunnerId());
        m.put("runnerName", o.getRunnerName());
        m.put("createTime", o.getCreatedAt() == null ? null : o.getCreatedAt().format(DT));
        m.put("deadline", o.getDeadline() == null ? null : o.getDeadline().format(DT));
        return m;
    }

    /**
     * 强制取消订单（管理员）
     *
     * 用于：异常订单、用户申诉、测试数据清理
     */
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> forceCancelOrder(String orderId, String reason) {
        Order o = orderMapper.selectById(orderId);
        if (o == null) {
            throw BizException.notFound("订单不存在");
        }
        if (OrderStatus.isFinal(o.getStatus())) {
            throw BizException.badRequest("订单已结束，无法取消");
        }

        String fullReason = "[管理员] " + StrUtil.blankToDefault(reason, "后台强制取消");
        int affected = orderMapper.cancelOrder(orderId, fullReason);
        if (affected == 0) {
            throw BizException.badRequest("取消失败，订单状态可能已变化");
        }

        log.warn("[管理员操作] 强制取消订单 {} 原因: {}", o.getOrderNo(), fullReason);

        Map<String, Object> r = new HashMap<>();
        r.put("ok", true);
        r.put("orderNo", o.getOrderNo());
        r.put("message", "订单已强制取消");
        return r;
    }

    /**
     * 强制完成订单（管理员）
     *
     * 用于：跑腿员已送达但发布方长期不确认
     */
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> forceCompleteOrder(String orderId, String reason) {
        Order o = orderMapper.selectById(orderId);
        if (o == null) {
            throw BizException.notFound("订单不存在");
        }
        if (!"DELIVERED".equals(o.getStatus())) {
            throw BizException.badRequest("仅「已送达」状态可强制完成，当前：" + OrderStatus.labelOf(o.getStatus()));
        }
        if (StrUtil.isBlank(o.getRunnerId())) {
            throw BizException.badRequest("该订单没有跑腿员");
        }

        // 走存储过程完成结算（发布方 = 管理员代办）
        try {
            orderMapper.completeOrderAtomic(orderId, o.getPublisherId());
        } catch (Exception e) {
            throw BizException.fromProcedure(e.getMessage());
        }

        log.warn("[管理员操作] 强制完成订单 {} 原因: {}", o.getOrderNo(),
                StrUtil.blankToDefault(reason, "无"));

        Map<String, Object> r = new HashMap<>();
        r.put("ok", true);
        r.put("orderNo", o.getOrderNo());
        r.put("message", "订单已强制完成并结算");
        return r;
    }

    // ========================================================================
    // 用户管理
    // ========================================================================

    public Map<String, Object> listUsers(String keyword, Integer minCredit, Integer maxCredit,
                                         Boolean isRunner, Integer status,
                                         int page, int pageSize) {
        int offset = (page - 1) * pageSize;

        List<User> rows = adminUserMapper.adminSelectUsers(
                StrUtil.trimToNull(keyword), minCredit, maxCredit, isRunner, status,
                offset, pageSize);

        long total = adminUserMapper.adminCountUsers(
                StrUtil.trimToNull(keyword), minCredit, maxCredit, isRunner, status);

        List<Map<String, Object>> list = new ArrayList<>();
        for (User u : rows) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", u.getId());
            m.put("nickname", u.getNickname());
            m.put("phone", u.getPhone());
            m.put("studentNo", u.getStudentNo());
            m.put("creditScore", u.getCreditScore());
            m.put("balance", u.getBalance());
            m.put("income", u.getIncome());
            m.put("isRunner", u.getIsRunner());
            m.put("isAdmin", u.getIsAdmin());
            m.put("realNameVerified", u.getRealNameVerified());
            m.put("status", u.getStatus());
            m.put("statusText", u.getStatus() != null && u.getStatus() == 0 ? "已注销" : "正常");
            m.put("createTime", u.getCreatedAt() == null ? null : u.getCreatedAt().format(DT));
            list.add(m);
        }

        Map<String, Object> result = new HashMap<>();
        result.put("list", list);
        result.put("total", total);
        result.put("page", page);
        result.put("pageSize", pageSize);
        result.put("hasMore", (long) page * pageSize < total);
        return result;
    }

    public Map<String, Object> userDetail(String userId) {
        User u = userMapper.selectById(userId);
        if (u == null) {
            throw BizException.notFound("用户不存在");
        }

        // 订单统计
        Map<String, Object> stats = adminUserMapper.adminUserOrderStats(userId);

        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", u.getId());
        m.put("openid", u.getOpenid());
        m.put("nickname", u.getNickname());
        m.put("avatarUrl", u.getAvatarUrl());
        m.put("phone", u.getPhone());
        m.put("studentNo", u.getStudentNo());
        m.put("creditScore", u.getCreditScore());
        m.put("balance", u.getBalance());
        m.put("income", u.getIncome());
        m.put("isRunner", u.getIsRunner());
        m.put("isAdmin", u.getIsAdmin());
        m.put("realNameVerified", u.getRealNameVerified());
        m.put("status", u.getStatus());
        m.put("createTime", u.getCreatedAt() == null ? null : u.getCreatedAt().format(DT));
        m.put("stats", stats);
        return m;
    }

    /**
     * 调整信用分
     *
     * ★ 同时写入 credit_records 留痕
     */
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> adjustCredit(String userId, int delta, String reason) {
        if (delta == 0) {
            throw BizException.badRequest("变动值不能为 0");
        }
        if (Math.abs(delta) > 100) {
            throw BizException.badRequest("单次调整不能超过 100 分");
        }
        if (StrUtil.isBlank(reason)) {
            throw BizException.badRequest("必须填写调整原因");
        }

        User u = userMapper.selectById(userId);
        if (u == null) {
            throw BizException.notFound("用户不存在");
        }

        int before = u.getCreditScore() == null ? 60 : u.getCreditScore();
        int after = Math.max(0, Math.min(100, before + delta));

        adminUserMapper.adminUpdateCredit(userId, after);
        adminUserMapper.adminInsertCreditRecord(userId, after - before, after,
                "[管理员] " + reason, "ADMIN_ADJUST", null);

        log.warn("[管理员操作] 调整信用分 user={} {} -> {} 原因: {}", userId, before, after, reason);

        Map<String, Object> r = new HashMap<>();
        r.put("ok", true);
        r.put("before", before);
        r.put("after", after);
        r.put("message", "信用分已调整");
        return r;
    }

    /**
     * 冻结 / 解冻账号
     *
     * status: 1 正常 / 0 已注销（此处复用为冻结）
     */
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> toggleUserStatus(String userId, boolean freeze, String reason) {
        if (userId == null) {
            throw BizException.badRequest("缺少用户 ID");
        }
        if (freeze && StrUtil.isBlank(reason)) {
            throw BizException.badRequest("冻结必须填写原因");
        }

        User u = userMapper.selectById(userId);
        if (u == null) {
            throw BizException.notFound("用户不存在");
        }
        if (Boolean.TRUE.equals(u.getIsAdmin())) {
            throw BizException.badRequest("不能冻结管理员账号");
        }

        adminUserMapper.adminUpdateStatus(userId, freeze ? 0 : 1);

        log.warn("[管理员操作] {} 用户 {} 原因: {}",
                freeze ? "冻结" : "解冻", userId, StrUtil.blankToDefault(reason, "无"));

        Map<String, Object> r = new HashMap<>();
        r.put("ok", true);
        r.put("status", freeze ? 0 : 1);
        r.put("message", freeze ? "账号已冻结" : "账号已解冻");
        return r;
    }

    /** 设为 / 取消管理员 */
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> setAdmin(String userId, boolean isAdmin) {
        User u = userMapper.selectById(userId);
        if (u == null) {
            throw BizException.notFound("用户不存在");
        }

        adminUserMapper.adminUpdateIsAdmin(userId, isAdmin);
        log.warn("[管理员操作] {} 管理员权限: {}", isAdmin ? "授予" : "撤销", userId);

        Map<String, Object> r = new HashMap<>();
        r.put("ok", true);
        r.put("isAdmin", isAdmin);
        r.put("message", isAdmin ? "已设为管理员" : "已取消管理员");
        return r;
    }

    // ========================================================================
    // 数据看板
    // ========================================================================

    public Map<String, Object> dashboard() {
        Map<String, Object> d = new LinkedHashMap<>();

        // 订单
        Map<String, Object> orders = adminOrderMapper.adminOrderStats();
        d.put("orders", orders == null ? Map.of() : orders);

        // 用户
        Map<String, Object> users = adminUserMapper.adminUserStats();
        d.put("users", users == null ? Map.of() : users);

        // 待办
        Map<String, Object> pending = new LinkedHashMap<>();
        pending.put("runnerApplications", adminUserMapper.adminCountPendingRunnerApps());
        pending.put("appealingOrders", adminOrderMapper.adminCountByStatus("APPEALING"));
        pending.put("withdrawals", adminUserMapper.adminCountPendingWithdrawals());
        pending.put("overdueOrders", adminOrderMapper.adminCountOverdue());
        d.put("pending", pending);

        // 近 7 天趋势
        d.put("trend", adminOrderMapper.adminDailyTrend(7));

        return d;
    }

    /** 全局流水（后台用） */
    public Map<String, Object> listTransactions(String type, String keyword,
                                                int page, int pageSize) {
        int offset = (page - 1) * pageSize;

        List<Map<String, Object>> rows = adminUserMapper.adminSelectTransactions(
                StrUtil.trimToNull(type), StrUtil.trimToNull(keyword), offset, pageSize);
        long total = adminUserMapper.adminCountTransactions(
                StrUtil.trimToNull(type), StrUtil.trimToNull(keyword));

        Map<String, Object> result = new HashMap<>();
        result.put("list", rows);
        result.put("total", total);
        result.put("page", page);
        result.put("pageSize", pageSize);
        result.put("hasMore", (long) page * pageSize < total);
        return result;
    }

    /** 提现申请列表 */
    public Map<String, Object> listWithdrawals(String status, int page, int pageSize) {
        int offset = (page - 1) * pageSize;
        List<Map<String, Object>> rows = adminUserMapper.adminSelectWithdrawals(
                StrUtil.trimToNull(status), offset, pageSize);
        long total = adminUserMapper.adminCountWithdrawals(StrUtil.trimToNull(status));

        Map<String, Object> result = new HashMap<>();
        result.put("list", rows);
        result.put("total", total);
        result.put("page", page);
        result.put("pageSize", pageSize);
        result.put("hasMore", (long) page * pageSize < total);
        return result;
    }

    /**
     * 审核提现
     *
     * @param pass true=通过（标记 SUCCESS）false=驳回（退回余额）
     */
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> reviewWithdrawal(Long txId, boolean pass, String reason) {
        Map<String, Object> tx = adminUserMapper.adminSelectTransactionById(txId);
        if (tx == null) {
            throw BizException.notFound("提现记录不存在");
        }
        if (!"PENDING".equals(tx.get("status"))) {
            throw BizException.badRequest("该申请已处理过");
        }

        String userId = String.valueOf(tx.get("user_id"));
        BigDecimal amount = new BigDecimal(String.valueOf(tx.get("amount")));

        if (pass) {
            adminUserMapper.adminUpdateTxStatus(txId, "SUCCESS", "提现已到账");
        } else {
            // 驳回：退回余额
            adminUserMapper.adminRefundBalance(userId, amount);
            adminUserMapper.adminUpdateTxStatus(txId, "REJECTED",
                    StrUtil.blankToDefault(reason, "提现被驳回"));

            adminUserMapper.adminInsertCreditRecord(userId, 0, 0,
                    "[管理员] 提现驳回: " + StrUtil.blankToDefault(reason, "无"),
                    "WITHDRAW_REJECTED", null);
        }

        log.warn("[管理员操作] 提现 {} txId={} 金额={}", pass ? "通过" : "驳回", txId, amount);

        Map<String, Object> r = new HashMap<>();
        r.put("ok", true);
        r.put("message", pass ? "已通过" : "已驳回并退回余额");
        return r;
    }
}
