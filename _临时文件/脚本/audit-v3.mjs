/**
 * v3 全工程体检扫描
 *
 * 分三部分：
 *   A. 后端（server/src）：路由、契约、安全、数据一致性
 *   B. 前端（src）：跨端合规、设计保真、状态处理
 *   C. 工程配置：构建、凭证、体积
 *
 * 只报「有证据」的问题，每条附文件:行号与代码片段。
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '_分析-智跑校园-v3', 'projects');

function walk(dir, re, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, re, out);
    else if (re.test(e)) out.push(p);
  }
  return out;
}

const backend = walk(join(ROOT, 'server', 'src'), /\.ts$/);
const frontend = walk(join(ROOT, 'src'), /\.(ts|tsx)$/);
const pageFiles = frontend.filter((f) => f.includes(`${'pages'}`));

const findings = [];
const add = (part, level, title, file, line, code, why) => {
  findings.push({
    part, level, title,
    loc: `${relative(ROOT, file).replace(/\\/g, '/')}${line ? ':' + line : ''}`,
    code: (code || '').trim().slice(0, 88),
    why,
  });
};

function scanFile(f, rules, part) {
  const lines = readFileSync(f, 'utf8').split('\n');
  lines.forEach((raw, i) => {
    const t = raw.trim();
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return;
    for (const r of rules) {
      if (r.test(raw)) add(part, r.level, r.title, f, i + 1, t, r.why);
    }
  });
}

console.log('='.repeat(84));
console.log(`v3 全工程体检：后端 ${backend.length} 个 .ts，前端 ${frontend.length} 个文件（含 ${pageFiles.length} 个页面 tsx）`);
console.log('='.repeat(84));

// ─────────────── A. 后端 ───────────────
const backendRules = [
  {
    level: 'P0', title: '硬编码密钥',
    test: (l) => /(secret|Secret|password|apiKey|api_key)\s*[:=]\s*['"][^'"]{8,}['"]/.test(l)
      && !/process\.env|config\.get/.test(l),
    why: '密钥必须来自环境变量',
  },
  {
    level: 'P0', title: '路由装饰器误加 api 前缀',
    test: (l) => /@(Controller|Get|Post|Put|Delete)\(\s*['"]api/.test(l),
    why: 'main.ts 已 setGlobalPrefix("api")，再加会变成 /api/api',
  },
  {
    level: 'P1', title: '读-改-写更新余额/信用分',
    test: (l) => /Number\((user|row)\.(balance|income|credit_score)\)\s*\+/.test(l),
    why: '并发下会丢失更新，应改用条件更新或原子函数',
  },
  {
    level: 'P1', title: '直接拼接过滤表达式',
    test: (l) => /\.or\(\s*`[^`]*\$\{(?!userId)/.test(l) && !/escapeFilterValue/.test(l),
    why: '用户输入拼进 PostgREST or() 会注入',
  },
  {
    level: 'P1', title: '未捕获的静默 catch',
    test: (l) => /catch\s*\{\s*\}/.test(l),
    why: '空 catch 会吞掉错误，排障困难',
  },
  {
    level: 'P2', title: 'console.log 残留在后端',
    test: (l) => /console\.log\(/.test(l),
    why: '生产环境应移除或改用 Logger',
  },
];
for (const f of backend) scanFile(f, backendRules, 'A 后端');

// ─────────────── B. 前端 ───────────────
const frontendRules = [
  {
    level: 'P0', title: 'opacity-* 用在容器上（会淡化子内容）',
    test: (l) => /className="[^"]*\bopacity-(?:[0-9]|[1-9][0-9])\b/.test(l)
      && /<(View|Card|Button)/.test(l),
    why: 'opacity 作用于整个子树；背景透明应用 bg-xxx/NN',
  },
  {
    level: 'P1', title: 'Input 与 flex 同层（H5 样式失效）',
    test: (l) => /<View[^>]*className="[^"]*\bflex\b[^"]*"[^>]*>\s*$/.test(l),
    why: 'AGENTS.md：Input 必须 View 包裹，flex 放外层',
  },
  {
    level: 'P1', title: 'Tailwind 任意值带 px',
    test: (l) => /\[[0-9.]+px\]/.test(l),
    why: 'AGENTS.md 禁止 w-[340px]，跨端单位不一致',
  },
  {
    level: 'P1', title: 'style 内联硬编码尺寸',
    test: (l) => /style=\{\{[^}]*(width|height|fontSize)\s*:\s*['"`][0-9]+/.test(l),
    why: 'AGENTS.md 禁止硬编码尺寸',
  },
  {
    level: 'P1', title: '直接使用 Taro.request / fetch',
    test: (l) => /Taro\.(request|uploadFile|downloadFile)\s*\(/.test(l) || /(^|\s)fetch\s*\(/.test(l),
    why: '应统一走 Network.request',
  },
  {
    level: 'P2', title: '图标 className 传 text-* / w-* / h-*',
    test: (l) => /<[A-Z][A-Za-z]+\s[^>]*className="[^"]*(text-|w-\d|h-\d)/.test(l) && /size=|color=/.test(l),
    why: 'className 只作用于 Image，不改图标描边',
  },
  {
    level: 'P2', title: '固定底栏 bottom 未避开 TabBar',
    test: (l) => /position:\s*['"]fixed['"]/.test(l) && /bottom:\s*0\b/.test(l),
    why: 'TabBar 页需 bottom >= 50',
  },
  {
    level: 'P0', title: '直接渲染可能为对象的字段（React 崩溃风险）',
    test: (l) => /PACKAGE_SIZE_TEXT\[[^\]]+\]\s*(?!\?\.\[|\?\.)/.test(l),
    why: 'PACKAGE_SIZE_TEXT 已改为嵌套对象，直接索引会渲染对象导致崩溃',
  },
];
for (const f of frontend) {
  if (f.includes('components/ui') || f.includes('components\\ui')) continue; // 组件库跳过
  scanFile(f, frontendRules, 'B 前端');
}

// ─────────────── C. 配置 ───────────────
const cfgRules = [
  {
    level: 'P0', title: 'packOptions.ignore 指向 assets',
    file: 'project.config.json',
    test: (s) => /"ignore"\s*:\s*\[\s*\{[^}]*\.\/assets/.test(s),
    why: 'ignore 相对 miniprogramRoot(dist)，会排除 TabBar 图标',
  },
  {
    level: 'P1', title: 'appid 仍是游客占位符',
    file: 'project.config.json',
    test: (s) => /"appid"\s*:\s*"touristappid"/.test(s),
    why: '需填真实小程序 AppID',
  },
  {
    level: 'P1', title: '缺 sitemap.json',
    file: 'src/sitemap.json',
    test: null,
    why: '小程序要求，缺失会有警告',
  },
  {
    level: 'P1', title: '缺 .env.example',
    file: 'server/.env.example',
    test: null,
    why: '新环境不知道要配哪些变量',
  },
];
for (const r of cfgRules) {
  const p = join(ROOT, r.file);
  if (r.test === null) {
    if (!existsSync(p)) add('C 配置', r.level, r.title, p, null, '', r.why);
  } else if (existsSync(p)) {
    if (r.test(readFileSync(p, 'utf8'))) add('C 配置', r.level, r.title, p, null, '', r.why);
  }
}

// 密钥泄漏扫描
const secretFiles = walk(ROOT, /\.(ts|tsx|mjs|json|md)$/).filter(
  (f) => !f.includes('node_modules') && !f.includes(`${'dist'}`),
);
for (const f of secretFiles) {
  const s = readFileSync(f, 'utf8');
  if (s.includes('65310f1244e78ae9ded6265bc328b2e6')) {
    const ln = s.split('\n').findIndex((l) => l.includes('65310f1244e78ae9ded6265bc328b2e6')) + 1;
    add('C 配置', 'P0', '明文 AppSecret 出现在文件里', f, ln,
      s.split('\n')[ln - 1] || '', '密钥不得写入任何入库文件（含校验脚本/文档）');
  }
}

// ─────────────── 输出 ───────────────
const order = { P0: 0, P1: 1, P2: 2 };
findings.sort((a, b) => order[a.level] - order[b.level]);

for (const part of ['A 后端', 'B 前端', 'C 配置']) {
  const list = findings.filter((x) => x.part === part);
  console.log(`\n${'─'.repeat(84)}`);
  console.log(`${part}：${list.length} 项`);
  console.log('─'.repeat(84));
  if (!list.length) { console.log('  ✅ 未发现问题'); continue; }
  const byTitle = {};
  for (const x of list) (byTitle[x.title] ??= []).push(x);
  for (const [title, arr] of Object.entries(byTitle)) {
    console.log(`\n  [${arr[0].level}] ${title} —— ${arr.length} 处`);
    console.log(`        原因：${arr[0].why}`);
    for (const x of arr.slice(0, 5)) {
      console.log(`        ${x.loc}  ${x.code}`);
    }
    if (arr.length > 5) console.log(`        … 另有 ${arr.length - 5} 处`);
  }
}

console.log('\n' + '='.repeat(84));
const c = { P0: 0, P1: 0, P2: 0 };
findings.forEach((x) => c[x.level]++);
console.log(`合计：${findings.length} 项  →  P0 ${c.P0} · P1 ${c.P1} · P2 ${c.P2}`);
console.log('='.repeat(84));
