import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const V6 = join(HERE, '_分析-智跑校园-v6', 'projects');

console.log('='.repeat(80));
console.log('v6 全量核查：接单链路 + 需求盘点');
console.log('='.repeat(80));

const svc = readFileSync(join(V6, 'server/src/orders/orders.service.ts'), 'utf8');
const sql = readFileSync(join(V6, 'db/001_init_and_fix.sql'), 'utf8');

console.log('\n### A. 接单链路：schema.ts 定义的列 vs 数据库实际建表列');
const schemaTs = readFileSync(join(V6, 'server/src/storage/database/shared/schema.ts'), 'utf8');
const ordersBlock = schemaTs.match(/export const orders = pgTable\(([\s\S]*?)\n\);/);
const schemaCols = ordersBlock
  ? [...ordersBlock[1].matchAll(/^\s*(\w+):\s*(?:varchar|integer|numeric|boolean|timestamp|jsonb|smallint|bigint|serial)\("(\w+)"/gm)].map((m) => m[2])
  : [];
console.log(`  schema.ts orders 定义 ${schemaCols.length} 列`);

// 从 SQL 的 CREATE TABLE orders 提列
const ctMatch = sql.match(/CREATE TABLE IF NOT EXISTS orders \(([\s\S]*?)\n  \);/);
const sqlCols = ctMatch
  ? ctMatch[1].split('\n').map((l) => l.trim()).filter((l) => /^\w+\s+/.test(l) && !/^--/.test(l)).map((l) => l.split(/\s+/)[0])
  : [];
console.log(`  SQL CREATE TABLE 定义 ${sqlCols.length} 列`);

// SQL 里 ALTER 补的列
const alterCols = [...sql.matchAll(/ALTER TABLE orders\s+ADD COLUMN IF NOT EXISTS (\w+)/g)].map((m) => m[1]);
console.log(`  SQL ALTER 补列 ${alterCols.length} 个: ${alterCols.join(', ')}`);

const allSqlCols = new Set([...sqlCols, ...alterCols]);
const missingInSql = schemaCols.filter((c) => !allSqlCols.has(c));
console.log(`\n  ⚠️ schema.ts 有但数据库脚本没有的列 (${missingInSql.length}):`);
console.log(`     ${missingInSql.join(', ') || '（无）'}`);

console.log('\n### B. 服务层读取的列 vs OrderRow 接口声明');
const orderRowMatch = svc.match(/interface OrderRow \{([\s\S]*?)\n\}/);
const orderRowFields = orderRowMatch
  ? [...orderRowMatch[1].matchAll(/^\s*(\w+)[?]?\s*:/gm)].map((m) => m[1])
  : [];
console.log(`  OrderRow 声明 ${orderRowFields.length} 个字段`);

// service 里访问的 row.xxx
const rowAccess = [...new Set([...svc.matchAll(/\brow\.(\w+)/g)].map((m) => m[1]))];
const notDeclared = rowAccess.filter((f) => !orderRowFields.includes(f));
console.log(`  service 访问 row.* 共 ${rowAccess.length} 个不同字段`);
console.log(`  ⚠️ 访问了但 OrderRow 未声明的 (${notDeclared.length}):`);
console.log(`     ${notDeclared.join(', ') || '（无）'}`);

console.log('\n### C. RPC 函数 vs 服务调用参数');
const rpcCalls = [...svc.matchAll(/rpc\('(\w+)',\s*\{([\s\S]*?)\}\)/g)];
for (const [, fn, argsBlock] of rpcCalls) {
  const passed = [...argsBlock.matchAll(/(\w+):/g)].map((m) => m[1]).sort();
  const fnDef = sql.match(new RegExp(`CREATE OR REPLACE FUNCTION ${fn}\\(([\\s\\S]*?)\\)\\s*RETURNS`, 'i'));
  const declared = fnDef
    ? fnDef[1].split(',').map((p) => p.trim().split(/\s+/)[0]).filter(Boolean).sort()
    : [];
  const mismatch = [
    ...passed.filter((p) => !declared.includes(p)),
    ...declared.filter((d) => !passed.includes(d)),
  ];
  console.log(`  ${fn}:`);
  console.log(`    调用传参 ${passed.length}: ${passed.join(', ')}`);
  console.log(`    函数声明 ${declared.length}: ${declared.join(', ')}`);
  console.log(`    ${mismatch.length === 0 ? '✅ 完全匹配' : '❌ 不匹配: ' + mismatch.join(', ')}`);
}

console.log('\n### D. 数据库脚本清单');
const dbDir = join(V6, 'db');
if (existsSync(dbDir)) {
  for (const f of readdirSync(dbDir)) {
    const s = readFileSync(join(dbDir, f), 'utf8');
    const fns = [...s.matchAll(/CREATE OR REPLACE FUNCTION (\w+)/g)].map((m) => m[1]);
    const tables = [...s.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g)].map((m) => m[1]);
    console.log(`  ${f}`);
    console.log(`     表: ${tables.join(', ') || '—'}`);
    console.log(`     函数: ${fns.join(', ') || '—'}`);
  }
}

