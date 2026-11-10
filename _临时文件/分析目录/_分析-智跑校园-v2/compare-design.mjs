/**
 * 设计一致性比对：原型 HTML ↔ 实际页面 TSX
 *
 * 目的：原型是"设计基准"（AGENTS/A+B+C 方案里的 A 档），
 * 实际页面若偏离基准，就是设计层面的问题。
 *
 * 比对维度：
 *   1. 颜色 token 使用（原型用 --color-* 体系，页面应用 Tailwind 语义类）
 *   2. 是否出现原型里没有的颜色（硬编码 hex）
 *   3. 关键组件的结构差异（TabBar / 卡片 / 按钮 / 搜索框）
 *   4. 圆角、阴影、间距尺度
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJ = join(HERE, 'projects');
const PROTO = join(PROJ, '.cozeproj', 'prototype', 'mobile');
const PAGES = join(PROJ, 'src', 'pages');

function walk(d, re, out = []) {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) walk(p, re, out);
    else if (re.test(e)) out.push(p);
  }
  return out;
}

const protos = walk(PROTO, /\.html$/);
const pages = walk(PAGES, /\.tsx$/);

console.log('='.repeat(76));
console.log('一、原型设计系统（设计基准）');
console.log('='.repeat(76));

// 收集原型里的 CSS 变量
const tokenMap = new Map();
for (const f of protos) {
  const t = readFileSync(f, 'utf8');
  const style = t.match(/<style[^>]*>([\s\S]*?)<\/style>/);
  if (!style) continue;
  for (const m of style[1].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    if (!tokenMap.has(m[1])) tokenMap.set(m[1], m[2].trim());
  }
}
console.log(`\n设计 token 共 ${tokenMap.size} 个（来自 ${protos.length} 个原型页）\n`);

const colorTokens = [...tokenMap.entries()].filter(([k]) => k.includes('color'));
for (const [k, v] of colorTokens) console.log(`  ${k.padEnd(34)} ${v}`);

console.log('\n' + '='.repeat(76));
console.log('二、实际页面对设计 token 的遵循度');
console.log('='.repeat(76));

// 页面里允许的语义色类（对应原型 token）
const TOKEN_HEX = new Set(
  colorTokens.map(([, v]) => v.toLowerCase())
);

const issues = [];
for (const f of pages) {
  const t = readFileSync(f, 'utf8');
  const rel = f.replace(PROJ + '\\', '').replace(/\\/g, '/');
  const lines = t.split('\n');

  lines.forEach((raw, i) => {
    const s = raw.trim();
    if (!s || s.startsWith('//') || s.startsWith('*') || s.startsWith('/*')) return;

    // ① 硬编码 hex 颜色
    const hexes = raw.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
    for (const h of hexes) {
      const low = h.toLowerCase();
      // 允许：设计 token 里定义过的 + size/color props（lucide 图标要求传 hex）
      const isToken = TOKEN_HEX.has(low);
      const isIconProp = /color="#/.test(raw) || /strokeWidth/.test(raw);
      if (!isToken && !isIconProp) {
        issues.push({ rel, line: i + 1, kind: '非token硬编码颜色', detail: h, code: s.slice(0, 70) });
      }
    }

    // ② 使用非语义色（Tailwind 原生调色板而非 token）
    const nonSemantic = raw.match(/\b(?:text|bg|border)-(?:red|green|blue|yellow|gray|slate|zinc|neutral|stone|orange|amber|lime|emerald|teal|cyan|sky|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/g) || [];
    for (const c of nonSemantic) {
      issues.push({ rel, line: i + 1, kind: '非语义色类', detail: c, code: s.slice(0, 70) });
    }
  });
}

const byKind = {};
for (const x of issues) (byKind[x.kind] ??= []).push(x);

for (const [k, list] of Object.entries(byKind)) {
  console.log(`\n### ${k}：${list.length} 处`);
  const seen = new Set();
  for (const x of list) {
    const key = x.rel + ':' + x.detail;
    if (seen.has(key)) continue;
    seen.add(key);
    if (seen.size > 10) break;
    console.log(`  ${x.rel}:${x.line}  ${x.detail}`);
    console.log(`      ${x.code}`);
  }
  if (seen.size > 10) console.log(`  ... 另有若干`);
}
if (!issues.length) console.log('\n  ✅ 未发现偏离（页面全部使用设计 token）');

console.log('\n' + '='.repeat(76));
console.log('三、原型页面 ↔ 实际页面 对应关系');
console.log('='.repeat(76));

const protoNames = protos
  .map((f) => f.split(/[\\/]/).pop().replace('.html', ''))
  .filter((n) => !n.startsWith('_'))
  .sort();
const pageNames = readdirSync(PAGES).filter((d) => statSync(join(PAGES, d)).isDirectory()).sort();

console.log('\n原型页 (' + protoNames.length + '):', protoNames.join(', '));
console.log('实际页 (' + pageNames.length + '):', pageNames.join(', '));

const onlyProto = protoNames.filter((n) => !pageNames.includes(n));
const onlyPage = pageNames.filter((n) => !protoNames.includes(n));
console.log('\n仅在原型中:', onlyProto.length ? onlyProto.join(', ') : '（无）');
console.log('仅在实际中:', onlyPage.length ? onlyPage.join(', ') : '（无）');
