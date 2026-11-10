/**
 * 精确版 Text block 检查
 *
 * 上一版扫描把 flex 行内的 Text 也误报为"缺 block"。
 * 实际上：flex 容器（尤其 flex-row / items-center）内的 Text 是横向排列的，
 * 加 block 反而会破坏布局。只有**垂直堆叠**的 Text 才需要 block。
 *
 * 判定方式：向上找最近的父容器 className
 *   - 含 flex-row / items-center（且不含 flex-col）→ 横向，不需要 block
 *   - 含 flex-col 或没有 flex        → 垂直，需要 block
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

/** 从第 i 行向上找最近的容器 className */
function findParentClass(lines, i) {
  for (let j = i - 1; j >= Math.max(0, i - 12); j--) {
    const m = lines[j].match(/className="([^"]+)"/);
    if (m && /<View|<Card|<ScrollView/.test(lines[j])) return m[1];
  }
  return null;
}

const need = [];
const skip = [];
let totalText = 0;

for (const f of walk(PAGES)) {
  const lines = readFileSync(f, 'utf8').split('\n');
  const rel = relative(ROOT, f).replace(/\\/g, '/');
  lines.forEach((raw, i) => {
    const t = raw.trim();
    if (!/<Text[^>]*className="/.test(raw)) return;
    if (/\bblock\b/.test(raw) || /\binline\b/.test(raw)) return;
    totalText++;

    const parent = findParentClass(lines, i);
    const isRow = parent && /\bflex\b/.test(parent) &&
                  !/\bflex-col\b/.test(parent) &&
                  /items-center|\bflex-row\b/.test(parent);
    const isCol = parent && /\bflex-col\b/.test(parent);

    const item = { rel, line: i + 1, code: t.slice(0, 78), parent: parent || '(未找到)' };

    if (isRow) skip.push(item);          // 横向 → 不需要 block
    else if (isCol) need.push(item);     // 明确垂直 → 需要
    else need.push({ ...item, parent: (parent || '') + ' [无flex，默认垂直]' });
  });
}

console.log('='.repeat(80));
console.log(`Text 元素共 ${totalText} 个未写 block/inline`);
console.log('='.repeat(80));

console.log(`\n✅ 确认需要加 block（垂直排列）：${need.length} 处\n`);
for (const x of need) {
  console.log(`  ${x.rel}:${x.line}`);
  console.log(`      父容器: ${x.parent}`);
  console.log(`      ${x.code}`);
}

console.log(`\n⏭️  判定为横向（不需要 block，上一版误报）：${skip.length} 处\n`);
for (const x of skip.slice(0, 6)) {
  console.log(`  ${x.rel}:${x.line}  父: ${x.parent.slice(0, 50)}`);
}
if (skip.length > 6) console.log(`  ... 另有 ${skip.length - 6} 处`);

console.log('\n' + '='.repeat(80));
console.log(`结论：真正需要修的是 ${need.length} 处，误报 ${skip.length} 处`);
console.log('='.repeat(80));
