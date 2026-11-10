import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '易援小程序', '补丁-v2');
const PROJ = join(HERE, '_分析-智跑校园-v2', 'projects');

function analyze(file, label) {
  const lines = readFileSync(file, 'utf8').split('\n');
  const opens = (s) => (s.match(/<View\b/g) || []).length;
  const selfs = (s) => (s.match(/<View\b[^>]*\/>/g) || []).length;
  const closes = (s) => (s.match(/<\/View>/g) || []).length;

  let depth = 0;
  const trace = [];
  lines.forEach((l, i) => {
    if (opens(l) || closes(l)) {
      depth += opens(l) - selfs(l) - closes(l);
      trace.push({ line: i + 1, depth, text: l.trim().slice(0, 60) });
    }
  });

  const totalOpen = lines.reduce((a, l) => a + opens(l), 0);
  const totalSelf = lines.reduce((a, l) => a + selfs(l), 0);
  const totalClose = lines.reduce((a, l) => a + closes(l), 0);

  console.log(`\n=== ${label} ===`);
  console.log(`  <View ${totalOpen}  /> ${totalSelf}  </View> ${totalClose}`);
  console.log(`  配平: ${totalOpen === totalClose + totalSelf ? '✅' : '❌ 差 ' + (totalOpen - totalClose - totalSelf)}`);
  console.log(`  最终 depth: ${depth}`);
  return { trace, lines };
}

const orig = analyze(join(PROJ, 'src/pages/mine/index.tsx'), '原文件 mine/index.tsx');
const patched = analyze(join(OUT, 'mine-index-v2.tsx'), '补丁 mine-index-v2.tsx');

// 比较弹窗区域：找 depth 首次出现差异的位置
console.log('\n=== depth 轨迹差异（原 vs 补丁）===');
const n = Math.min(orig.trace.length, patched.trace.length);
for (let i = 0; i < n; i++) {
  const a = orig.trace[i];
  const b = patched.trace[i];
  if (a.depth !== b.depth) {
    console.log(`  首次分歧在第 ${i} 条 trace：`);
    console.log(`    原  L${a.line} depth=${a.depth}  ${a.text}`);
    console.log(`    补丁 L${b.line} depth=${b.depth}  ${b.text}`);
    break;
  }
}

// 打印补丁弹窗附近的原始行
console.log('\n=== 补丁文件 L235-275 原文 ===');
patched.lines.slice(234, 275).forEach((l, i) => {
  const ln = 235 + i;
  const o = (l.match(/<View\b/g) || []).length;
  const s = (l.match(/<View\b[^>]*\/>/g) || []).length;
  const c = (l.match(/<\/View>/g) || []).length;
  const mark = (o || c) ? `[${o}/${s}/${c}]` : '';
  console.log(`  ${String(ln).padStart(4)} ${mark.padEnd(10)} ${l.trim()}`);
});
