/**
 * 业务页面专项扫描（排除 components/ui 组件库）
 *
 * 组件库里的 shadcn 默认值（如 min-w-[96px]）不是业务 bug，
 * 真正影响体验的是页面级问题，这里单独列出并给出证据行。
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, 'projects');
const PAGES = join(ROOT, 'src', 'pages');

function walk(d, out = []) {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx$/.test(e)) out.push(p);
  }
  return out;
}

const RULES = [
  {
    id: 'A',
    name: 'Text 缺 block 类',
    why: '垂直排列的 Text 在 H5 是 inline，可能导致换行失效或白屏（AGENTS.md 明文要求）',
    test: (l) => /<Text[^>]*className="/.test(l) && !/\bblock\b/.test(l) && !/\binline\b/.test(l),
  },
  {
    id: 'B',
    name: 'fixed + bottom-0（Tailwind 类）',
    why: 'H5 下 Tailwind fixed 失效，且 bottom-0 会被 TabBar 遮挡；应改 inline style 且 bottom>=50',
    test: (l) => /className="[^"]*\bfixed\b[^"]*\bbottom-0\b/.test(l),
  },
  {
    id: 'C',
    name: '手搓按钮（View 充当 Button）',
    why: 'AGENTS.md 要求用 @/components/ui/button，禁止 View+Tailwind 手搓',
    test: (l) => /<View[^>]*className="[^"]*(rounded[^"]*bg-primary|bg-primary[^"]*rounded)[^"]*"[^>]*onClick/.test(l),
  },
  {
    id: 'D',
    name: '硬编码 px 任意值',
    why: 'AGENTS.md 禁止 w-[340px]，跨端单位转换会不一致',
    test: (l) => /\[[0-9.]+px\]/.test(l),
  },
  {
    id: 'E',
    name: 'fixed 未避开 TabBar（bottom < 50）',
    why: '底部固定元素应留出 TabBar 高度（56）空间，否则被遮挡',
    test: (l) => /position:\s*['"]fixed['"]/.test(l) && /bottom:\s*[0-4]?\d\b/.test(l) && !/bottom:\s*(5\d|[6-9]\d|\d{3})/.test(l),
  },
  {
    id: 'F',
    name: '原生 Input 未包 View',
    why: 'H5 端 Input 是 inline 元素，样式类应放外层 View',
    test: (l) => /<Input[^>]*className="[^"]*(bg-|rounded|border|px-|py-)/.test(l),
  },
  {
    id: 'G',
    name: '原生 Textarea 未包 View',
    why: '同 Input，H5 端样式需外层容器承载',
    test: (l) => /<Textarea[^>]*className="[^"]*(bg-|rounded|border|px-|py-)/.test(l),
  },
  {
    id: 'H',
    name: '直接使用 Taro.request/fetch',
    why: '应统一走 Network.request，否则域名拼接失效',
    test: (l) => /Taro\.(request|uploadFile|downloadFile)\s*\(/.test(l) || /(^|\s)fetch\s*\(/.test(l),
  },
];

const files = walk(PAGES);
const rows = [];
let total = 0;

for (const f of files) {
  const lines = readFileSync(f, 'utf8').split('\n');
  const rel = relative(ROOT, f).replace(/\\/g, '/');
  const hits = {};
  const samples = {};
  lines.forEach((raw, i) => {
    const t = raw.trim();
    if (!t || t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return;
    for (const r of RULES) {
      if (r.test(raw)) {
        hits[r.id] = (hits[r.id] || 0) + 1;
        (samples[r.id] ??= []).push({ line: i + 1, code: t.slice(0, 88) });
        total++;
      }
    }
  });
  rows.push({ rel, hits, samples });
}

console.log('='.repeat(80));
console.log(`业务页面扫描：${files.length} 个页面，命中 ${total} 处`);
console.log('='.repeat(80));

console.log('\n### 按页面汇总\n');
const head = '页面'.padEnd(30) + RULES.map((r) => r.id.padStart(4)).join('');
console.log(head);
console.log('-'.repeat(head.length));
for (const row of rows) {
  const cells = RULES.map((r) => String(row.hits[r.id] || 0).padStart(4)).join('');
  console.log(row.rel.padEnd(30) + cells);
}

console.log('\n### 规则说明\n');
for (const r of RULES) {
  const n = rows.reduce((s, x) => s + (x.hits[r.id] || 0), 0);
  console.log(`${r.id}. ${r.name}  —— ${n} 处`);
  console.log(`   ${r.why}`);
}

console.log('\n### 明细（每规则最多列 8 条）\n');
for (const r of RULES) {
  const all = [];
  for (const row of rows) {
    for (const s of row.samples[r.id] || []) all.push({ file: row.rel, ...s });
  }
  if (!all.length) continue;
  console.log(`--- ${r.id}. ${r.name} (${all.length}) ---`);
  for (const x of all.slice(0, 8)) {
    console.log(`  ${x.file}:${x.line}`);
    console.log(`      ${x.code}`);
  }
  if (all.length > 8) console.log(`  ... 另有 ${all.length - 8} 处`);
  console.log();
}
