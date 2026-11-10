import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '易援小程序', '补丁-v2');

/** 字符级 JSX <View> 配平扫描（正确处理跨行自闭合标签） */
function viewBalance(s) {
  let opens = 0, closes = 0, selfc = 0, p = 0;
  while (p < s.length) {
    if (s.startsWith('</View>', p)) { closes++; p += 7; continue; }
    if (s.startsWith('<View', p) && /[\s>]/.test(s[p + 5] ?? '')) {
      let j = p + 5;
      let q = null;
      for (; j < s.length; j++) {
        const c = s[j];
        if (q) { if (c === q) q = null; continue; }
        if (c === '"' || c === "'") { q = c; continue; }
        if (c === '>') break;
      }
      const tag = s.slice(p, j + 1);
      if (/\/\s*>$/.test(tag)) selfc++; else opens++;
      p = j + 1;
      continue;
    }
    p++;
  }
  return { opens, selfc, closes, net: opens - closes };
}

const files = [
  'order-list-index-v2.tsx',
  'mine-index-v2.tsx',
];

console.log('='.repeat(74));
console.log('截图修复补丁 —— 结构验证');
console.log('='.repeat(74));

let bad = 0;
for (const f of files) {
  const p = join(OUT, f);
  if (!existsSync(p)) { console.log(`  [缺失] ${f}`); bad++; continue; }
  const s = readFileSync(p, 'utf8');
  const v = viewBalance(s);
  const braces = (s.match(/\{/g) || []).length;
  const bracesC = (s.match(/\}/g) || []).length;
  const parens = (s.match(/\(/g) || []).length;
  const parensC = (s.match(/\)/g) || []).length;

  const ok = v.net === 0 && braces === bracesC && parens === parensC;
  if (!ok) bad++;
  console.log(`\n  ${f}`);
  console.log(`    View  开=${v.opens} 自闭=${v.selfc} 关=${v.closes}  net=${v.net} ${v.net === 0 ? '✅' : '❌'}`);
  console.log(`    花括号 ${braces}/${bracesC} ${braces === bracesC ? '✅' : '❌'}`);
  console.log(`    圆括号 ${parens}/${parensC} ${parens === parensC ? '✅' : '❌'}`);
}

// 断言修复点是否落实
console.log('\n' + '='.repeat(74));
console.log('修复点断言');
console.log('='.repeat(74));

const ol = readFileSync(join(OUT, 'order-list-index-v2.tsx'), 'utf8');
const mi = readFileSync(join(OUT, 'mine-index-v2.tsx'), 'utf8');

const checks = [
  ['order-list: 搜索框改为两层 View', /<View className="flex items-center gap-2 mt-4">[\s\S]{0,120}<View className="flex-1 flex items-center gap-2 bg-surface-container/.test(ol)],
  ['order-list: 不再把 flex 与背景色放同一层', !/<View className="flex items-center bg-surface-container rounded-full px-4 py-2 gap-2 mt-4">/.test(ol)],
  ['mine: 遮罩用 bg-black/50（背景透明度）', /bg-black\/50/.test(mi)],
  ['mine: 不再用 bg-black opacity-50 包裹弹窗', !/className="fixed inset-0 z-50 flex items-end bg-black opacity-50"/.test(mi)],
  ['mine: 遮罩与弹窗为兄弟节点（Fragment）', /<>\s*\n\s*\{\/\* 遮罩/.test(mi)],
  ['mine: 保留退出逻辑 onLogout', /onClick=\{onLogout\}/.test(mi)],
];

for (const [name, ok] of checks) {
  console.log(`  ${ok ? '[OK]  ' : '[FAIL]'} ${name}`);
  if (!ok) bad++;
}

console.log('\n' + '='.repeat(74));
console.log(bad === 0 ? '✅ 全部通过' : `❌ ${bad} 项未通过`);
console.log('='.repeat(74));
process.exit(bad === 0 ? 0 : 1);
