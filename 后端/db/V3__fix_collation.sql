-- ============================================================================
-- V3 修复排序规则冲突
-- ----------------------------------------------------------------------------
-- 问题：
--   数据库 xyzp 的默认排序规则是 utf8mb4_zh_0900_as_cs，
--   但 V1 建表时硬编码了 COLLATE=utf8mb4_general_ci，
--   而存储过程的参数会继承【数据库默认】排序规则。
--   两者比较时 MySQL 报错：
--     ERROR 1267: Illegal mix of collations
--       (utf8mb4_general_ci, IMPLICIT) and (utf8mb4_zh_0900_as_cs, IMPLICIT)
--       for operation '='
--   表现为：接单/完成/提现/评价/审核 等所有走存储过程的操作全部失败。
--
-- 修复策略：
--   把所有表的排序规则统一改成【数据库默认值】，
--   这样表列与存储过程参数就一致了。
--
-- 执行方式：
--   mysql -u root -p xyzp < V3__fix_collation.sql
-- ============================================================================

SET NAMES utf8mb4;

-- ----------------------------------------------------------------------------
-- 1. 查当前数据库默认排序规则（执行时请留意输出）
-- ----------------------------------------------------------------------------
SELECT
    SCHEMA_NAME                 AS db_name,
    DEFAULT_CHARACTER_SET_NAME  AS charset,
    DEFAULT_COLLATION_NAME      AS collation
FROM information_schema.SCHEMATA
WHERE SCHEMA_NAME = DATABASE();

-- ----------------------------------------------------------------------------
-- 2. 列出修复前的冲突情况
-- ----------------------------------------------------------------------------
SELECT
    TABLE_NAME      AS tbl,
    TABLE_COLLATION AS current_collation
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_COLLATION <> (
        SELECT DEFAULT_COLLATION_NAME FROM information_schema.SCHEMATA
        WHERE SCHEMA_NAME = DATABASE())
ORDER BY TABLE_NAME;

-- ----------------------------------------------------------------------------
-- 3. 逐表改排序规则，统一为数据库默认值
--
--    说明：CONVERT TO CHARACTER SET 会重建表并转换数据编码，
--          因源和目标都是 utf8mb4，数据内容不会变化，只改排序规则。
-- ----------------------------------------------------------------------------
ALTER TABLE `users`              CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_zh_0900_as_cs;
ALTER TABLE `orders`             CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_zh_0900_as_cs;
ALTER TABLE `credit_records`     CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_zh_0900_as_cs;
ALTER TABLE `transactions`       CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_zh_0900_as_cs;
ALTER TABLE `station`            CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_zh_0900_as_cs;
ALTER TABLE `building`           CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_zh_0900_as_cs;
ALTER TABLE `location_cache`     CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_zh_0900_as_cs;
ALTER TABLE `evaluation`         CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_zh_0900_as_cs;
ALTER TABLE `runner_application` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_zh_0900_as_cs;
ALTER TABLE `health_check`       CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_zh_0900_as_cs;

-- ----------------------------------------------------------------------------
-- 4. 重建触发器（排序规则同步）
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- 5. 重建 6 个存储过程
--    ★ 关键：参数显式声明 CHARACTER SET utf8mb4 COLLATE utf8mb4_zh_0900_as_cs，
--      与表列保持一致，彻底消除排序规则冲突。
-- ----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS `accept_order_atomic`;
DROP PROCEDURE IF EXISTS `complete_order_atomic`;
DROP PROCEDURE IF EXISTS `withdraw_atomic`;
DROP PROCEDURE IF EXISTS `evaluate_order_atomic`;
DROP PROCEDURE IF EXISTS `approve_runner_atomic`;
DROP PROCEDURE IF EXISTS `reject_runner_atomic`;

DELIMITER $$

