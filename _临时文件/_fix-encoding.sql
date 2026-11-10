-- ============================================================================
-- 修正早期测试订单的乱码中文
-- ----------------------------------------------------------------------------
-- 背景：
--   早期用 PowerShell + Invoke-RestMethod 发请求时，中文被按系统编码(GBK)处理，
--   存进数据库后变成三重编码乱码（HEX 形如 C3A8C28FC29C...），不可逆还原。
--
--   本次按订单的业务含义写回正确文本：
--     取件点均为「菜鸟驿站(3号楼店)」；送达楼栋按 room_no 对应。
--
-- 仅影响测试数据，不影响正常流程。
-- ============================================================================

SET NAMES utf8mb4;

-- ---------- 修正前 ----------
SELECT order_no, station_name, building_name, room_no
FROM orders
WHERE HEX(station_name) LIKE '%C3A8%'
ORDER BY created_at DESC;

-- ---------- 逐条修正 ----------
-- DNNY1A: 取件=菜鸟驿站(3号楼店)，送达=1号楼 305
UPDATE orders
SET station_name  = '菜鸟驿站(3号楼店)',
    building_name = '1号楼'
WHERE order_no = 'ZP261012DNNY1A';

-- S7U299: 取件=菜鸟驿站(3号楼店)，送达=1号楼 401
UPDATE orders
SET station_name  = '菜鸟驿站(3号楼店)',
    building_name = '1号楼'
WHERE order_no = 'ZP261012S7U299';

-- 15ZD71: 取件=菜鸟驿站(3号楼店)，送达=1号楼
UPDATE orders
SET station_name  = '菜鸟驿站(3号楼店)',
    building_name = '1号楼'
WHERE order_no = 'ZP26101215ZD71';

-- 3VEU9U: 同上
UPDATE orders
SET station_name  = '菜鸟驿站(3号楼店)',
    building_name = '1号楼'
WHERE order_no = 'ZP2610123VEU9U';

-- 8X2YYD: 同上
UPDATE orders
SET station_name  = '菜鸟驿站(3号楼店)',
    building_name = '1号楼'
WHERE order_no = 'ZP2610128X2YYD';

-- ---------- 修正后校验 ----------
SELECT
    order_no,
    station_name,
    building_name,
    CASE WHEN HEX(station_name) LIKE '%C3A8%' THEN 'STILL-BAD' ELSE 'OK' END AS status
FROM orders
ORDER BY created_at DESC;
