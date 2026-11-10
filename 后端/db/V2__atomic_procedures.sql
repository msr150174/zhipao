-- ============================================================================
-- 智跑校园 · MySQL 原子操作存储过程
-- ----------------------------------------------------------------------------
-- 来源：PostgreSQL 的 6 个函数 → MySQL 存储过程
--   accept_order_atomic      接单（防并发重复接单）
--   complete_order_atomic    完成订单（结算资金 + 信用分）
--   withdraw_atomic          提现（防超额提现）
--   evaluate_order_atomic    评价（写评价 + 信用分联动）
--   approve_runner_atomic    审核通过入驻（同时标记 is_runner）
--   reject_runner_atomic     审核驳回
--
-- 与原实现的差异（重要）：
--   PostgreSQL 的 RETURNS TABLE → MySQL 用 OUT 参数
--   错误用 SIGNAL SQLSTATE '45000' + MESSAGE_TEXT 传递
-- ============================================================================

SET NAMES utf8mb4;
DROP PROCEDURE IF EXISTS `accept_order_atomic`;
DROP PROCEDURE IF EXISTS `complete_order_atomic`;
DROP PROCEDURE IF EXISTS `withdraw_atomic`;
DROP PROCEDURE IF EXISTS `evaluate_order_atomic`;
DROP PROCEDURE IF EXISTS `approve_runner_atomic`;
DROP PROCEDURE IF EXISTS `reject_runner_atomic`;

DELIMITER $$

-- ============================================================================
-- 1. 接单（原子 CAS，防并发重复接单）
-- ============================================================================
CREATE PROCEDURE `accept_order_atomic`(
  IN  p_order_id      VARCHAR(40),
  IN  p_runner_id     VARCHAR(40),
  IN  p_runner_name   VARCHAR(50),
  IN  p_runner_credit INT,
  OUT p_result        VARCHAR(24)
)
COMMENT '接单原子操作'
BEGIN
  DECLARE v_affected INT DEFAULT 0;
  DECLARE v_exists   INT DEFAULT 0;
  DECLARE v_is_owner INT DEFAULT 0;

  -- 声明异常处理：回滚事务
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  START TRANSACTION;

  -- ★ 条件更新（CAS）：只有 WAITING_ACCEPT 且非自己发布才能接
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
    -- 区分三种失败原因
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

-- ============================================================================
-- 2. 完成订单（结算 + 信用分）
-- ============================================================================
CREATE PROCEDURE `complete_order_atomic`(
  IN  p_order_id VARCHAR(40),
  IN  p_actor_id VARCHAR(40),
  OUT p_result   VARCHAR(24)
)
COMMENT '确认收货并结算'
BEGIN
  DECLARE v_order      VARCHAR(40);
  DECLARE v_runner     VARCHAR(40);
  DECLARE v_reward     DECIMAL(12,2);
  DECLARE v_publisher  VARCHAR(40);
  DECLARE v_status     VARCHAR(24);
  DECLARE v_balance    DECIMAL(12,2);
  DECLARE v_income     DECIMAL(12,2);
  DECLARE v_order_no   VARCHAR(32);

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  START TRANSACTION;

  -- 锁定订单行（悲观锁，防止并发确认）
  SELECT `publisher_id`, `runner_id`, `reward`, `status`, `order_no`
    INTO v_publisher, v_runner, v_reward, v_status, v_order_no
    FROM `orders`
   WHERE `id` = p_order_id
   FOR UPDATE;

  IF v_publisher IS NULL THEN
    ROLLBACK;
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'ORDER_NOT_FOUND';
  END IF;

  IF v_status NOT IN ('DELIVERED', 'ACCEPTED', 'PICKING', 'DELIVERING') THEN
    ROLLBACK;
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'ORDER_NOT_COMPLETABLE';
  END IF;

  -- ★ 只有发布方可以确认收货
  IF p_actor_id <> v_publisher THEN
    ROLLBACK;
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'NOT_PUBLISHER';
  END IF;

  IF v_runner IS NULL THEN
    ROLLBACK;
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'NO_RUNNER';
  END IF;

  -- 订单 → COMPLETED
  UPDATE `orders`
     SET `status` = 'COMPLETED', `completed_at` = NOW(3),
         `version` = `version` + 1, `updated_at` = NOW(3)
   WHERE `id` = p_order_id;

  -- 跑腿员收款
  SELECT `balance`, `income` INTO v_balance, v_income
    FROM `users` WHERE `id` = v_runner FOR UPDATE;

  UPDATE `users`
     SET `balance` = `balance` + v_reward,
         `income`  = `income`  + v_reward,
         `credit_score` = LEAST(100, `credit_score` + 2),   -- 完成一单 +2
         `updated_at` = NOW(3)
   WHERE `id` = v_runner;

  -- 交易流水
  INSERT INTO `transactions` (`user_id`, `type`, `amount`, `balance`, `order_no`, `status`, `remark`)
  VALUES (v_runner, 'INCOME', v_reward, v_balance + v_reward, v_order_no, 'SUCCESS', '跑腿收入');

  -- 信用分记录
  INSERT INTO `credit_records` (`user_id`, `change`, `balance`, `reason`, `reason_code`, `order_no`)
  VALUES (v_runner, 2, (SELECT `credit_score` FROM `users` WHERE `id` = v_runner),
          '完成一单', 'ORDER_COMPLETED', v_order_no);

  COMMIT;
  SET p_result = 'COMPLETED';
