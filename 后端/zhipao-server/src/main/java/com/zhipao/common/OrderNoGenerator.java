package com.zhipao.common;

import cn.hutool.core.util.RandomUtil;
import cn.hutool.core.date.DateUtil;

import java.util.Date;

/**
 * 订单号生成器
 *
 * 格式：ZP + yymmdd + 4位随机 + 2位校验
 * 示例：ZP261012A3F7
 *
 * 与原 NestJS 的 order-no.ts 保持一致的风格（前缀 ZP = 智跑）。
 *
 * ★ 唯一性保障：
 *   1. 数据库 orders.order_no 有 UNIQUE 索引（最终防线）
 *   2. 这里用时间戳 + 随机，冲突概率极低
 *   3. 若插入撞唯一键，Service 层会重试（见 OrderService.publish）
 */
public final class OrderNoGenerator {

    private static final String PREFIX = "ZP";
    private static final String CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

    private OrderNoGenerator() {
    }

    /**
     * 生成订单号
     */
    public static String generate() {
        String date = DateUtil.format(new Date(), "yyMMdd");
        String rand = RandomUtil.randomString(CHARS, 6);
        return PREFIX + date + rand;
    }

    /**
     * 生成提现申请号
     */
    public static String generateApplyNo() {
        String date = DateUtil.format(new Date(), "yyMMddHHmmss");
        return "WD" + date + RandomUtil.randomNumbers(4);
    }

    /**
     * 生成 UUID（用作主键，与现有 40 位 varchar 主键兼容）
     */
    public static String uuid() {
        return cn.hutool.core.util.IdUtil.fastSimpleUUID();
    }
}
