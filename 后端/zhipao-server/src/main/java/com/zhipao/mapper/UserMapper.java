package com.zhipao.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.zhipao.entity.User;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Options;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.math.BigDecimal;
import java.util.Map;

/**
 * 用户 Mapper
 */
@Mapper
public interface UserMapper extends BaseMapper<User> {

    // ==================== 原子操作（存储过程） ====================

    /**
     * 提现（原子：锁行 + 校验余额 + 写流水）
     *
     * ★ 存储过程用 SELECT 返回结果集（MyBatis 无法绑定 OUT 参数）
     * 返回列：result, new_balance, apply_no
     */
    @Select("{call withdraw_atomic(#{userId}, #{amount}, #{applyNo}, #{idemKey})}")
    @Options(statementType = org.apache.ibatis.mapping.StatementType.CALLABLE)
    Map<String, Object> withdrawAtomic(@Param("userId") String userId,
                                       @Param("amount") BigDecimal amount,
                                       @Param("applyNo") String applyNo,
                                       @Param("idemKey") String idemKey);

    // ==================== 查询 ====================

    /** 按 openid 查（微信登录） */
    @Select("SELECT * FROM users WHERE openid = #{openid} AND (status IS NULL OR status = 1) LIMIT 1")
    User selectByOpenid(@Param("openid") String openid);

    /** 按手机号查（手机号登录） */
    @Select("SELECT * FROM users WHERE phone = #{phone} LIMIT 1")
    User selectByPhone(@Param("phone") String phone);

    // ==================== 更新 ====================

    /** 更新昵称 */
    @Update("UPDATE users SET nickname = #{nickname}, updated_at = NOW(3) WHERE id = #{userId}")
    int updateNickname(@Param("userId") String userId, @Param("nickname") String nickname);

    /** 更新头像 */
    @Update("UPDATE users SET avatar_url = #{avatarUrl}, updated_at = NOW(3) WHERE id = #{userId}")
    int updateAvatar(@Param("userId") String userId, @Param("avatarUrl") String avatarUrl);

    /** 更换手机号 */
    @Update("UPDATE users SET phone = #{phone}, updated_at = NOW(3) WHERE id = #{userId}")
    int updatePhone(@Param("userId") String userId, @Param("phone") String phone);

    /** 注销（标记删除，保留订单记录以便留档） */
    @Update("UPDATE users SET status = 0, deleted_at = NOW(3), updated_at = NOW(3) WHERE id = #{userId}")
    int deactivate(@Param("userId") String userId);

    /** 检查是否有进行中的订单（注销前校验） */
    @Select("""
        SELECT COUNT(*) FROM orders
         WHERE (publisher_id = #{userId} OR runner_id = #{userId})
           AND status IN ('WAITING_ACCEPT','ACCEPTED','PICKING','DELIVERING','DELIVERED','APPEALING')
        """)
    long countActiveOrders(@Param("userId") String userId);
}
