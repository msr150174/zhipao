package com.zhipao.service;

import cn.hutool.core.util.StrUtil;
import com.zhipao.common.BizException;
import com.zhipao.common.MaskUtil;
import com.zhipao.common.OrderNoGenerator;
import com.zhipao.dto.response.TransactionVO;
import com.zhipao.dto.response.UserVO;
import com.zhipao.entity.CreditRecord;
import com.zhipao.entity.Transaction;
import com.zhipao.entity.User;
import com.zhipao.mapper.CreditRecordMapper;
import com.zhipao.mapper.TransactionMapper;
import com.zhipao.mapper.UserMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 用户服务
 *
 * 覆盖：
 *   - 个人信息（查 / 改昵称 / 改头像 / 换手机号）
 *   - 信用分记录
 *   - 交易流水
 *   - 提现（走存储过程，防超额）
 *   - 注销账号（标记删除）
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class UserService {

    private final UserMapper userMapper;
    private final CreditRecordMapper creditRecordMapper;
    private final TransactionMapper transactionMapper;
    private final AuthService authService;

    @Value("${zhipao.credit.accept-threshold:60}")
    private int acceptThreshold;

    @Value("${zhipao.credit.publish-threshold:50}")
    private int publishThreshold;

    public UserVO profile(String userId) {
        User user = userMapper.selectById(userId);
        if (user == null) {
            throw BizException.notFound("用户不存在");
        }
        return authService.toUserVO(user);
    }

    // ========================================================================
    // 个人信息
    // ========================================================================

    /** 改昵称 */
    public UserVO updateNickname(String userId, String nickname) {
        String n = StrUtil.trimToNull(nickname);
        if (n == null) {
            throw BizException.badRequest("昵称不能为空");
        }
        if (n.length() > 20) {
            throw BizException.badRequest("昵称最多 20 个字");
        }
        userMapper.updateNickname(userId, n);
        return profile(userId);
    }

    /** 改头像 */
    public UserVO updateAvatar(String userId, String avatarUrl) {
        if (StrUtil.isBlank(avatarUrl)) {
            throw BizException.badRequest("头像地址不能为空");
        }
        userMapper.updateAvatar(userId, avatarUrl);
        return profile(userId);
    }

    /**
     * 更换手机号
     *
     * ★ 前置：验证码已由 Controller 层通过 SmsService 校验
     */
    public UserVO changePhone(String userId, String newPhone) {
        if (StrUtil.isBlank(newPhone)) {
            throw BizException.badRequest("缺少手机号");
        }

        // 检查手机号是否已被占用
        User exist = userMapper.selectByPhone(newPhone);
        if (exist != null && !exist.getId().equals(userId)) {
            throw BizException.badRequest("该手机号已被其他账号绑定");
        }

        userMapper.updatePhone(userId, newPhone);
        return profile(userId);
    }

    // ========================================================================
    // 信用分
    // ========================================================================

    /** 信用分记录（分页） */
    public List<Map<String, Object>> creditRecords(String userId, int page, int pageSize) {
        int offset = (page - 1) * pageSize;
        List<CreditRecord> rows = creditRecordMapper.selectByUser(userId, offset, pageSize);

        return rows.stream().map(r -> {
            Map<String, Object> m = new HashMap<>();
            m.put("id", r.getId());
            m.put("change", r.getChange());
            m.put("balance", r.getBalance());
            m.put("reason", r.getReason());
            m.put("reasonCode", r.getReasonCode());
            m.put("orderNo", r.getOrderNo());
            m.put("createTime", r.getCreatedAt() == null ? null : r.getCreatedAt().toString());
            return m;
        }).collect(Collectors.toList());
    }

    // ========================================================================
    // 交易流水
    // ========================================================================

    /** 交易明细（分页） */
    public List<TransactionVO> transactions(String userId, int page, int pageSize) {
        int offset = (page - 1) * pageSize;
        return transactionMapper.selectByUser(userId, offset, pageSize).stream()
                .map(this::toTransactionVO)
                .collect(Collectors.toList());
    }

    private TransactionVO toTransactionVO(Transaction t) {
        TransactionVO vo = new TransactionVO();
        vo.setId(t.getId());
        vo.setType(t.getType());
        vo.setTypeText(typeText(t.getType()));
        vo.setAmount(t.getAmount());
        vo.setBalance(t.getBalance());
        vo.setOrderNo(t.getOrderNo());
        vo.setStatus(t.getStatus());
        vo.setRemark(t.getRemark());
        vo.setCreateTime(t.getCreatedAt() == null ? null : t.getCreatedAt().toString());
        return vo;
    }

    private String typeText(String type) {
        if (type == null) {
            return "";
        }
        return switch (type) {
            case "INCOME" -> "跑腿收入";
            case "EXPENSE" -> "支出";
            case "WITHDRAW" -> "提现";
            case "REFUND" -> "退款";
            default -> type;
        };
    }

    // ========================================================================
    // 提现
    // ========================================================================

    /**
     * 提现
     *
     * ★ 走存储过程：
     *   - 锁用户行（FOR UPDATE）防并发
     *   - 校验余额
     *   - 幂等键防重复提交
     */
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> withdraw(String userId, BigDecimal amount, String idempotencyKey) {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw BizException.badRequest("提现金额必须大于 0");
        }
        if (amount.compareTo(new BigDecimal("10000")) > 0) {
            throw BizException.badRequest("单次提现不能超过 10000 元");
        }

        String applyNo = OrderNoGenerator.generateApplyNo();
        String idemKey = StrUtil.blankToDefault(idempotencyKey, applyNo);

        // 返回结果集：result, new_balance, apply_no
        Map<String, Object> ret;
        try {
            ret = userMapper.withdrawAtomic(userId, amount, applyNo, idemKey);
        } catch (Exception e) {
            throw BizException.fromProcedure(e.getMessage());
        }

        Map<String, Object> result = new HashMap<>();
        result.put("applyNo", applyNo);
        result.put("amount", amount);
        result.put("balance", ret == null ? null : ret.get("new_balance"));
        result.put("status", "PENDING");
        result.put("message", "提现申请已提交，平台将统一处理");
        return result;
    }

    // ========================================================================
    // 注销
    // ========================================================================

    /**
     * 注销账号（标记删除）
     *
     * ★ 用「标记删除」而非真删：
     *   订单/资金记录必须留档（合规要求）
     */
    @Transactional(rollbackFor = Exception.class)
    public void deactivate(String userId) {
        // 检查是否有进行中的订单
        long active = userMapper.countActiveOrders(userId);
        if (active > 0) {
            throw BizException.badRequest("你有 " + active + " 个进行中的订单，请先处理完再注销");
        }

        // 检查余额
        User user = userMapper.selectById(userId);
        if (user != null && user.getBalance() != null
                && user.getBalance().compareTo(BigDecimal.ZERO) > 0) {
            throw BizException.badRequest("账户还有余额 ¥" + user.getBalance() + "，请先提现");
        }

        userMapper.deactivate(userId);
        log.info("用户注销（标记删除）: {}", userId);
    }

    // ========================================================================
    // 工具
    // ========================================================================

    /** 获取用户（不存在抛异常） */
    public User requireUser(String userId) {
        User user = userMapper.selectById(userId);
        if (user == null) {
            throw BizException.notFound("用户不存在");
        }
        return user;
    }

    /** 是否可接单 */
    public boolean canAccept(String userId) {
        User user = requireUser(userId);
        return user.getCreditScore() != null && user.getCreditScore() >= acceptThreshold;
    }

    /** 是否可发单 */
    public boolean canPublish(String userId) {
        User user = requireUser(userId);
        return user.getCreditScore() != null && user.getCreditScore() >= publishThreshold;
    }

    /** 跑腿员昵称（已脱敏，供订单展示） */
    public String maskedNickname(String userId) {
        User user = userMapper.selectById(userId);
        return user == null ? null : MaskUtil.nickname(user.getNickname());
    }
}
