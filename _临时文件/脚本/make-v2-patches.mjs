import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJ = join(HERE, '_分析-智跑校园-v2', 'projects');
const OUT = join(HERE, '易援小程序', '补丁-v2');
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

/** 复刻 verify-patches.mjs 里被篡改的那一段的正确版本 */
function fixVerifyPatches() {
  const p = join(PROJ, 'verify-patches.mjs');
  let t = readFileSync(p, 'utf8');

  const broken = `  check('从环境变量读 WX_APP_ID / WX_APP_SECRET', () => {
    const a = mustContain(src, 'wxc9c6da82f1b21327');
    if (a !== true) return a;
    return mustContain(src, '65310f1244e78ae9ded6265bc328b2e6');
  });`;

  const fixed = `  // ★ 修复：原断言被改成要求「明文硬编码 AppID/AppSecret」（见 commit 9741c3b），
  //   导致 ① 密钥进 Git 历史  ② 断言名实不符  ③ 断言永远失败
  //   正确做法：只校验代码里引用了这两个环境变量名，不校验任何明文值。
  check('从环境变量读 WX_APP_ID / WX_APP_SECRET（不得硬编码明文）', () => {
    const a = mustContain(src, 'WX_APP_ID');
    if (a !== true) return a;
    const b = mustContain(src, 'WX_APP_SECRET');
    if (b !== true) return b;
    // 反向断言：源码中不得出现明文密钥形态
    const hex32 = /['"][0-9a-f]{32}['"]/i;
    return hex32.test(src)
      ? '源码中出现疑似明文密钥（32 位 hex），必须改为环境变量'
      : true;
  });`;

  if (!t.includes(broken)) {
    // 尝试宽松匹配（防止空格差异）
    const re = /check\('从环境变量读 WX_APP_ID \/ WX_APP_SECRET',[\s\S]*?\}\);/;
    if (!re.test(t)) {
      return { file: 'verify-patches.mjs', ok: false, why: '未找到被篡改的断言段' };
    }
    t = t.replace(re, fixed);
  } else {
    t = t.replace(broken, fixed);
  }

  // 确认已无明文密钥
  const stillLeaks = /wxc9c6da82f1b21327|65310f1244e78ae9ded6265bc328b2e6/.test(t);

  writeFileSync(join(OUT, 'verify-patches.mjs'), t, 'utf8');
  return {
    file: 'verify-patches.mjs',
    ok: !stillLeaks,
    why: stillLeaks ? '仍残留明文密钥' : '已改为环境变量断言，且去除全部明文密钥',
  };
}

/** 删除 order-list 里手搓的 TabBar 整段 */
function fixOrderList() {
  const p = join(PROJ, 'src', 'pages', 'order-list', 'index.tsx');
  const lines = readFileSync(p, 'utf8').split('\n');

  const start = lines.findIndex((l) => l.includes('{/* 底部 TabBar */}'));
  if (start < 0) return { file: 'order-list/index.tsx', ok: false, why: '未找到手搓 TabBar 起点' };

  // 找到该 JSX 块的结束：从 start 起，找匹配深度的收尾 </View>
  let depth = 0, end = -1, started = false;
  for (let i = start; i < lines.length; i++) {
    const opens = (lines[i].match(/<View\b/g) || []).length;
    const closes = (lines[i].match(/<\/View>/g) || []).length;
    const selfClose = (lines[i].match(/<View\b[^>]*\/>/g) || []).length;
    if (opens > 0) started = true;
    depth += opens - selfClose - closes;
    if (started && depth <= 0) { end = i; break; }
  }
  if (end < 0) return { file: 'order-list/index.tsx', ok: false, why: '未能确定 TabBar 结束位置' };

  const removed = end - start + 1;
  const note = [
    '      {/* ★ 修复：此处曾手搓一个 TabBar，但本页是原生 TabBar 页（见 app.config.ts），',
    '          导致同屏出现两个 TabBar。原生 TabBar 已由 app.config.ts 声明，故整段删除。 */}',
  ];

  const out = [...lines.slice(0, start), ...note, ...lines.slice(end + 1)];
  writeFileSync(join(OUT, 'order-list-index.tsx'), out.join('\n'), 'utf8');
  return { file: 'order-list/index.tsx', ok: true, why: `删除 ${removed} 行手搓 TabBar`, removed };
}

/** 删除 mine 里手搓的 TabBar 整段 */
function fixMine() {
  const p = join(PROJ, 'src', 'pages', 'mine', 'index.tsx');
  const lines = readFileSync(p, 'utf8').split('\n');

  const start = lines.findIndex((l) => l.includes('{/* 底部 TabBar'));
  if (start < 0) return { file: 'mine/index.tsx', ok: false, why: '未找到手搓 TabBar 起点' };

  let depth = 0, end = -1, started = false;
  for (let i = start; i < lines.length; i++) {
    const opens = (lines[i].match(/<View\b/g) || []).length;
    const closes = (lines[i].match(/<\/View>/g) || []).length;
    const selfClose = (lines[i].match(/<View\b[^>]*\/>/g) || []).length;
    if (opens > 0) started = true;
    depth += opens - selfClose - closes;
    if (started && depth <= 0) { end = i; break; }
  }
  if (end < 0) return { file: 'mine/index.tsx', ok: false, why: '未能确定 TabBar 结束位置' };

  const removed = end - start + 1;
  const note = [
    '      {/* ★ 修复：此处曾手搓一个 TabBar，但本页是原生 TabBar 页（见 app.config.ts），',
    '          导致同屏出现两个 TabBar。原生 TabBar 已由 app.config.ts 声明，故整段删除。 */}',
  ];

  const out = [...lines.slice(0, start), ...note, ...lines.slice(end + 1)];
  writeFileSync(join(OUT, 'mine-index.tsx'), out.join('\n'), 'utf8');
  return { file: 'mine/index.tsx', ok: true, why: `删除 ${removed} 行手搓 TabBar`, removed };
}

/** 生成 .gitignore 补丁片段 */
function fixGitignore() {
  const content = `# ===== 凭证与私钥（★ 绝不能入库）=====
.env
.env.*
!.env.example
key/
*.key
*.pem
*.p12
*.pfx
*.jks
*.keystore

# ===== 微信小程序私钥（上传代码用）=====
private.*.key
`;
  writeFileSync(join(OUT, 'gitignore-追加片段.txt'), content, 'utf8');

  // 检查工程当前是否有 key/ 被跟踪
  const gi = join(PROJ, '.gitignore');
  const cur = existsSync(gi) ? readFileSync(gi, 'utf8') : '';
  const hasKeyRule = /^\s*key\//m.test(cur);
  const hasPem = /\*\.pem/.test(cur);
  return {
    file: '.gitignore',
    ok: true,
    why: `当前 key/ 规则被注释=${!hasKeyRule}，*.pem 缺失=${!hasPem}；已生成追加片段`,
  };
}

const results = [fixVerifyPatches(), fixOrderList(), fixMine(), fixGitignore()];

console.log('='.repeat(72));
console.log('补丁生成结果');
console.log('='.repeat(72));
for (const r of results) {
  console.log(`${r.ok ? '[OK]  ' : '[FAIL]'} ${r.file}`);
  console.log(`        ${r.why}`);
}
console.log('\n输出目录: ' + OUT);
