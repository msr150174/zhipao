-- ============================================================================
-- V4 存储过程改造：OUT 参数 → SELECT 返回集
-- ----------------------------------------------------------------------------
-- 为什么改：
--   MyBatis 用 @Param 传参时无法正确绑定 OUT 参数
--   （#{x, mode=OUT} 与 @Param 混用不生效，日志显示 session 提前关闭）
--   表现：接单/完成/提现/评价/审核 全部报「操作失败」。
--
-- 改法：
--   去掉 OUT 参数，改用 SELECT 返回一行结果。
--   MyBatis 用 @Select + Map 接收，稳定可靠。
--
-- 同时保留：SIGNAL SQLSTATE '45000' 抛业务错误
-- ============================================================================

SET NAMES utf8mb4;

DROP PROCEDURE IF EXISTS `accept_order_atomic`;
DROP PROCEDURE IF EXISTS `complete_order_atomic`;
DROP PROCEDURE IF EXISTS `withdraw_atomic`;
DROP PROCEDURE IF EXISTS `evaluate_order_atomic`;
DROP PROCEDURE IF EXISTS `approve_runner_atomic`;
DROP PROCEDURE IF EXISTS `reject_runner_atomic`;

DELIMITER $$

-- ============================ 1. 接单 ============================
-- 返回: result
CREATE PROCEDURE `accept_order_atomic`(
  IN p_order_id      VARCHAR(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_zh_0900_as_cs,
  IN p_runner_id     VARCHAR(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_zh_0900_as_cs,
  IN p_runner_name   VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_zh_0900_as_cs,
  IN p_runner_credit INT
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

  SELECT 'ACCEPTED' AS result;
END$$

-- ============================ 2. 完成订单 ============================
-- 返回: result, reward, runner_id
CREATE PROCEDURE `complete_order_atomic`(
  IN p_order_id VARCHAR(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_zh_0900_as_cs,
  IN p_actor_id VARCHAR(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_zh_0900_as_cs
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

  SELECT 'COMPLETED' AS result, v_reward AS reward, v_runner AS runner_id;
END$$

-- ============================ 3. 提现 ============================
-- 返回: result, new_balance, apply_no
CREATE PROCEDURE `withdraw_atomic`(
  IN p_user_id  VARCHAR(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_zh_0900_as_cs,
  IN p_amount   DECIMAL(12,2),
  IN p_apply_no VARCHAR(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_zh_0900_as_cs,
  IN p_idem_key VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_zh_0900_as_cs
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

  SELECT 'OK' AS result, (v_balance - p_amount) AS new_balance, p_apply_no AS apply_no;
END$$

-- ============================ 4. 评价 ============================
-- 返回: result, credit_delta
CREATE PROCEDURE `evaluate_order_atomic`(
  IN p_order_id     VARCHAR(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_zh_0900_as_cs,
  IN p_evaluator_id VARCHAR(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_zh_0900_as_cs,
  IN p_target_id    VARCHAR(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_zh_0900_as_cs,
  IN p_score        SMALLINT,
  IN p_comment      VARCHAR(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_zh_0900_as_cs
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

  SELECT 'OK' AS result, v_delta AS credit_delta;
END$$

-- ============================ 5. 审核通过 ============================
-- 返回: result, user_id
CREATE PROCEDURE `approve_runner_atomic`(
  IN p_app_id      BIGINT,
  IN p_reviewer_id VARCHAR(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_zh_0900_as_cs
)
COMMENT '审核通过跑腿员入驻'
BEGIN
  DECLARE v_status   SMALLINT;
  DECLARE v_user     VARCHAR(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_zh_0900_as_cs;
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

  SELECT 'OK' AS result, v_user AS user_id;
END$$

-- ============================ 6. 审核驳回 ============================
-- 返回: result
CREATE PROCEDURE `reject_runner_atomic`(
  IN p_app_id      BIGINT,
  IN p_reviewer_id VARCHAR(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_zh_0900_as_cs,
  IN p_reason      VARCHAR(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_zh_0900_as_cs
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

  SELECT 'OK' AS result;
END$$

DELIMITER ;

-- 验证
SELECT ROUTINE_NAME FROM information_schema.ROUTINES
WHERE ROUTINE_SCHEMA = DATABASE() AND ROUTINE_TYPE = 'PROCEDURE'
ORDER BY ROUTINE_NAME;
