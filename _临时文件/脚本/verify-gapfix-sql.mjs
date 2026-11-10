import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SQL = readFileSync(
  join(HERE, '易援小程序', '补丁-v3', 'db', '001_pre-conversion-gap-fix.sql'),
  'utf8',
);

let pass = 0, fail = 0;
const check = (n, ok, d = '') => {
  if (ok) { pass++; console.log(`  [OK]   ${n}`); }
  else { fail++; console.log(`  [FAIL] ${n}${d ? ' -> ' + d : ''}`); }
};

console.log('='.repeat(76));
console.log('§ 转化前缺口修复 SQL —— 静态校验');
console.log('='.repeat(76));

console.log('\n### 1. 结构完整性');
const dollars = (SQL.match(/\$\$/g) || []).length;
check('$$ 成对', dollars % 2 === 0, `${dollars} 次`);

const ob = (SQL.match(/\(/g) || []).length;
const cb = (SQL.match(/\)/g) || []).length;
check('圆括号配平', ob === cb, `${ob}/${cb}`);

const quotes = (SQL.match(/'/g) || []).length;
check('单引号成对', quotes % 2 === 0, `${quotes} 个`);

console.log('\n### 2. 常见 SQL 笔误（防「表名.表名.列名」类错误）');
// 检测 ALTER COLUMN 后面是否误写了 表名.列名
const badAlter = [...SQL.matchAll(/ALTER\s+COLUMN\s+(\w+)\.(\w+)/gi)];
check('无 ALTER COLUMN 表名.列名 笔误', badAlter.length === 0,
  badAlter.map((m) => m[0]).join(', '));

// 检测 UPDATE 里是否有 表名.表名
const badQual = [...SQL.matchAll(/\b(\w+)\.\1\./g)];
check('无 表名.表名. 重复限定', badQual.length === 0,
  badQual.map((m) => m[0]).join(', '));

console.log('\n### 3. 幂等性');
const bareCreateTable = (SQL.match(/CREATE\s+TABLE(?!\s+IF\s+NOT\s+EXISTS)/gi) || []).length;
check('CREATE TABLE 均带 IF NOT EXISTS', bareCreateTable === 0, `${bareCreateTable} 处裸建表`);
const bareCreateIdx = (SQL.match(/CREATE\s+(?:UNIQUE\s+)?INDEX(?!\s+IF\s+NOT\s+EXISTS)/gi) || []).length;
check('CREATE INDEX 均带 IF NOT EXISTS', bareCreateIdx === 0, `${bareCreateIdx} 处`);
check('ALTER ADD COLUMN 用 IF NOT EXISTS',
  (SQL.match(/ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS/gi) || []).length >= 7,
  `${(SQL.match(/ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS/gi) || []).length} 处`);
check('CONSTRAINT 先 DROP IF EXISTS 再加', /DROP CONSTRAINT IF EXISTS[\s\S]{0,200}ADD\s+CONSTRAINT/i.test(SQL));
check('种子数据用 ON CONFLICT', (SQL.match(/ON CONFLICT/gi) || []).length >= 2);

console.log('\n### 4. 修复内容覆盖');
const need = [
  ['建 station 表', /CREATE TABLE IF NOT EXISTS station/],
  ['建 building 表', /CREATE TABLE IF NOT EXISTS building/],
  ['建 location_cache 表', /CREATE TABLE IF NOT EXISTS location_cache/],
  ['orders 补 station_id', /ADD COLUMN IF NOT EXISTS station_id/],
  ['orders 补 building_id', /ADD COLUMN IF NOT EXISTS building_id/],
  ['orders 补 shop_no', /ADD COLUMN IF NOT EXISTS shop_no/],
  ['orders 补 distance_updated_at', /ADD COLUMN IF NOT EXISTS distance_updated_at/],
  ['orders 补 version', /ADD COLUMN IF NOT EXISTS version/],
  ['package_size 类型转换', /package_size TYPE smallint/],
  ['package_size 加 CHECK', /orders_size_chk CHECK \(package_size IN \(1,2,3\)\)/],
  ['reward 精度提升', /reward TYPE numeric\(12,2\)/],
  ['信用分默认 60', /credit_score SET DEFAULT 60/],
  ['transactions 补 status', /ADD COLUMN IF NOT EXISTS status/],
  ['transactions 补 idempotency_key', /ADD COLUMN IF NOT EXISTS idempotency_key/],
  ['accept_order_atomic 函数', /FUNCTION accept_order_atomic/],
  ['种子：驿站 5 条', /\('菜鸟驿站\(3号楼店\)'/],
  ['种子：楼栋', /\('1号楼', '东校区', 1\)/],
  ['含端到端自检', /ROLLBACK_SELFTEST/],
];
for (const [n, re] of need) check(n, re.test(SQL));

console.log('\n### 5. 与 geo.service.ts 字段对齐');
const geoCols = ['query_text', 'lng', 'lat', 'hit_count', 'confidence', 'provider', 'raw_response'];
const lcBlock = SQL.match(/CREATE TABLE IF NOT EXISTS location_cache \(([\s\S]*?)\n\);/);
check('location_cache 块可解析', !!lcBlock);
if (lcBlock) {
  const missing = geoCols.filter((c) => !new RegExp(`\\b${c}\\b`).test(lcBlock[1]));
  check('location_cache 含 geo.service 所需全部列', missing.length === 0, missing.join(','));
}
const stationBlock = SQL.match(/CREATE TABLE IF NOT EXISTS station \(([\s\S]*?)\n\);/);
if (stationBlock) {
  const missing = ['id', 'name', 'lng', 'lat'].filter((c) => !new RegExp(`\\b${c}\\b`).test(stationBlock[1]));
  check('station 含 geo.service 所需全部列', missing.length === 0, missing.join(','));
}

console.log('\n' + '='.repeat(76));
console.log(`结果：通过 ${pass} 项，失败 ${fail} 项`);
console.log('='.repeat(76));
process.exit(fail === 0 ? 0 : 1);
