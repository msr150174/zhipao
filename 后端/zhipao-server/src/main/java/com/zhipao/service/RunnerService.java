package com.zhipao.service;

import cn.hutool.core.util.StrUtil;
import com.zhipao.common.BizException;
import com.zhipao.entity.RunnerApplication;
import com.zhipao.mapper.RunnerApplicationMapper;
import com.zhipao.mapper.UserMapper;
import com.zhipao.entity.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;

/**
 * 跑腿员入驻服务
 *
 *   POST /api/runner/apply              提交申请
 *   GET  /api/runner/my-application     查我的申请
 *
 * ★ 幂等：已有待审申请 → 拒绝重复提交（数据库触发器 + 应用层双保险）
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RunnerService {

    private final RunnerApplicationMapper runnerApplicationMapper;
    private final UserMapper userMapper;

    /**
     * 提交入驻申请
     */
    public Map<String, Object> apply(String userId, Map<String, String> body) {
        // 已经是跑腿员
        User user = userMapper.selectById(userId);
        if (user == null) {
            throw BizException.notFound("用户不存在");
        }
        if (Boolean.TRUE.equals(user.getIsRunner())) {
            throw BizException.badRequest("你已经是认证跑腿员");
        }

        String realName = StrUtil.trimToNull(body.get("realName"));
        String studentNo = StrUtil.trimToNull(body.get("studentNo"));
        String phone = StrUtil.trimToNull(body.get("phone"));

        // 必填校验
        if (realName == null) {
            throw BizException.badRequest("请填写真实姓名");
        }
        if (studentNo == null) {
            throw BizException.badRequest("请填写学号");
        }
        if (phone == null || !phone.matches("^1[3-9]\\d{9}$")) {
            throw BizException.badRequest("手机号格式不正确");
        }

        // 幂等：查是否已有待审
        RunnerApplication exist = runnerApplicationMapper.selectPendingByUser(userId);
        if (exist != null) {
            throw BizException.badRequest("你已提交申请，请等待审核");
        }

        RunnerApplication app = new RunnerApplication();
        app.setUserId(userId);
        app.setRealName(realName);
        app.setStudentNo(studentNo);
        app.setPhone(phone);
        app.setCampus(StrUtil.trimToNull(body.get("campus")));
        app.setIdCardImg(StrUtil.trimToNull(body.get("idCardImg")));
        app.setIntro(StrUtil.trimToNull(body.get("intro")));
        app.setStatus(0);

        try {
            runnerApplicationMapper.insert(app);
        } catch (Exception e) {
            // 触发器拦截（并发重复提交）
            if (e.getMessage() != null && e.getMessage().contains("ALREADY_APPLIED")) {
                throw BizException.badRequest("你已提交申请，请等待审核");
            }
            throw BizException.fromProcedure(e.getMessage());
        }

        log.info("跑腿员入驻申请提交: userId={} appId={}", userId, app.getId());
        return toView(app);
    }

    /**
     * 查我的申请状态
     */
    public Map<String, Object> myApplication(String userId) {
        // 优先返回待审，其次最近一条
        RunnerApplication app = runnerApplicationMapper.selectLatestByUser(userId);
        if (app == null) {
            Map<String, Object> empty = new HashMap<>();
            empty.put("status", null);
            empty.put("hasApplication", false);
            return empty;
        }
        Map<String, Object> view = toView(app);
        view.put("hasApplication", true);
        return view;
    }

    // ========================================================================
    // 视图
    // ========================================================================

    private Map<String, Object> toView(RunnerApplication app) {
        Map<String, Object> m = new HashMap<>();
        m.put("id", app.getId());
        m.put("realName", app.getRealName());
        m.put("studentNo", app.getStudentNo());
        m.put("phone", com.zhipao.common.MaskUtil.phone(app.getPhone()));
        m.put("campus", app.getCampus());
        m.put("intro", app.getIntro());
        m.put("status", app.getStatus());
        m.put("statusText", statusText(app.getStatus()));
        m.put("rejectReason", app.getRejectReason());
        m.put("createTime", app.getCreatedAt() == null ? null : app.getCreatedAt().toString());
        m.put("reviewedAt", app.getReviewedAt() == null ? null : app.getReviewedAt().toString());
        return m;
    }

    private String statusText(Integer status) {
        if (status == null) {
            return "未申请";
        }
        return switch (status) {
            case 0 -> "待审核";
            case 1 -> "已通过";
            case 2 -> "已驳回";
            default -> "未知";
        };
    }
}
