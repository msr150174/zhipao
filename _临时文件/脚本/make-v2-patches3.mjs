import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJ = join(HERE, '_分析-智跑校园-v2', 'projects');
const OUT = join(HERE, '易援小程序', '补丁-v2');
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

const results = [];
const rec = (n, ok, why) => results.push({ n, ok, why });

// ─────────────────────────────────────────────────────────
// E1: project.config.json —— 移除会误伤 TabBar 图标的 ignore 规则
// ─────────────────────────────────────────────────────────
{
  const p = join(PROJ, 'project.config.json');
  const cfg = JSON.parse(readFileSync(p, 'utf8'));

  const before = JSON.stringify(cfg.packOptions?.ignore ?? []);
  // 修复：清空 ignore
  cfg.packOptions = { ignore: [] };

  writeFileSync(join(OUT, 'project.config.json'), JSON.stringify(cfg, null, 2) + '\n', 'utf8');
  rec(
    'project.config.json',
    true,
    `packOptions.ignore 由 ${before} 改为 []（原规则会排除 dist/assets，即 TabBar 的 6 个图标）`,
  );
}

// ─────────────────────────────────────────────────────────
// E2: field.tsx —— 注释里的 Tailwind 类名仍会被扫描并生成非法 CSS
// ─────────────────────────────────────────────────────────
{
  const p = join(PROJ, 'src', 'components', 'ui', 'field.tsx');
  let t = readFileSync(p, 'utf8');

  const bad = `        // "group-has-[[data-orientation=horizontal]]/field:text-balance", // text-balance not supported in Taro`;
  const good = `        // 注意：此处不要写 Tailwind 类名字面量（即使注释掉也不行）。
        // Tailwind 4 扫描的是源文件原始文本，注释中的类名同样会被提取并生成 CSS，
        // 例如 group-has-[...] 会生成小程序不支持的 :has() 选择器。
        // 原规则 group-has-[[data-orientation=horizontal]]/field:text-balance 已移除。`;

  if (t.includes(bad)) {
    t = t.replace(bad, good);
    writeFileSync(join(OUT, 'field.tsx'), t, 'utf8');
    rec('src/components/ui/field.tsx', true, '移除注释中的 Tailwind 类名（它会生成 :has() 非法选择器）');
  } else {
    // 宽松匹配
    const re = /\/\/\s*"group-has-\[\[data-orientation=horizontal\]\]\/field:text-balance"[^\n]*/;
    if (re.test(t)) {
      t = t.replace(re, good.trim().split('\n')[0]);
      writeFileSync(join(OUT, 'field.tsx'), t, 'utf8');
      rec('src/components/ui/field.tsx', true, '宽松匹配替换成功');
    } else {
      rec('src/components/ui/field.tsx', false, '未找到目标注释行');
    }
  }
}

// ─────────────────────────────────────────────────────────
// E5: sitemap.json（新建）
// ─────────────────────────────────────────────────────────
{
  const content = `{
  "desc": "关于本文件的更多信息，请参考文档 https://developers.weixin.qq.com/miniprogram/dev/framework/sitemap.html",
  "rules": [
    {
      "action": "allow",
      "page": "*"
    }
  ]
}
`;
  writeFileSync(join(OUT, 'sitemap.json'), content, 'utf8');
  rec('src/sitemap.json', true, '新建（小程序要求，缺失会有警告）');
}

// ─────────────────────────────────────────────────────────
// E6: .env.example（后端环境变量契约）
// ─────────────────────────────────────────────────────────
{
  const content = `# ============================================================
# 智跑校园 · 服务端环境变量模板
# 用法：cp server/.env.example server/.env 然后填入真实值
# ★ 不要把填写后的 .env 提交到 Git
# ============================================================

# ---------- 服务 ----------
SERVER_PORT=3000

# ---------- 数据库（Supabase / PostgreSQL）----------
# Coze 沙盒会自动注入 COZE_SUPABASE_*；本地开发时手工填写
# COZE_SUPABASE_URL=
# COZE_SUPABASE_ANON_KEY=
# COZE_SUPABASE_SERVICE_ROLE_KEY=

# ---------- 会话密钥（★ 必填，长度 >= 32）----------
# 生成：openssl rand -hex 32
# 未配置或过短时服务会拒绝启动（刻意设计，防止弱密钥上线）
JWT_SECRET=

# ---------- 微信小程序（★ 真实登录必需）----------
# 获取：微信公众平台 → 开发 → 开发管理 → 开发设置
WX_APP_ID=
WX_APP_SECRET=

# ---------- 腾讯位置服务（距离计算）----------
# 获取：https://lbs.qq.com/ → 控制台 → 应用管理 → Key 管理
# 若开启了「签名校验」，还需 TENCENT_MAP_SK
# 未配置时：距离功能降级，前端显示「测量中」（不显示假距离）
TENCENT_MAP_KEY=
# TENCENT_MAP_SK=
`;
  writeFileSync(join(OUT, 'env.example'), content, 'utf8');
  rec('server/.env.example', true, '新建（原工程缺此模板，新环境不知该配哪些变量）');
}

console.log('='.repeat(76));
console.log('本轮补丁生成结果');
console.log('='.repeat(76));
for (const r of results) {
  console.log(`${r.ok ? '[OK]  ' : '[FAIL]'} ${r.n}`);
  console.log(`        ${r.why}`);
}
console.log('\n输出: ' + OUT);
