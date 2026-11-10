package com.zhipao.common;

/**
 * 脱敏工具
 *
 * ★ 安全红线：这些方法用于所有对外输出，
 *   确保取件码、手机号、姓名不会明文泄露。
 *
 * 与现有 NestJS 的 mask.ts 保持一致的脱敏规则。
 */
public final class MaskUtil {

    private MaskUtil() {
    }

    /**
     * 取件码脱敏
     *
     * ★ 关键规则：只有订单相关方（发布方/跑腿员）能看到明文，
     *   其他一律隐藏。这一点由 OrderService.toOrderView 的 owner 参数控制。
     *
     * @param code  原始取件码
     * @param owner 是否相关方
     */
    public static String pickupCode(String code, boolean owner) {
        if (code == null || code.isEmpty()) {
            return "";
        }
        if (owner) {
            return code;
        }
        return "[已隐藏]";
    }

    /**
     * 手机号脱敏：138****1234
     */
    public static String phone(String phone) {
        if (phone == null || phone.length() < 7) {
            return phone;
        }
        return phone.substring(0, 3) + "****" + phone.substring(phone.length() - 4);
    }

    /**
     * 昵称脱敏
     * - 1 个字：原样
     * - 2 个字：张*
     * - 3+ 个字：张*明（首尾保留）
     */
    public static String nickname(String name) {
        if (name == null || name.isEmpty()) {
            return name;
        }
        int len = name.length();
        if (len == 1) {
            return name;
        }
        if (len == 2) {
            return name.charAt(0) + "*";
        }
        return name.charAt(0) + "*".repeat(len - 2) + name.charAt(len - 1);
    }

    /**
     * 学号脱敏：2021****1234
     */
    public static String studentNo(String no) {
        if (no == null || no.length() < 8) {
            return no;
        }
        return no.substring(0, 4) + "****" + no.substring(no.length() - 4);
    }

    /**
     * 是否订单相关方
     *
     * ★ 用于控制取件码是否明文可见
     */
    public static boolean isStakeholder(String publisherId, String runnerId, String selfUserId) {
        if (selfUserId == null) {
            return false;
        }
        return selfUserId.equals(publisherId) || selfUserId.equals(runnerId);
    }
}