-- ============================ 1. 接单 ============================
CREATE PROCEDURE `accept_order_atomic`(
  IN  p_order_id      VARCHAR(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_zh_0900_as_cs,
  IN  p_runner_id     VARCHAR(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_zh_0900_as_cs,
  IN  p_runner_name   VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_zh_0900_as_cs,
  IN  p_runner_credit INT,
  OUT p_result        VARCHAR(24) CHARACTER SET utf8mb4 COLLATE utf8mb4_zh_0900_as_cs
)
COMMENT '接单原子操作'
BEGIN
  DECLARE v_affected INT DEFAULT 0;
  DECLARE v_exists   INT DEFAULT 0;
  DECLARE v_is_owner INT DEFAULT 0;

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  START TRANSACTION;

  UPDATE `orders`
     SET `status`        = 'ACCEPTED',
         `runner_id`     = p_runner_id,
         `runner_name`   = p_runner_name,
         `runner_credit` = p_runner_credit,
         `accepted_at`   = NOW(3),
         `version`       = `version` + 1,
         `updated_at`    = NOW(3)
   WHERE `id` = p_order_id
     AND `status` = 'WAITING_ACCEPT'
     AND `publisher_id` <> p_runner_id;

  SET v_affected = ROW_COUNT();

  IF v_affected = 0 THEN
    SELECT COUNT(*) INTO v_exists FROM `orders` WHERE `id` = p_order_id;
    IF v_exists = 0 THEN
      ROLLBACK;
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'ORDER_NOT_FOUND';
    END IF;

    SELECT COUNT(*) INTO v_is_owner
      FROM `orders` WHERE `id` = p_order_id AND `publisher_id` = p_runner_id;
    IF v_is_owner > 0 THEN
      ROLLBACK;
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'CANNOT_ACCEPT_OWN_ORDER';
    END IF;

    ROLLBACK;
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'ALREADY_TAKEN';
  END IF;

  COMMIT;
  SET p_result = 'ACCEPTED';
END$$

-- ============================ 2. 完成订单 ============================
CREATE PROCEDURE `complete_order_atomic`(
  IN  p_order_id VARCHAR(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_zh_0900_as_cs,
  IN  p_actor_id VARCHAR(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_zh_0900_as_cs,
  OUT p_result   VARCHAR(24) CHARACTER SET utf8mb4 COLLATE utf8mb4_zh_0900_as_cs
)
COMMENT '确认收货并结算'
BEGIN
  DECLARE v_runner     VARCHAR(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_zh_0900_as_cs;
  DECLARE v_reward     DECIMAL(12,2);
  DECLARE v_publisher  VARCHAR(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_zh_0900_as_cs;
  DECLARE v_status     VARCHAR(24) CHARACTER SET utf8mb4 COLLATE utf8mb4_zh_0900_as_cs;
  DECLARE v_balance    DECIMAL(12,2);
  DECLARE v_income     DECIMAL(12,2);
  DECLARE v_order_no   VARCHAR(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_zh_0900_as_cs;
  DECLARE v_new_credit INT;

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  START TRANSACTION;

  SELECT `publisher_id`, `runner_id`, `reward`, `status`, `order_no`
    INTO v_publisher, v_runner, v_reward, v_status, v_order_no
    FROM `orders`
   WHERE `id` = p_order_id
   FOR UPDATE;

  IF v_publisher IS NULL THEN
    ROLLBACK;
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'ORDER_NOT_FOUND';
  END IF;

  IF v_status NOT IN ('DELIVERED','ACCEPTED','PICKING','DELIVERING') THEN
    ROLLBACK;
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'ORDER_NOT_COMPLETABLE';
  END IF;

  IF p_actor_id <> v_publisher THEN
    ROLLBACK;
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'NOT_PUBLISHER';
  END IF;

  IF v_runner IS NULL THEN
    ROLLBACK;
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'NO_RUNNER';
  END IF;

  UPDATE `orders`
     SET `status` = 'COMPLETED', `completed_at` = NOW(3),
         `version` = `version` + 1, `updated_at` = NOW(3)
   WHERE `id` = p_order_id;

  SELECT `balance`, `income` INTO v_balance, v_income
    FROM `users` WHERE `id` = v_runner FOR UPDATE;

  UPDATE `users`
     SET `balance` = `balance` + v_reward,
         `income`  = `income`  + v_reward,
         `credit_score` = LEAST(100, `credit_score` + 2),
         `updated_at` = NOW(3)
   WHERE `id` = v_runner;

  SELECT `credit_score` INTO v_new_credit FROM `users` WHERE `id` = v_runner;

  INSERT INTO `transactions` (`user_id`, `type`, `amount`, `balance`, `order_no`, `status`, `remark`)
  VALUES (v_runner, 'INCOME', v_reward, v_balance + v_reward, v_order_no, 'SUCCESS', '跑腿收入');

  INSERT INTO `credit_records` (`user_id`, `change`, `balance`, `reason`, `reason_code`, `order_no`)
  VALUES (v_runner, 2, v_new_credit, '完成一单', 'ORDER_COMPLETED', v_order_no);

  COMMIT;
  SET p_result = 'COMPLETED';
END$$

-- ============================ 3. 提现 ============================
CREATE PROCEDURE `withdraw_atomic`(
  IN  p_user_id     VARCHAR(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_zh_0900_as_cs,
  IN  p_amount      DECIMAL(12,2),
  IN  p_apply_no    VARCHAR(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_zh_0900_as_cs,
  IN  p_idem_key    VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_zh_0900_as_cs,
  OUT p_result      VARCHAR(24) CHARACTER SET utf8mb4 COLLATE utf8mb4_zh_0900_as_cs,
  OUT p_new_balance DECIMAL(12,2)
)
COMMENT '提现原子操作'
BEGIN
  DECLARE v_balance DECIMAL(12,2);
  DECLARE v_exists  INT DEFAULT 0;

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  IF p_amount <= 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'INVALID_AMOUNT';
  END IF;

  START TRANSACTION;

  SELECT COUNT(*) INTO v_exists FROM `transactions` WHERE `apply_no` = p_apply_no;
  IF v_exists > 0 THEN
    ROLLBACK;
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'DUPLICATE_APPLY';
  END IF;

  SELECT `balance` INTO v_balance FROM `users` WHERE `id` = p_user_id FOR UPDATE;

  IF v_balance IS NULL THEN
    ROLLBACK;
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'USER_NOT_FOUND';
  END IF;

  IF v_balance < p_amount THEN
    ROLLBACK;
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'INSUFFICIENT_BALANCE';
  END IF;

  UPDATE `users`
     SET `balance` = `balance` - p_amount, `updated_at` = NOW(3)
   WHERE `id` = p_user_id;

  INSERT INTO `transactions`
    (`user_id`, `type`, `amount`, `balance`, `apply_no`, `idempotency_key`, `status`, `remark`)
  VALUES
    (p_user_id, 'WITHDRAW', p_amount, v_balance - p_amount,
     p_apply_no, p_idem_key, 'PENDING', '提现申请');

  COMMIT;
  SET p_result = 'OK';
  SET p_new_balance = v_balance - p_amount;
END$$

-- ============================ 4. 评价 ============================
CREATE PROCEDURE `evaluate_order_atomic`(
  IN  p_order_id     VARCHAR(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_zh_0900_as_cs,
  IN  p_evaluator_id VARCHAR(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_zh_0900_as_cs,
  IN  p_target_id    VARCHAR(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_zh_0900_as_cs,
  IN  p_score        SMALLINT,
  IN  p_comment      VARCHAR(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_zh_0900_as_cs,
  OUT p_result       VARCHAR(24) CHARACTER SET utf8mb4 COLLATE utf8mb4_zh_0900_as_cs
)
COMMENT '订单评价'
BEGIN
  DECLARE v_order_no VARCHAR(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_zh_0900_as_cs;
  DECLARE v_status   VARCHAR(24) CHARACTER SET utf8mb4 COLLATE utf8mb4_zh_0900_as_cs;
  DECLARE v_exists   INT DEFAULT 0;
  DECLARE v_delta    INT DEFAULT 0;
  DECLARE v_new      INT;

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  IF p_score < 1 OR p_score > 5 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'INVALID_SCORE';
  END IF;

  START TRANSACTION;

  SELECT `order_no`, `status` INTO v_order_no, v_status
    FROM `orders` WHERE `id` = p_order_id FOR UPDATE;

  IF v_order_no IS NULL THEN
    ROLLBACK;
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'ORDER_NOT_FOUND';
  END IF;

  IF v_status <> 'COMPLETED' THEN
    ROLLBACK;
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'ORDER_NOT_COMPLETED';
  END IF;

  SELECT COUNT(*) INTO v_exists
    FROM `evaluation` WHERE `order_no` = v_order_no AND `from_user` = p_evaluator_id;
  IF v_exists > 0 THEN
    ROLLBACK;
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'ALREADY_EVALUATED';
  END IF;

  INSERT INTO `evaluation` (`order_no`, `from_user`, `to_user`, `score`, `comment`)
  VALUES (v_order_no, p_evaluator_id, p_target_id, p_score, p_comment);

  SET v_delta = CASE p_score WHEN 5 THEN 1 WHEN 2 THEN -1 WHEN 1 THEN -3 ELSE 0 END;

  IF v_delta <> 0 THEN
    UPDATE `users`
       SET `credit_score` = GREATEST(0, LEAST(100, `credit_score` + v_delta)),
           `updated_at` = NOW(3)
     WHERE `id` = p_target_id;

    SELECT `credit_score` INTO v_new FROM `users` WHERE `id` = p_target_id;

    INSERT INTO `credit_records` (`user_id`, `change`, `balance`, `reason`, `reason_code`, `order_no`)
    VALUES (p_target_id, v_delta, v_new,
            CASE WHEN v_delta > 0 THEN '收到好评' ELSE '收到差评' END,
            CASE WHEN v_delta > 0 THEN 'GOOD_REVIEW' ELSE 'BAD_REVIEW' END,
            v_order_no);
  END IF;

  COMMIT;
  SET p_result = 'OK';
END$$

-- ============================ 5. 审核通过 ============================
CREATE PROCEDURE `approve_runner_atomic`(
  IN  p_app_id      BIGINT,
  IN  p_reviewer_id VARCHAR(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_zh_0900_as_cs,
  OUT p_user_id     VARCHAR(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_zh_0900_as_cs,
  OUT p_result      VARCHAR(24) CHARACTER SET utf8mb4 COLLATE utf8mb4_zh_0900_as_cs
)
COMMENT '审核通过跑腿员入驻'
BEGIN
  DECLARE v_status  SMALLINT;
  DECLARE v_user    VARCHAR(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_zh_0900_as_cs;
  DECLARE v_affected INT DEFAULT 0;

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  START TRANSACTION;

  SELECT `status`, `user_id` INTO v_status, v_user
    FROM `runner_application` WHERE `id` = p_app_id FOR UPDATE;

  IF v_user IS NULL THEN
    ROLLBACK;
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'APPLICATION_NOT_FOUND';
  END IF;

  IF v_status <> 0 THEN
    ROLLBACK;
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'APPLICATION_NOT_PENDING';
  END IF;

  UPDATE `runner_application`
     SET `status` = 1, `reviewed_by` = p_reviewer_id,
         `reviewed_at` = NOW(3), `updated_at` = NOW(3)
   WHERE `id` = p_app_id AND `status` = 0;

  SET v_affected = ROW_COUNT();
  IF v_affected = 0 THEN
    ROLLBACK;
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'APPLICATION_NOT_PENDING';
  END IF;

  UPDATE `users`
     SET `is_runner` = 1, `updated_at` = NOW(3)
   WHERE `id` = v_user;

  COMMIT;
  SET p_user_id = v_user;
  SET p_result = 'OK';
END$$

-- ============================ 6. 审核驳回 ============================
CREATE PROCEDURE `reject_runner_atomic`(
  IN  p_app_id      BIGINT,
  IN  p_reviewer_id VARCHAR(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_zh_0900_as_cs,
  IN  p_reason      VARCHAR(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_zh_0900_as_cs,
  OUT p_result      VARCHAR(24) CHARACTER SET utf8mb4 COLLATE utf8mb4_zh_0900_as_cs
)
COMMENT '驳回跑腿员入驻'
BEGIN
  DECLARE v_affected INT DEFAULT 0;

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  START TRANSACTION;

  UPDATE `runner_application`
     SET `status` = 2, `reject_reason` = p_reason,
         `reviewed_by` = p_reviewer_id, `reviewed_at` = NOW(3), `updated_at` = NOW(3)
   WHERE `id` = p_app_id AND `status` = 0;

  SET v_affected = ROW_COUNT();
  IF v_affected = 0 THEN
    ROLLBACK;
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'APPLICATION_NOT_PENDING';
  END IF;

  COMMIT;
  SET p_result = 'OK';
END$$

DELIMITER ;

-- ----------------------------------------------------------------------------
-- 6. 验证：所有表排序规则应一致
-- ----------------------------------------------------------------------------
SELECT
    TABLE_NAME      AS tbl,
    TABLE_COLLATION AS collation_after
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE()
ORDER BY TABLE_NAME;

SELECT COUNT(*) AS procedure_count
FROM information_schema.ROUTINES
WHERE ROUTINE_SCHEMA = DATABASE() AND ROUTINE_TYPE = 'PROCEDURE';