END$$

-- ============================================================================
-- 3. 提现（防超额）
-- ============================================================================
CREATE PROCEDURE `withdraw_atomic`(
  IN  p_user_id     VARCHAR(40),
  IN  p_amount      DECIMAL(12,2),
  IN  p_apply_no    VARCHAR(40),
  IN  p_idem_key    VARCHAR(64),
  OUT p_result      VARCHAR(24),
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

  -- 幂等：同一 apply_no 只能有一条
  SELECT COUNT(*) INTO v_exists FROM `transactions` WHERE `apply_no` = p_apply_no;
  IF v_exists > 0 THEN
    ROLLBACK;
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'DUPLICATE_APPLY';
  END IF;

  -- 锁定用户行
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

-- ============================================================================
-- 4. 评价（写评价 + 信用分联动）
-- ============================================================================
CREATE PROCEDURE `evaluate_order_atomic`(
  IN  p_order_id     VARCHAR(40),
  IN  p_evaluator_id VARCHAR(40),
  IN  p_target_id    VARCHAR(40),
  IN  p_score        SMALLINT,
  IN  p_comment      VARCHAR(500),
  OUT p_result       VARCHAR(24)
)
COMMENT '订单评价'
BEGIN
  DECLARE v_order_no VARCHAR(32);
  DECLARE v_status   VARCHAR(24);
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

  -- 幂等：同一订单同一人只能评一次
  SELECT COUNT(*) INTO v_exists
    FROM `evaluation` WHERE `order_no` = v_order_no AND `from_user` = p_evaluator_id;
  IF v_exists > 0 THEN
    ROLLBACK;
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'ALREADY_EVALUATED';
  END IF;

  INSERT INTO `evaluation` (`order_no`, `from_user`, `to_user`, `score`, `comment`)
  VALUES (v_order_no, p_evaluator_id, p_target_id, p_score, p_comment);

  -- 信用分联动：5星+1 / 2星-1 / 1星-3
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

-- ============================================================================
-- 5. 审核通过入驻（同时标记 is_runner）
-- ============================================================================
CREATE PROCEDURE `approve_runner_atomic`(
  IN  p_app_id      BIGINT,
  IN  p_reviewer_id VARCHAR(40),
  OUT p_user_id     VARCHAR(40),
  OUT p_result      VARCHAR(24)
)
COMMENT '审核通过跑腿员入驻'
BEGIN
  DECLARE v_status  SMALLINT;
  DECLARE v_user    VARCHAR(40);
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

  -- ★ 同一事务内标记为跑腿员
  UPDATE `users`
     SET `is_runner` = 1, `updated_at` = NOW(3)
   WHERE `id` = v_user;

  COMMIT;
  SET p_user_id = v_user;
  SET p_result = 'OK';
END$$

-- ============================================================================
-- 6. 审核驳回
-- ============================================================================
CREATE PROCEDURE `reject_runner_atomic`(
  IN  p_app_id      BIGINT,
  IN  p_reviewer_id VARCHAR(40),
  IN  p_reason      VARCHAR(200),
  OUT p_result      VARCHAR(24)
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

-- ============================================================================
-- 校验
-- ============================================================================
-- SHOW PROCEDURE STATUS WHERE Db = DATABASE();
-- 期望 6 个存储过程
