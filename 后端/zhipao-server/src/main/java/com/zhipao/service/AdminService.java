package com.zhipao.service;

import cn.hutool.core.util.StrUtil;
import com.zhipao.common.BizException;
import com.zhipao.entity.RunnerApplication;
import com.zhipao.mapper.RunnerApplicationMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 管理员服务
 *
 *   GET  /api/admin/runner-applications                入驻申请列表
 *   POST /api/admin/runner-applications/{id}/approve   审核通过
 *   POST /api/admin/runner-applications/{id}/reject    审核驳回
 *
 * ★★ 安全：本服务的所有接口都由 AdminInterceptor 强制校验管理员身份 ★★
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AdminService {

    private final RunnerApplicationMapper runnerApplicationMapper;

    /**
     * 入驻申请列表
     *
     * @param status 0 待审 / 1 通过 / 2 驳回；null = 全部
     */
    public Map<String, Object> listApplications(Integer status, int page, int pageSize) {
        int offset = (page - 1) * pageSize;

        List<RunnerApplication> rows = runnerApplicationMapper.selectByStatus(status, offset, pageSize);
        long total = runnerApplicationMapper.countByStatus(status);

        List<Map<String, Object>> list = new ArrayList<>();
        for (RunnerApplication app : rows) {
            Map<String, Object> m = new HashMap<>();
            m.put("id", app.getId());
            m.put("userId", app.getUserId());
            m.put("realName", app.getRealName());
            m.put("studentNo", app.getStudentNo());
            // ★ 管理员看完整手机号（用于核实），但列表页可考虑也脱敏
            m.put("phone", app.getPhone());
            m.put("campus", app.getCampus());
            m.put("idCardImg", app.getIdCardImg());
            m.put("intro", app.getIntro());
            m.put("status", app.getStatus());
            m.put("statusText", statusText(app.getStatus()));
            m.put("rejectReason", app.getRejectReason());
            m.put("createTime", app.getCreatedAt() == null ? null : app.getCreatedAt().toString());
            m.put("reviewedAt", app.getReviewedAt() == null ? null : app.getReviewedAt().toString());
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

    /**
     * 审核通过
     *
     * ★ 走存储过程：同一事务内更新申请表 + 标记 users.is_runner = 1
     */
    public Map<String, Object> approve(Long appId, String reviewerId) {
        // 返回结果集：result, user_id
        Map<String, Object> ret;
        try {
            ret = runnerApplicationMapper.approveRunnerAtomic(appId, reviewerId);
        } catch (Exception e) {
            throw BizException.fromProcedure(e.getMessage());
        }

        Object userId = ret == null ? null : ret.get("user_id");
        log.info("入驻申请通过: appId={} reviewer={} userId={}", appId, reviewerId, userId);

        Map<String, Object> result = new HashMap<>();
        result.put("ok", true);
        result.put("userId", userId);
        result.put("message", "已通过，该用户现在可以接单");
        return result;
    }

    /**
     * 审核驳回
     */
    public Map<String, Object> reject(Long appId, String reviewerId, String reason) {
        if (StrUtil.isBlank(reason)) {
            throw BizException.badRequest("请填写驳回原因");
        }
        if (reason.length() > 200) {
            throw BizException.badRequest("驳回原因最多 200 字");
        }

        try {
            runnerApplicationMapper.rejectRunnerAtomic(appId, reviewerId, reason);
        } catch (Exception e) {
            throw BizException.fromProcedure(e.getMessage());
        }

        log.info("入驻申请驳回: appId={} reason={}", appId, reason);

        Map<String, Object> result = new HashMap<>();
        result.put("ok", true);
        result.put("message", "已驳回");
        return result;
    }

    private String statusText(Integer status) {
        if (status == null) {
            return "未知";
        }
        return switch (status) {
            case 0 -> "待审核";
            case 1 -> "已通过";
            case 2 -> "已驳回";
            default -> "未知";
        };
    }
}
