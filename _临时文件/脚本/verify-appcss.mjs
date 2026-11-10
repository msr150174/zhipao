import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const NEW = join(HERE, '易援小程序', '补丁-v3', 'src', 'app.css');
const OLD = join(HERE, '_分析-智跑校园-v3', 'projects', 'src', 'app.css');

let pass = 0, fail = 0;
const check = (n, ok, d = '') => {
  if (ok) { pass++; console.log(`  [OK]   ${n}`); }
  else { fail++; console.log(`  [FAIL] ${n}${d ? ' -> ' + d : ''}`); }
};

const css = readFileSync(NEW, 'utf8');
const old = readFileSync(OLD, 'utf8');

console.log('='.repeat(76));
console.log('app.css 补丁校验');
console.log('='.repeat(76));

console.log('\n### 1. 结构完整性');
const ob = (css.match(/\{/g) || []).length;
const cb = (css.match(/\}/g) || []).length;
check('花括号配平', ob === cb, `${ob} / ${cb}`);

console.log('\n### 2. 原文件内容是否保留（不能丢）');
// 原文件的关键内容必须都在
const mustKeep = [
  "@import url('weapp-tailwindcss')",
  '@source not "../.cozeproj"',
  '@source not "../dist"',
  '--primary: #22C55E',
  '--background: #F5F6F8',
  '--muted: #9AA0A6',
  '--muted-foreground: #6B7280',
  '--primary-container: #E8F8EE',
  '--outline-variant: #F0F0F0',
  '@custom-variant dark',
  '@theme inline',
  '--shadow-card',
  '--shadow-float',
  '--shadow-dialog',
  '--font-sans',
  'page,',
  '::selection',
];
for (const k of mustKeep) {
  check(`保留：${k.slice(0, 42)}`, css.includes(k));
}

// 原文件的所有 :root token 都要在
const rootTokens = [...old.matchAll(/^\s*(--[\w-]+):/gm)].map((m) => m[1]);
const missingTokens = [...new Set(rootTokens)].filter((t) => !css.includes(`${t}:`));
check(`原文件全部 ${new Set(rootTokens).size} 个 CSS 变量都保留`, missingTokens.length === 0,
  missingTokens.join(', '));

console.log('\n### 3. 新增动效内容');
const mustAdd = [
  '@keyframes fade-in',
  '@keyframes slide-up',
  '@keyframes slide-down',
  '@keyframes pop',
  '@keyframes shake',
  '@keyframes pulse-soft',
  '@keyframes shimmer',
  '.anim-fade-in',
  '.anim-slide-up',
  '.anim-pop',
  '.anim-shake',
  '.anim-pulse-soft',
  '.skeleton-shimmer',
  '.press-scale',
  'prefers-reduced-motion',
];
for (const k of mustAdd) check(`新增：${k}`, css.includes(k));

// @theme 里的 --animate-* 注册
const animTokens = ['fade-in', 'slide-up', 'slide-down', 'pop', 'shake', 'pulse-soft', 'shimmer'];
for (const t of animTokens) {
  check(`@theme 注册 --animate-${t}`, css.includes(`--animate-${t}:`));
}

console.log('\n### 4. 每个 keyframes 都有对应工具类');
const keyframes = [...css.matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1]);
check(`解析出 ${keyframes.length} 个 keyframes`, keyframes.length === 7);
for (const k of keyframes) {
  // shimmer 只被 .skeleton-shimmer 用，其余要有 .anim-*
  const hasUtil = css.includes(`.anim-${k}`) || css.includes(`animation: ${k}`);
  check(`keyframes ${k} 被使用`, hasUtil);
}

console.log('\n### 5. 语法隐患检查');
// CSS 里不应出现未转义的 ${（会与 JS 模板串冲突）
check('无 ${ 残留', !css.includes('${'));
// 不应有空的 keyframes
check('无空 keyframes 块', !/@keyframes\s+[\w-]+\s*\{\s*\}/.test(css));
// var() 引用应存在（只检查自定义属性）
const usedVars = [...new Set([...css.matchAll(/var\((--[\w-]+)\)/g)].map((m) => m[1]))];
const definedVars = new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
// --chart-* 是 shadcn 默认残留（**原文件也未定义**），不算本项目问题
const KNOWN_SHADCN = /^--chart-\d+$/;
const undef = usedVars.filter(
  (v) => !definedVars.has(v) && !v.startsWith('--tw-') && !KNOWN_SHADCN.test(v),
);
check(`var() 引用的变量都已定义（检查 ${usedVars.length} 个）`, undef.length === 0, undef.join(', '));

console.log('\n### 6. 文件规模');
const lines = css.split('\n').length;
const oldLines = old.split('\n').length;
console.log(`       原文件 ${oldLines} 行 → 新文件 ${lines} 行（+${lines - oldLines}）`);
check('新增内容合理（< 200 行）', lines - oldLines < 200, `+${lines - oldLines}`);

console.log('\n' + '='.repeat(76));
console.log(`结果：通过 ${pass} 项，失败 ${fail} 项`);
console.log('='.repeat(76));
process.exit(fail === 0 ? 0 : 1);