console.log('\n### E. 本次新增需求：缺哪些页面');
const pages = readdirSync(join(V6, 'src/pages'));
const needed = {
  '登录（手机号验证码）': ['login'],
  '跑腿员入驻申请': ['runner-apply', 'apply-runner', 'runner'],
  '信用分规则说明': ['credit-rule', 'credit-rules'],
  '关于我们': ['about'],
  '用户协议': ['agreement', 'terms'],
  '隐私政策': ['privacy'],
  '手机号绑定': ['bind-phone', 'phone'],
};
for (const [name, candidates] of Object.entries(needed)) {
  const found = candidates.filter((c) => pages.includes(c));
  console.log(`  ${found.length ? '✅' : '❌'} ${name.padEnd(18)} ${found.length ? found.join(', ') : '（缺）'}`);
}
console.log(`\n  现有页面: ${pages.join(', ')}`);

console.log('\n### F. 取餐模拟数据');
// 找种子数据里 delivery_type = 2 的记录
const seeds = sql.match(/INSERT INTO orders[\s\S]*?;/gi) || [];
let mealSeed = 0;
for (const s of seeds) {
  const matches = s.match(/,\s*2\s*,/g) || [];
  mealSeed += matches.length;
}
console.log(`  SQL 里 orders 的 INSERT 语句 ${seeds.length} 条`);
console.log(`  ${mealSeed > 0 ? '✅' : '❌'} 疑似取餐(delivery_type=2)种子数据: ${mealSeed} 处`);
if (seeds.length) {
  console.log(`  首条 INSERT 片段: ${seeds[0].slice(0, 120).replace(/\s+/g, ' ')}...`);
}

console.log('\n### G. 浮窗位置是否固定（每页一致性）');
let floating = [];
for (const p of pages) {
  const f = join(V6, 'src/pages', p, 'index.tsx');
  if (!existsSync(f)) continue;
  const s = readFileSync(f, 'utf8');
  const fa = s.match(/<FloatingAssistant[^>]*\/>/);
  const fab = s.match(/position:\s*'fixed'[^}]*bottom:\s*(\d+)/);
  if (fa || fab) floating.push({ p, fa: fa?.[0] ?? '—', bottom: fab?.[1] ?? '—' });
}
for (const f of floating) console.log(`  ${f.p.padEnd(14)} ${f.fa}  bottom=${f.bottom}`);
console.log(`  共 ${floating.length} 个页面有浮窗`);

console.log('\n### H. 头部样式统一性（各页 h-14 容器）');
for (const p of pages) {
  const f = join(V6, 'src/pages', p, 'index.tsx');
  if (!existsSync(f)) continue;
  const s = readFileSync(f, 'utf8');
  const headers = [...s.matchAll(/<View className="([^"]*h-1[0-9][^"]*)"/g)].map((m) => m[1]);
  if (headers.length) {
    console.log(`  ${p.padEnd(14)} ${headers.map((h) => h.slice(0, 60)).join(' | ')}`);
  }
}
