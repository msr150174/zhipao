package com.zhipao.service;

import cn.hutool.core.util.IdUtil;
import cn.hutool.core.util.StrUtil;
import cn.hutool.crypto.digest.DigestUtil;
import cn.hutool.http.HttpUtil;
import cn.hutool.json.JSONObject;
import cn.hutool.json.JSONUtil;
import com.zhipao.common.BizException;
import com.zhipao.common.MaskUtil;
import com.zhipao.common.OrderNoGenerator;
import com.zhipao.dto.response.UserVO;
import com.zhipao.entity.User;
import com.zhipao.mapper.UserMapper;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;

/**
 * 鉴权服务
 *
 * ★ 两种登录方式（与原 NestJS 版一致）：
 *   ① 微信登录：code → jscode2session → openid → 查/建用户 → 签发 JWT
 *   ② 手机号登录：验证码校验 → 查/建用户 → 签发 JWT
 *
 * ★ 与原实现的差异：
 *   - JWT 用 jjwt 库（替代手写的 base64url 拼接）
 *   - Token 加 jti（用于登出黑名单，存 Redis）
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserMapper userMapper;
    private final StringRedisTemplate redis;

    @Value("${zhipao.jwt.secret:}")
    private String jwtSecret;

    @Value("${zhipao.jwt.expire-hours:168}")
    private long expireHours;

    @Value("${zhipao.wechat.app-id:}")
    private String wxAppId;

    @Value("${zhipao.wechat.app-secret:}")
    private String wxAppSecret;

    private static final String WX_LOGIN_URL = "https://api.weixin.qq.com/sns/jscode2session";
    private static final String BLACKLIST_PREFIX = "jwt:blacklist:";

    // ========================================================================
    // 微信登录
    // ========================================================================

    /**
     * 微信登录
     *
     * ★ 真实调用 jscode2session 换 openid
     *
     * ★★ 开发模式（未配置 AppID/Secret）★★
     *   微信的 code 是**一次性**的，每次 uni.login() 都不同。
     *   若用 code 派生 openid，会导致「每次登录都是新用户」，
     *   表现为：发布订单后「我的订单」里看不到（因为换了账号）。
     *
     *   所以开发模式改用**固定 openid**：
     *     - 默认所有人共用一个测试账号（方便单账号联调）
     *     - 前端可传 devUser 指定身份（如 "a" / "b"），
     *       用于模拟「发布方」和「跑腿员」两个账号，测试接单流程
     *
     * @param code    微信登录凭证（真实模式必填）
     * @param devUser 开发模式下的身份标识（可选，如 "a"、"b"）
     */
    public Map<String, Object> wxLogin(String code, String devUser) {
        // ---- 开发模式：固定 openid（不依赖一次性 code）----
        if (StrUtil.isBlank(wxAppId) || StrUtil.isBlank(wxAppSecret)) {
            String identity = StrUtil.blankToDefault(StrUtil.trimToNull(devUser), "default");
            // 只保留安全字符，避免注入
            identity = identity.replaceAll("[^a-zA-Z0-9_-]", "");
            if (StrUtil.isBlank(identity)) {
                identity = "default";
            }

            String openid = "dev_openid_" + identity;
            log.warn("【开发模式】微信密钥未配置，使用固定 openid: {}（devUser={}）", openid, identity);

            User user = userMapper.selectByOpenid(openid);
            if (user == null) {
                user = createUser(openid, placeholderPhone(openid));
                // 开发模式下给个易辨识的昵称
                if (!"default".equals(identity)) {
                    user.setNickname("测试用户" + identity.toUpperCase());
                    userMapper.updateNickname(user.getId(), user.getNickname());
                }
                log.info("开发模式新用户: {} ({})", user.getId(), user.getNickname());
            }

            assertUserActive(user);
            return buildLoginResult(user);
        }

        // ---- 真实模式：必须带 code ----
        if (StrUtil.isBlank(code)) {
            throw BizException.badRequest("缺少登录凭证 code");
        }

        String openid = exchangeOpenid(code);

        User user = userMapper.selectByOpenid(openid);
        if (user == null) {
            user = createUser(openid, placeholderPhone(openid));
            log.info("微信新用户注册: {} 占位手机号: {}", user.getId(), user.getPhone());
        }

        assertUserActive(user);

        return buildLoginResult(user);
    }

    /**
     * 兼容旧调用（无 devUser）
     */
    public Map<String, Object> wxLogin(String code) {
        return wxLogin(code, null);
    }

    /** 调微信 jscode2session 换 openid */
    private String exchangeOpenid(String code) {
        Map<String, Object> params = new HashMap<>();
        params.put("appid", wxAppId);
        params.put("secret", wxAppSecret);
        params.put("js_code", code);
        params.put("grant_type", "authorization_code");

        try {
            String resp = HttpUtil.get(WX_LOGIN_URL, params, 8000);
            JSONObject json = JSONUtil.parseObj(resp);

            // 错误码：40029 code 无效 / 45011 频率限制 / 40226 高风险用户 / 40125 secret 无效
            Integer errcode = json.getInt("errcode");
            if (errcode != null && errcode != 0) {
                log.warn("微信登录失败: {} {}", errcode, json.getStr("errmsg"));
                throw BizException.badRequest("微信登录失败: " + json.getStr("errmsg"));
            }

            String openid = json.getStr("openid");
            if (StrUtil.isBlank(openid)) {
                throw BizException.badRequest("微信登录失败：未返回 openid");
            }
            return openid;

        } catch (BizException e) {
            throw e;
        } catch (Exception e) {
            log.error("微信登录异常: {}", e.getMessage());
            throw BizException.badRequest("微信登录异常，请稍后重试");
        }
    }

    // ========================================================================
    // 手机号登录
    // ========================================================================

    /**
     * 手机号登录（不存在则自动注册）
     *
     * ★ 验证码校验由 SmsService 完成（已在 Controller 层调用）
     */
    public Map<String, Object> loginByPhone(String phone) {
        if (StrUtil.isBlank(phone)) {
            throw BizException.badRequest("缺少手机号");
        }

        User user = userMapper.selectByPhone(phone);
        if (user == null) {
            user = createUser(null, phone);
            log.info("手机号新用户注册: {}", user.getId());
        }

        assertUserActive(user);

        return buildLoginResult(user);
    }

    // ========================================================================
    // 用户创建
    // ========================================================================

    /**
     * 创建用户
     *
     * ★ 契约：初始信用分 60
     */
    private User createUser(String openid, String phone) {
        User user = new User();
        user.setId(OrderNoGenerator.uuid());
        user.setOpenid(openid);
        user.setPhone(phone);
        user.setNickname(phone != null
                ? "同学" + phone.substring(Math.max(0, phone.length() - 4))
                : "同学");
        user.setCreditScore(60);
        user.setBalance(BigDecimal.ZERO);
        user.setIncome(BigDecimal.ZERO);
        user.setIsRunner(false);
        user.setIsAdmin(false);
        user.setRealNameVerified(false);
        user.setStatus(1);

        userMapper.insert(user);
        return user;
    }

    /**
     * 为微信登录用户生成占位手机号
     *
     * ★ 为什么不直接留 NULL：
     *   phone 是 users 表的登录标识，留 NULL 的话这个账号
     *   既不能用手机号登录，后台管理里也显示不出可辨识的信息。
     *   生成一个稳定的占位号，账号就始终有一个可用的「登录名」。
     *
     * ★ 为什么用 000 号段：
     *   工信部号段里不存在 000 开头的手机号，
     *   所以占位号永远不会和真实用户撞车（phone 有唯一索引）。
     *
     * ★ 为什么用哈希而不是随机数：
     *   同一个 openid 每次必须算出同一个占位号。
     *   否则重复触发建号逻辑时会生成不同的号码，导致唯一索引冲突。
     *
     * ★ 用户绑定真实手机号后：
     *   走 POST /api/user/change-phone，占位号会被真实号替换掉。
     */
    private String placeholderPhone(String openid) {
        if (StrUtil.isBlank(openid)) {
            return null;
        }
        // 用 openid 的哈希取模，保证同一 openid 永远得到同一个号码
        int hash = Math.abs(openid.hashCode());
        String digits = String.format("%08d", hash % 100000000);
        return "000" + digits;
    }

    private void assertUserActive(User user) {
        if (!user.isActive()) {
            throw BizException.forbidden("账号已注销");
        }    }

    // ========================================================================
    // JWT
    // ========================================================================

    /**
     * 签发 Token
     */
    public String signToken(String userId, boolean isAdmin) {
        if (StrUtil.isBlank(jwtSecret) || jwtSecret.length() < 32) {
            // 开发环境兜底：用固定值，但生产必须配置（≥32 位）
            log.warn("JWT_SECRET 未配置或过短，使用开发默认值（生产环境必须配置 ≥32 位）");
            jwtSecret = "zhipao-dev-secret-key-please-change-in-production";
        }

        SecretKey key = Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
        Date now = new Date();
        Date exp = new Date(now.getTime() + expireHours * 3600_000L);

        return Jwts.builder()
                .subject(userId)
                .id(IdUtil.fastSimpleUUID())            // jti，用于登出黑名单
                .claim("admin", isAdmin)
                .issuedAt(now)
                .expiration(exp)
                .signWith(key)
                .compact();
    }

    /**
     * 解析 Token
     *
     * @return userId；无效或已登出返回 null
     */
    public String parseUserId(String token) {
        Claims claims = parseClaims(token);
        return claims == null ? null : claims.getSubject();
    }

    /** 解析完整 Claims（含 jti / admin） */
    public Claims parseClaims(String token) {
        if (StrUtil.isBlank(token)) {
            return null;
        }

        // 去掉 Bearer 前缀
        if (token.startsWith("Bearer ")) {
            token = token.substring(7);
        }

        try {
            SecretKey key = Keys.hmacShaKeyFor(
                    (StrUtil.isBlank(jwtSecret)
                            ? "zhipao-dev-secret-key-please-change-in-production"
                            : jwtSecret)
                            .getBytes(StandardCharsets.UTF_8));

            Claims claims = Jwts.parser()
                    .verifyWith(key)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();

            // ★ 检查黑名单（登出后失效）
            String jti = claims.getId();
            if (jti != null && Boolean.TRUE.equals(redis.hasKey(BLACKLIST_PREFIX + jti))) {
                return null;
            }

            return claims;

        } catch (JwtException | IllegalArgumentException e) {
            log.debug("Token 解析失败: {}", e.getMessage());
            return null;
        }
    }

    /**
     * 登出：把 jti 加入黑名单
     */
    public void logout(String token) {
        Claims claims = parseClaims(token);
        if (claims == null || claims.getId() == null || claims.getExpiration() == null) {
            return;
        }
        long ttl = claims.getExpiration().getTime() - System.currentTimeMillis();
        if (ttl > 0) {
            redis.opsForValue().set(BLACKLIST_PREFIX + claims.getId(), "1",
                    Duration.ofMillis(ttl));
        }
    }

    // ========================================================================
    // 用户视图
    // ========================================================================

    /**
     * 用户 → 视图（脱敏）
     *
     * ★ 手机号脱敏：138****1234
     */
    public UserVO toUserVO(User user) {
        if (user == null) {
            return null;
        }
        UserVO vo = new UserVO();
        vo.setId(user.getId());
        vo.setNickname(user.getNickname());
        vo.setAvatarUrl(user.getAvatarUrl());
        vo.setStudentNo(MaskUtil.studentNo(user.getStudentNo()));
        vo.setPhone(MaskUtil.phone(user.getPhone()));
        vo.setCreditScore(user.getCreditScore());
        vo.setBalance(user.getBalance());
        vo.setIncome(user.getIncome());
        vo.setIsRunner(user.getIsRunner());
        vo.setIsAdmin(user.getIsAdmin());
        vo.setRealNameVerified(user.getRealNameVerified());
        return vo;
    }

    /** 组装登录返回 */
    private Map<String, Object> buildLoginResult(User user) {
        Map<String, Object> result = new HashMap<>();
        result.put("token", signToken(user.getId(), Boolean.TRUE.equals(user.getIsAdmin())));
        result.put("user", toUserVO(user));
        return result;
    }
}
