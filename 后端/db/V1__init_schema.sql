-- ============================================================================
-- 智跑校园 · MySQL 建表脚本（Java 后端）
-- ----------------------------------------------------------------------------
-- 来源：v10 的 schema.ts + 代码实际用到的表（逐个核对）
-- 目标：Spring Boot + MyBatis-Plus + MySQL 8.0
-- 字符集：utf8mb4 / utf8mb4_general_ci（支持 emoji）
--
-- 说明：
--   1. 全部使用 InnoDB 引擎（事务 + 行锁，支撑原子操作）
--   2. 主键用 varchar(40)（沿用现有 UUID 风格，避免迁移改 ID）
--   3. 金额统一 DECIMAL(12,2)
--   4. 时间统一 DATETIME(3)（毫秒精度，替代 timestamptz）
--   5. 布尔用 TINYINT(1)
--   6. JSON 用 MySQL 原生 JSON 类型
-- ============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================================
-- §1 用户表
-- ============================================================================
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id`                 VARCHAR(40)   NOT NULL                COMMENT '用户 ID（UUID）',
  `openid`             VARCHAR(64)   DEFAULT NULL            COMMENT '微信 openid',
  `nickname`           VARCHAR(50)   NOT NULL DEFAULT '同学'  COMMENT '昵称',
  `avatar_url`         VARCHAR(512)  DEFAULT NULL            COMMENT '头像 URL',
  `student_no`         VARCHAR(32)   DEFAULT NULL            COMMENT '学号',
  `phone`              VARCHAR(20)   DEFAULT NULL            COMMENT '手机号',
  `credit_score`       INT           NOT NULL DEFAULT 60     COMMENT '信用分（初始 60，满分 100）',
  `balance`            DECIMAL(12,2) NOT NULL DEFAULT 0.00   COMMENT '可提现余额',
  `income`             DECIMAL(12,2) NOT NULL DEFAULT 0.00   COMMENT '累计收入',
  `is_runner`          TINYINT(1)    NOT NULL DEFAULT 0      COMMENT '是否已认证跑腿员',
  `is_admin`           TINYINT(1)    NOT NULL DEFAULT 0      COMMENT '是否管理员',
  `real_name_verified` TINYINT(1)    NOT NULL DEFAULT 0      COMMENT '是否实名认证',
  `status`             TINYINT       NOT NULL DEFAULT 1      COMMENT '1 正常 / 0 已注销',
  `deleted_at`         DATETIME(3)   DEFAULT NULL            COMMENT '删除时间（软删）',
  `created_at`         DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`         DATETIME(3)   DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_openid_uk`     (`openid`),
  UNIQUE KEY `users_phone_uk`      (`phone`),
  KEY `users_student_no_idx`       (`student_no`),
  KEY `users_credit_idx`           (`credit_score`),
  KEY `users_status_idx`           (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='用户';

-- ============================================================================
-- §2 订单表（九态状态机）
-- ============================================================================
DROP TABLE IF EXISTS `orders`;
CREATE TABLE `orders` (
  `id`                  VARCHAR(40)   NOT NULL              COMMENT '订单 ID（UUID）',
  `order_no`            VARCHAR(32)   NOT NULL              COMMENT '订单号',
  `publisher_id`        VARCHAR(40)   NOT NULL              COMMENT '发布方用户 ID',
  `runner_id`           VARCHAR(40)   DEFAULT NULL          COMMENT '跑腿员用户 ID',
  `runner_name`         VARCHAR(50)   DEFAULT NULL          COMMENT '跑腿员昵称快照',
  `runner_credit`       INT           DEFAULT NULL          COMMENT '跑腿员信用分快照',
  `delivery_type`       INT           NOT NULL DEFAULT 1    COMMENT '1 取件 / 2 取餐',
  `status`              VARCHAR(24)   NOT NULL DEFAULT 'WAITING_ACCEPT'
                                                            COMMENT 'CREATED/WAITING_ACCEPT/ACCEPTED/PICKING/DELIVERING/DELIVERED/COMPLETED/CANCELLED/APPEALING',
  `package_size`        SMALLINT      NOT NULL DEFAULT 2    COMMENT '1 小 / 2 中 / 3 大',
  `station_id`          VARCHAR(40)   DEFAULT NULL          COMMENT '取件驿站 ID',
  `station_lng`         VARCHAR(32)   DEFAULT NULL          COMMENT '驿站经度',
  `station_lat`         VARCHAR(32)   DEFAULT NULL          COMMENT '驿站纬度',
  `station_name`        VARCHAR(100)  NOT NULL              COMMENT '驿站/店铺名称',
  `building_id`         VARCHAR(40)   DEFAULT NULL          COMMENT '送达楼栋 ID',
  `building_lng`        VARCHAR(32)   DEFAULT NULL          COMMENT '楼栋经度',
  `building_lat`        VARCHAR(32)   DEFAULT NULL          COMMENT '楼栋纬度',
  `building_name`       VARCHAR(100)  NOT NULL              COMMENT '楼栋名称',
  `room_no`             VARCHAR(50)   NOT NULL              COMMENT '房间号',
  `pickup_code`         VARCHAR(64)   DEFAULT NULL          COMMENT '取件码（可能多个，逗号分隔）',
  `shop_no`             VARCHAR(64)   DEFAULT NULL          COMMENT '取餐号',
  `reward`              DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '报酬',
  `item_count`          INT           NOT NULL DEFAULT 1    COMMENT '件数',
  `deadline`            DATETIME(3)   NOT NULL              COMMENT '截止时间',
  `remark`              VARCHAR(500)  DEFAULT NULL          COMMENT '备注',
  `urgent`              TINYINT(1)    NOT NULL DEFAULT 0    COMMENT '是否加急',
  `distance_meters`     INT           DEFAULT NULL          COMMENT '距离（米），null=测量中',
  `distance_updated_at` DATETIME(3)   DEFAULT NULL          COMMENT '距离计算时间',
  `cancel_reason`       VARCHAR(500)  DEFAULT NULL          COMMENT '取消原因',
  `appeal_id`           VARCHAR(40)   DEFAULT NULL          COMMENT '关联申诉 ID',
  `version`             INT           NOT NULL DEFAULT 0    COMMENT '乐观锁版本号',
  `accepted_at`         DATETIME(3)   DEFAULT NULL          COMMENT '接单时间',
  `completed_at`        DATETIME(3)   DEFAULT NULL          COMMENT '完成时间',
  `ext`                 JSON          DEFAULT NULL          COMMENT '扩展字段',
  `created_at`          DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`          DATETIME(3)   DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `orders_order_no_uk`            (`order_no`),
  KEY `orders_publisher_idx`                 (`publisher_id`),
  KEY `orders_runner_idx`                    (`runner_id`),
  KEY `orders_status_idx`                    (`status`),
  KEY `orders_type_status_idx`               (`delivery_type`, `status`),
  KEY `orders_deadline_idx`                  (`deadline`),
  KEY `orders_station_idx`                   (`station_id`),
  KEY `orders_building_idx`                  (`building_id`),
  KEY `orders_created_idx`                   (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='订单';

-- ============================================================================
-- §3 信用分记录
-- ============================================================================
DROP TABLE IF EXISTS `credit_records`;
CREATE TABLE `credit_records` (
  `id`          BIGINT        NOT NULL AUTO_INCREMENT,
  `user_id`     VARCHAR(40)   NOT NULL              COMMENT '用户 ID',
  `change`      INT           NOT NULL              COMMENT '变动值（可负）',
  `balance`     INT           NOT NULL              COMMENT '变动后信用分',
  `reason`      VARCHAR(200)  DEFAULT NULL          COMMENT '变动原因（中文）',
  `reason_code` VARCHAR(40)   DEFAULT NULL          COMMENT '变动原因码',
  `order_no`    VARCHAR(32)   DEFAULT NULL          COMMENT '关联订单号',
  `created_at`  DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `credit_user_idx`    (`user_id`, `created_at`),
  KEY `credit_order_idx`   (`order_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='信用分记录';

-- ============================================================================
-- §4 交易流水
-- ============================================================================
DROP TABLE IF EXISTS `transactions`;
CREATE TABLE `transactions` (
  `id`              BIGINT        NOT NULL AUTO_INCREMENT,
  `user_id`         VARCHAR(40)   NOT NULL            COMMENT '用户 ID',
  `type`            VARCHAR(20)   NOT NULL            COMMENT 'INCOME 收入 / EXPENSE 支出 / WITHDRAW 提现 / REFUND 退款',
  `amount`          DECIMAL(12,2) NOT NULL            COMMENT '金额（正数）',
  `balance`         DECIMAL(12,2) NOT NULL            COMMENT '变动后余额',
  `order_no`        VARCHAR(32)   DEFAULT NULL        COMMENT '关联订单号',
  `apply_no`        VARCHAR(40)   DEFAULT NULL        COMMENT '提现申请号',
  `status`          VARCHAR(20)   NOT NULL DEFAULT 'SUCCESS' COMMENT '状态',
  `idempotency_key` VARCHAR(64)   DEFAULT NULL        COMMENT '幂等键（防重复提交）',
  `remark`          VARCHAR(200)  DEFAULT NULL,
  `created_at`      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `tx_apply_no_uk`       (`apply_no`),
  UNIQUE KEY `tx_idem_uk`           (`idempotency_key`),
  KEY `tx_user_idx`                 (`user_id`, `created_at`),
  KEY `tx_order_idx`                (`order_no`),
  KEY `tx_type_idx`                 (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='交易流水';

-- ============================================================================
-- §5 驿站 / 店铺
-- ============================================================================
DROP TABLE IF EXISTS `station`;
CREATE TABLE `station` (
  `id`         VARCHAR(40)   NOT NULL,
  `name`       VARCHAR(100)  NOT NULL            COMMENT '名称',
  `type`       SMALLINT      NOT NULL DEFAULT 1  COMMENT '1 驿站 / 2 快递柜 / 3 食堂 / 4 店铺',
  `campus`     VARCHAR(50)   DEFAULT NULL        COMMENT '校区',
  `address`    VARCHAR(200)  DEFAULT NULL,
  `lng`        DECIMAL(10,6) DEFAULT NULL        COMMENT '经度（gcj02）',
  `lat`        DECIMAL(10,6) DEFAULT NULL        COMMENT '纬度（gcj02）',
  `geo_source` SMALLINT      NOT NULL DEFAULT 0  COMMENT '0 未解析 / 1 人工 / 2 地理编码',
  `geo_at`     DATETIME(3)   DEFAULT NULL        COMMENT '坐标解析时间',
  `open_time`  VARCHAR(50)   DEFAULT NULL        COMMENT '营业时间',
  `express`    VARCHAR(100)  DEFAULT NULL        COMMENT '支持快递公司',
  `sort`       INT           NOT NULL DEFAULT 0  COMMENT '排序',
  `status`     SMALLINT      NOT NULL DEFAULT 1  COMMENT '1 启用 / 0 停用',
  `created_at` DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3)   DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `station_status_sort_idx` (`status`, `sort`),
  KEY `station_name_idx`        (`name`),
  KEY `station_campus_idx`      (`campus`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='驿站/店铺';

-- ============================================================================
-- §6 楼栋
-- ============================================================================
DROP TABLE IF EXISTS `building`;
CREATE TABLE `building` (
  `id`         VARCHAR(40)   NOT NULL,
  `name`       VARCHAR(100)  NOT NULL            COMMENT '楼栋名',
  `alias`      VARCHAR(100)  DEFAULT NULL        COMMENT '别名',
  `campus`     VARCHAR(50)   DEFAULT NULL        COMMENT '校区',
  `lng`        DECIMAL(10,6) DEFAULT NULL,
  `lat`        DECIMAL(10,6) DEFAULT NULL,
  `geo_source` SMALLINT      NOT NULL DEFAULT 0  COMMENT '0 未解析 / 1 人工 / 2 地理编码',
  `geo_at`     DATETIME(3)   DEFAULT NULL,
  `floors`     INT           DEFAULT NULL        COMMENT '楼层数',
  `sort`       INT           NOT NULL DEFAULT 0,
  `status`     SMALLINT      NOT NULL DEFAULT 1,
  `created_at` DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3)   DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `building_status_sort_idx` (`status`, `sort`),
  KEY `building_name_idx`        (`name`),
  KEY `building_alias_idx`       (`alias`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='楼栋';

-- ============================================================================
-- §7 地理编码缓存
-- ============================================================================
DROP TABLE IF EXISTS `location_cache`;
CREATE TABLE `location_cache` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT,
  `query_text`   VARCHAR(200)  NOT NULL            COMMENT '查询文本（如「3号楼」）',
  `user_id`      VARCHAR(40)   DEFAULT NULL,
  `city`         VARCHAR(50)   DEFAULT NULL,
  `lng`          DECIMAL(10,6) DEFAULT NULL,
  `lat`          DECIMAL(10,6) DEFAULT NULL,
  `address`      VARCHAR(300)  DEFAULT NULL,
  `bus`          VARCHAR(50)   DEFAULT NULL,
  `confidence`   SMALLINT      NOT NULL DEFAULT 0,
  `provider`     VARCHAR(20)   NOT NULL DEFAULT 'tencent',
  `raw_response` JSON          DEFAULT NULL,
  `hit_count`    INT           NOT NULL DEFAULT 0,
  `updated_at`   DATETIME(3)   DEFAULT NULL,
  `created_at`   DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `loc_query_city_uk` (`query_text`, `city`),
  KEY `loc_user_idx`             (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='地理编码缓存';

-- ============================================================================
-- §8 评价（★ 代码用了但 schema.ts 里没有）
-- ============================================================================
DROP TABLE IF EXISTS `evaluation`;
CREATE TABLE `evaluation` (
  `id`         BIGINT        NOT NULL AUTO_INCREMENT,
  `order_no`   VARCHAR(32)   NOT NULL              COMMENT '订单号',
  `from_user`  VARCHAR(40)   NOT NULL              COMMENT '评价人',
  `to_user`    VARCHAR(40)   NOT NULL              COMMENT '被评价人',
  `role`       SMALLINT      NOT NULL DEFAULT 1    COMMENT '1 需求方评跑腿 / 2 跑腿评需求方',
  `score`      SMALLINT      NOT NULL              COMMENT '1~5 星',
  `tags`       VARCHAR(100)  DEFAULT NULL          COMMENT '标签（逗号分隔）',
  `comment`    VARCHAR(500)  DEFAULT NULL          COMMENT '评价内容',
  `is_auto`    TINYINT(1)    NOT NULL DEFAULT 0    COMMENT '是否超时自动好评',
  `status`     SMALLINT      NOT NULL DEFAULT 1,
  `created_at` DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `eval_order_from_uk` (`order_no`, `from_user`),
  KEY `eval_to_user_idx`          (`to_user`, `created_at`),
  CONSTRAINT `eval_score_chk` CHECK (`score` BETWEEN 1 AND 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='订单评价';

-- ============================================================================
-- §9 跑腿员入驻申请（★ 代码用了但 schema.ts 里没有）
-- ============================================================================
DROP TABLE IF EXISTS `runner_application`;
CREATE TABLE `runner_application` (
  `id`            BIGINT        NOT NULL AUTO_INCREMENT,
  `user_id`       VARCHAR(40)   NOT NULL,
  `real_name`     VARCHAR(50)   NOT NULL            COMMENT '真实姓名',
  `student_no`    VARCHAR(32)   NOT NULL            COMMENT '学号',
  `phone`         VARCHAR(20)   NOT NULL            COMMENT '手机号',
  `campus`        VARCHAR(50)   DEFAULT NULL,
  `id_card_img`   VARCHAR(300)  DEFAULT NULL        COMMENT '证件照 URL（TOS/COS）',
  `intro`         VARCHAR(200)  DEFAULT NULL        COMMENT '自我介绍',
  `status`        SMALLINT      NOT NULL DEFAULT 0  COMMENT '0 待审 / 1 通过 / 2 驳回',
  `reject_reason` VARCHAR(200)  DEFAULT NULL        COMMENT '驳回原因',
  `reviewed_by`   VARCHAR(40)   DEFAULT NULL,
  `reviewed_at`   DATETIME(3)   DEFAULT NULL,
  `created_at`    DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`    DATETIME(3)   DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `runner_app_user_idx`   (`user_id`),
  KEY `runner_app_status_idx` (`status`, `created_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='跑腿员入驻申请';

-- ★ MySQL 不支持"部分唯一索引"（WHERE status = 0），
--   用触发器实现"同一用户只能有一条待审记录"
DROP TRIGGER IF EXISTS `trg_runner_app_pending`;
DELIMITER $$
CREATE TRIGGER `trg_runner_app_pending` BEFORE INSERT ON `runner_application`
FOR EACH ROW
BEGIN
  DECLARE pending_cnt INT DEFAULT 0;
  IF NEW.`status` = 0 THEN
    SELECT COUNT(*) INTO pending_cnt
      FROM `runner_application`
     WHERE `user_id` = NEW.`user_id` AND `status` = 0;
    IF pending_cnt > 0 THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'ALREADY_APPLIED';
    END IF;
  END IF;
END$$
DELIMITER ;

-- ============================================================================
-- §10 健康检查（保留，用于存活探针）
-- ============================================================================
DROP TABLE IF EXISTS `health_check`;
CREATE TABLE `health_check` (
  `id`         BIGINT      NOT NULL AUTO_INCREMENT,
  `updated_at` DATETIME(3) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='健康检查';

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================================
-- §11 种子数据
-- ============================================================================

-- 驿站 / 店铺（含坐标，让地图能显示）
INSERT INTO `station` (`id`, `name`, `type`, `campus`, `lng`, `lat`, `sort`, `status`) VALUES
  ('st_001', '菜鸟驿站(3号楼店)', 1, '东校区', 113.335000, 23.155000, 1, 1),
  ('st_002', '丰巢快递柜(南门)',  2, '东校区', 113.336500, 23.153800, 2, 1),
  ('st_003', '顺丰(西区)',        1, '西校区', 113.330200, 23.156700, 3, 1),
  ('st_004', '菜鸟驿站(西区)',    1, '西校区', 113.331000, 23.156000, 4, 1),
  ('st_005', '第一食堂',          3, '东校区', 113.334200, 23.154500, 5, 1),
  ('st_006', '沙县小吃',          4, '东校区', 113.334800, 23.154100, 6, 1),
  ('st_007', '麻辣烫(二食堂)',    4, '东校区', 113.335400, 23.153600, 7, 1)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

-- 楼栋（含坐标，让收件地图能显示）
INSERT INTO `building` (`id`, `name`, `campus`, `lng`, `lat`, `sort`, `status`) VALUES
  ('bd_001', '1号楼',  '东校区', 113.334500, 23.154800, 1, 1),
  ('bd_002', '2号楼',  '东校区', 113.335100, 23.154300, 2, 1),
  ('bd_003', '3号楼',  '东校区', 113.335700, 23.153800, 3, 1),
  ('bd_004', '4号楼',  '东校区', 113.336300, 23.153300, 4, 1),
  ('bd_005', '5号楼',  '东校区', 113.336900, 23.152800, 5, 1),
  ('bd_006', '6号楼',  '东校区', 113.337500, 23.152300, 6, 1),
  ('bd_007', '图书馆', '东校区', 113.333800, 23.155200, 7, 1),
  ('bd_008', '一食堂', '东校区', 113.334200, 23.154500, 8, 1)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

-- ============================================================================
-- 脚本结束
-- 校验：
--   SHOW TABLES;                          -- 期望 10 张表
--   SELECT COUNT(*) FROM station;         -- 期望 7
--   SELECT COUNT(*) FROM building;        -- 期望 8
-- ============================================================================
