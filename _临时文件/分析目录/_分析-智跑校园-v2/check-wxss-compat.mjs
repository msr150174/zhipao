/**
 * 小程序 WXSS 兼容性检查
 *
 * 背景：提交 a3b42bf 修过一个同类问题 —— Tailwind 扫描到不支持的语法
 * （peer:checked~ 兄弟选择器）导致小程序预览失败。
 * 本脚本系统检查构建产物里是否仍有小程序不支持的选择器/属性。
 *
 * 已知小程序 WXSS 不支持：
 *   - 关系选择器：~ （兄弟）  > （子选择器部分场景）
 *   - 现代伪类：:has()  :is()  :where()
 *   - 属性选择器部分形式
 *   - ::-moz-* 等非标准前缀
 *   - 部分 CSS 属性：text-wrap / text-balance
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJ = join(HERE, 'projects');

const CHECKS = [
  { name: '兄弟选择器 ~', re: /[^\s{,}]\s*~\s*[.#\w\[]/g, fatal: true },
  { name: ':has() 伪类', re: /:has\(/g, fatal: true },
  { name: ':is() 伪类', re: /:is\(/g, fatal: true },
  { name: ':where() 伪类', re: /:where\(/g, fatal: true },
  { name: '::-moz-* 非标准前缀', re: /::-moz-/g, fatal: false },
  { name: ':focus-within', re: /:focus-within/g, fatal: true },
  { name: ':focus-visible', re: /:focus-visible/g, fatal: true },
  { name: 'text-wrap / text-balance', re: /text-(wrap|balance)\s*:/g, fatal: false },
  { name: '::selection', re: /::selection/g, fatal: false },
  { name: '@container 查询', re: /@container/g, fatal: true },
  { name: '@layer', re: /@layer/g, fatal: false },
];

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(wxss|css)$/.test(e)) out.push(p);
  }
  return out;
}

console.log('='.repeat(80));
console.log('小程序 WXSS 兼容性检查');
console.log('='.repeat(80));

let anyFatal = false;

for (const distName of ['dist', 'dist-tt']) {
  const dist = join(PROJ, distName);
  if (!existsSync(dist)) {
    console.log(`\n[跳过] ${distName} 不存在`);
    continue;
  }
  const files = walk(dist);
  console.log(`\n### ${distName}（${files.length} 个 wxss）`);

  for (const f of files) {
    const css = readFileSync(f, 'utf8');
    const rel = relative(PROJ, f).replace(/\\/g, '/');
    const found = [];

    for (const c of CHECKS) {
      const m = css.match(c.re);
      if (m && m.length) found.push({ ...c, count: m.length });
    }

    if (!found.length) continue;

    const total = Buffer.byteLength(css, 'utf8');
    console.log(`\n  ${rel}  (${(total / 1024).toFixed(1)} KB)`);
    for (const x of found) {
      const flag = x.fatal ? '🔴 致命' : '🟡 警告';
      console.log(`    ${flag}  ${x.name} × ${x.count}`);
      if (x.fatal) anyFatal = true;

      // 提取一例上下文
      const idx = css.search(x.re);
      if (idx >= 0) {
        const s = Math.max(0, idx - 70);
        const seg = css.slice(s, Math.min(css.length, idx + 130)).replace(/\n/g, ' ');
        console.log(`          … ${seg} …`);
      }
    }
  }
}

console.log('\n' + '='.repeat(80));
console.log(anyFatal
  ? '结论：发现 🔴 致命不兼容选择器 —— 小程序端可能预览失败或样式错乱'
  : '结论：未发现致命不兼容（仅有警告项）');
console.log('='.repeat(80));
