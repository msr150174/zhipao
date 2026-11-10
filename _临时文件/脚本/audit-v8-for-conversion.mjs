import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const P = join(HERE, '_分析-智跑校园-v8', 'projects');
const S = join(P, 'server', 'src');

console.log('='.repeat(84));
console.log('v8 工程全量盘点（Java 转换的输入清单）');
console.log('='.repeat(84));

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

// ── 1. 后端模块与文件 ──
console.log('\n### 1. 后端模块（server/src）');
const mods = readdirSync(S).filter((f) => statSync(join(S, f)).isDirectory());
for (const m of mods) {
  const files = walk(join(S, m)).map((f) => relative(join(S, m), f).replace(/\\/g, '/'));
  console.log(`  ${m}/  (${files.length})`);
  console.log(`      ${files.join(', ')}`);
}
const rootFiles = readdirSync(S).filter((f) => f.endsWith('.ts'));
console.log(`  [root] ${rootFiles.join(', ')}`);

// ── 2. 后端全部路由 ──
console.log('\n### 2. 后端全部路由（API 契约）');
const routes = [];
for (const f of walk(S)) {
  if (!f.endsWith('.controller.ts')) continue;
  const s = readFileSync(f, 'utf8');
  const base = s.match(/@Controller\(['"]([^'"]*)['"]\)/)?.[1] ?? '';
  const guards = /@UseGuards\(([^)]*)\)/.exec(s)?.[1]?.trim() ?? '';
  for (const m of s.matchAll(/@(Get|Post|Put|Patch|Delete)\((['"]?)([^'")]*)\2\)/g)) {
    routes.push({
      method: m[1].toUpperCase(),
      path: `/api/${base}${m[3] ? '/' + m[3].replace(/^\//, '') : ''}`,
      file: relative(S, f).replace(/\\/g, '/'),
      guards,
    });
  }
}
routes.sort((a, b) => a.path.localeCompare(b.path));
for (const r of routes) {
  console.log(`  ${r.method.padEnd(6)} ${r.path.padEnd(46)} ${r.guards ? '[guard]' : ''}`);
}
console.log(`  合计 ${routes.length} 个路由`);

// ── 3. 数据库表（从 schema.ts） ──
console.log('\n### 3. 数据库表（schema.ts）');
const schemaPath = join(S, 'storage/database/shared/schema.ts');
if (existsSync(schemaPath)) {
  const sc = readFileSync(schemaPath, 'utf8');
  const tables = [...sc.matchAll(/export const (\w+) = pgTable\(\s*["'](\w+)["']/g)];
  for (const [, varName, tableName] of tables) {
    // 提取该表的字段
    const start = sc.indexOf(`export const ${varName} = pgTable`);
    const seg = sc.slice(start, start + 6000);
    const end = seg.indexOf('\n);');
    const block = end > 0 ? seg.slice(0, end) : seg;
    const cols = [...block.matchAll(/^\s*(\w+):\s*(?:\w+)\("(\w+)"/gm)].map((m) => m[2]);
    console.log(`  ${tableName} (${cols.length} 列)`);
    console.log(`      ${cols.join(', ')}`);
  }
  console.log(`  合计 ${tables.length} 张表`);
} else {
  console.log('  ❌ schema.ts 不存在');
}

// ── 4. 前端页面 ──
console.log('\n### 4. 前端页面（src/pages）');
const pagesDir = join(P, 'src/pages');
const pages = existsSync(pagesDir) ? readdirSync(pagesDir).filter((d) => statSync(join(pagesDir, d)).isDirectory()) : [];
for (const pg of pages) {
  const f = join(pagesDir, pg, 'index.tsx');
  const lines = existsSync(f) ? readFileSync(f, 'utf8').split('\n').length : 0;
  console.log(`  ${pg.padEnd(16)} ${String(lines).padStart(4)} 行`);
}
console.log(`  合计 ${pages.length} 个页面`);

// ── 5. 前端 API 层（转换时的对接契约） ──
console.log('\n### 5. 前端 API 层（services/api.ts 调用的接口）');
const apiPath = join(P, 'src/services/api.ts');
if (existsSync(apiPath)) {
  const api = readFileSync(apiPath, 'utf8');
  const calls = [...api.matchAll(/url:\s*[`'"]([^`'"]+)[`'"]/g)].map((m) => m[1]);
  const uniq = [...new Set(calls)].sort();
  for (const c of uniq) console.log(`  ${c}`);
  console.log(`  合计 ${uniq.length} 个接口调用`);
}

// ── 6. 未提取到的表（routes 用到但 schema 没有） ──
console.log('\n### 6. 代码里用到的表名（from(\'xxx\')）');
const usedTables = new Set();
for (const f of walk(S)) {
  const s = readFileSync(f, 'utf8');
  for (const m of s.matchAll(/\.from\(['"](\w+)['"]\)/g)) usedTables.add(m[1]);
  for (const m of s.matchAll(/rpc\(['"](\w+)['"]/g)) usedTables.add(`RPC:${m[1]}`);
}
console.log('  ' + [...usedTables].sort().join(', '));

console.log('\n' + '='.repeat(84));
console.log(`盘点完成：${routes.length} 路由 · ${pages.length} 页面`);
console.log('='.repeat(84));
