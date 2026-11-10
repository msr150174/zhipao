/**
 * 前端合规性与 bug 扫描器
 *
 * 依据 AGENTS.md 中的明文规则，逐项扫描 src/ 下的页面与组件：
 *   1. 硬编码 px（Tailwind 任意值 / style 内联）—— 跨端不一致
 *   2. 垂直 Text 缺 block 类 —— H5 白屏
 *   3. 原生 Input/Textarea 未用 View 包裹 —— H5 样式失效
 *   4. fixed + flex 用 Tailwind —— H5 失效
 *   5. 直接使用 Taro.request —— 绕过 Network
 *   6. 手搓通用 UI（应使用 @/components/ui）
 *   7. 图标 className 传 text- 或 w- 前缀 —— 无效
 *   8. 底部固定元素未避开 TabBar（bottom 应 >= 50）
 *   9. 直接使用 fetch
 *  10. 平台检测用 useState + useEffect —— 状态延迟导致 H5 白屏
 *
 * 运行：node scan-frontend.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, 'projects', 'src');

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(tsx|ts)$/.test(e)) out.push(p);
  }
  return out;
}

const files = walk(SRC);
const pages = files.filter((f) => f.includes('pages'));
const findings = [];
const add = (rule, file, line, code, why) =>
  findings.push({ rule, file: relative(join(HERE, 'projects'), file), line, code: code.trim().slice(0, 92), why });

for (const f of files) {
  const lines = readFileSync(f, 'utf8').split('\n');
  lines.forEach((raw, i) => {
    const L = i + 1;
    const t = raw.trim();
    if (!t || t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return;

    // 1. Tailwind 任意值带 px
    if (/\[[0-9.]+px\]/.test(raw)) {
      add('R1 硬编码px', f, L, t, 'AGENTS.md 禁止 w-[340px] 这类任意值，跨端单位会错');
    }

    // 2. style 内联硬编码 px
    if (/style=\{\{[^}]*['"`][0-9]+px['"`]/.test(raw)) {
      add('R2 内联px', f, L, t, 'AGENTS.md 禁止 style 硬编码尺寸');
    }

    // 3. 直接 Taro.request
    if (/Taro\.(request|uploadFile|downloadFile)\s*\(/.test(raw)) {
      add('R3 绕过Network', f, L, t, 'AGENTS.md 要求用 Network.request');
    }

    // 4. fetch 直连
    if (/(^|\s)fetch\s*\(/.test(raw) && !/Network|uploadFile/.test(raw)) {
      add('R4 fetch直连', f, L, t, 'AGENTS.md 禁止 fetch 直接调 API');
    }

    // 5. 图标 className 传 text-*/w-*/h-*
    if (/<(House|User|Star|Settings|Wallet|Search|Plus|ChevronRight|ReceiptText|MessageCircle|FileText|Headset|ShoppingBasket|ScanFace|MessageSquareText)[^>]*className="[^"]*(text-|w-\d|h-\d)/.test(raw)) {
      add('R5 图标className', f, L, t, 'className 不改图标描边，应改用 color/size');
    }

    // 6. 手搓按钮（View + rounded + bg-primary 可点击）
    if (/<View[^>]*className="[^"]*(rounded[^"]*bg-primary|bg-primary[^"]*rounded)[^"]*"[^>]*onClick/.test(raw)) {
      add('R6 手搓按钮', f, L, t, 'AGENTS.md 要求用 @/components/ui/button');
    }

    // 7. 平台检测用 useState
    if (/useState\([^)]*\)/.test(raw) && /getEnv|ENV_TYPE/.test(raw)) {
      add('R7 平台检测', f, L, t, 'AGENTS.md 要求直接判断 Taro.getEnv()，避免状态延迟');
    }

    // 8. fixed + bottom-0（Tailwind 类形式）
    if (/className="[^"]*\bfixed\b[^"]*\bbottom-0\b/.test(raw)) {
      add('R8 fixed-bottom0', f, L, t, 'H5 下 Tailwind fixed 失效，且 bottom-0 会被 TabBar 遮挡');
    }

    // 9. 垂直 Text 无 block 类
    if (/<Text className="/.test(raw) && !/\bblock\b/.test(raw) && !/\binline/.test(raw)) {
      add('R9 Text缺block', f, L, t, '垂直排列的 Text 需加 block，否则 H5 为 inline 可能白屏');
    }

    // 10. 原生 Input 未包 View（heuristic：同标签行内直接给样式类）
    if (/<Input[^>]*className="[^"]*(bg-|rounded|border|px-|py-)/.test(raw)) {
      add('R10 Input未包裹', f, L, t, 'H5 端 Input 是 inline，样式应放外层 View');
    }
  });
}

// 按规则聚合输出
const byRule = {};
for (const x of findings) (byRule[x.rule] ??= []).push(x);

console.log('='.repeat(78));
console.log(`前端扫描：${files.length} 个文件（其中页面 ${pages.length} 个）`);
console.log('='.repeat(78));

const ORDER = [
  'R1 硬编码px', 'R2 内联px', 'R3 绕过Network', 'R4 fetch直连',
  'R5 图标className', 'R6 手搓按钮', 'R7 平台检测',
  'R8 fixed-bottom0', 'R9 Text缺block', 'R10 Input未包裹',
];

for (const k of ORDER) {
  const list = byRule[k] || [];
  console.log(`\n### ${k} —— ${list.length} 处`);
  if (!list.length) { console.log('  （无）'); continue; }
  const show = list.slice(0, 12);
  for (const x of show) console.log(`  ${x.file}:${x.line}  ${x.code}`);
  if (list.length > show.length) console.log(`  ... 另有 ${list.length - show.length} 处`);
  console.log(`  说明：${list[0].why}`);
}

console.log('\n' + '='.repeat(78));
console.log(`合计 ${findings.length} 处待确认`);
console.log('='.repeat(78));
