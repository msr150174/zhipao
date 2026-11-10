import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const V7 = join(HERE, '_分析-智跑校园-v7', 'projects');
const V6 = join(HERE, '_分析-智跑校园-v6', 'projects');

let pass = 0, fail = 0, warn = 0;
const ok = (n, d = '') => { pass++; console.log(`  [OK]   ${n}${d ? ' — ' + d : ''}`); };
const bad = (n, d = '') => { fail++; console.log(`  [FAIL] ${n}${d ? ' — ' + d : ''}`); };
const wr = (n, d = '') => { warn++; console.log(`  [WARN] ${n}${d ? ' — ' + d : ''}`); };
const check = (n, cond, d = '') => (cond ? ok(n, d) : bad(n, d));

console.log('='.repeat(80));
console.log('v7 独立核实：Coze 报告的落地情况');
console.log('='.repeat(80));

const pages = readdirSync(join(V7, 'src/pages'));
const comps = existsSync(join(V7, 'src/components')) ? readdirSync(join(V7, 'src/components')) : [];
const appCss = readFileSync(join(V7, 'src/app.css'), 'utf8');
const appCfg = readFileSync(join(V7, 'src/app.config.ts'), 'utf8');
const appTsx = readFileSync(join(V7, 'src/app.tsx'), 'utf8');
const card = readFileSync(join(V7, 'src/components/ui/card.tsx'), 'utf8');

console.log('\n### 1. 新页面（Coze 声称新建的）');
for (const [n, p] of [
  ['T14 信用分规则页', 'credit-rule'],
  ['T15 关于我们', 'about'],
  ['T06 用户协议', 'agreement'],
  ['T06 隐私政策', 'privacy'],
  ['T11 手机号登录', 'login-phone'],
  ['T13 跑腿员入驻', 'runner-apply'],
  ['T13 审核后台', 'admin'],
]) {
  check(n, pages.includes(p), pages.includes(p) ? '' : '缺失');
}

console.log('\n### 2. 新组件');
for (const [n, f] of [
  ['T07 AppHeader', 'app-header.tsx'],
  ['T10 LocationMap', 'location-map.tsx'],
  ['T18 EmptyState', 'empty-state.tsx'],
  ['T19 SuccessOverlay', 'success-overlay.tsx'],
  ['T06 FirstVisitDialog', 'first-visit-dialog.tsx'],
  ['T22 OrderCardSkeleton', 'order-card-skeleton.tsx'],
  ['T08 FloatingAssistant', 'floating-assistant.tsx'],
]) {
  check(n, comps.includes(f));
}

console.log('\n### 3. app.config.ts 路由注册 + 隐私检查');
const allPages = [...new Set(pages)].filter((p) => existsSync(join(V7, 'src/pages', p, 'index.tsx')));
const notRegistered = allPages.filter((p) => !appCfg.includes(`pages/${p}/index`));
check('所有页面都已注册路由', notRegistered.length === 0, notRegistered.join(', '));
check('T06 __usePrivacyCheck__ 已开', /__usePrivacyCheck__\s*:\s*true/.test(appCfg));
check('T10 requiredPrivateInfos 已声明', /requiredPrivateInfos/.test(appCfg));
check('T10 permission 已声明', /scope\.userLocation/.test(appCfg));
check('T06 FirstVisitDialog 已挂载', /FirstVisitDialog/.test(appTsx));

console.log('\n### 4. app.css 动效');
check('T26 float keyframe', /@keyframes float/.test(appCss));
check('T26 .anim-float', /\.anim-float/.test(appCss));
check('T26 .dot-loading', /\.dot-loading/.test(appCss));
check('T20 渐变 token (5 套)', ['brand', 'fresh', 'warm', 'cool', 'deep'].every((k) => appCss.includes(`--gradient-${k}`)));
check('T20 .grad-* 工具类', /\.grad-brand/.test(appCss) && /\.grad-warm/.test(appCss));
check('T22 skeleton-shimmer 仍在', /\.skeleton-shimmer/.test(appCss));
check('T19 anim-pop 仍在', /\.anim-pop/.test(appCss));
check('T21 anim-shake 仍在', /\.anim-shake/.test(appCss));

console.log('\n### 5. T25 圆角统一');
check('Card 默认圆角改为 rounded-2xl', /rounded-2xl/.test(card) && !/rounded-lg/.test(card.split('cva(')[1]?.slice(0, 400) ?? ''));

console.log('\n### 6. 各任务在页面里的实际使用');
const idx = readFileSync(join(V7, 'src/pages/index/index.tsx'), 'utf8');
const od = readFileSync(join(V7, 'src/pages/order-detail/index.tsx'), 'utf8');
const credit = readFileSync(join(V7, 'src/pages/credit/index.tsx'), 'utf8');
const creditRule = existsSync(join(V7, 'src/pages/credit-rule/index.tsx'))
  ? readFileSync(join(V7, 'src/pages/credit-rule/index.tsx'), 'utf8') : '';

check('T16 首页搜索历史', /history|getStorageSync/.test(idx));
check('T17 首页 loadError', /loadError/.test(idx));
check('T18 首页用 EmptyState', /EmptyState/.test(idx));
check('T19 首页用 SuccessOverlay', /SuccessOverlay/.test(idx));
check('T22 首页用 OrderCardSkeleton', /OrderCardSkeleton/.test(idx));
check('T24 Tab 指示条已改（无 indicatorX）', !/indicatorX/.test(idx));
check('T10 详情页用 LocationMap', /LocationMap/.test(od));
check('T14 credit 用 navigateTo 跳规则页', /credit-rule/.test(credit));
check('T23 credit 用 Progress', /Progress/.test(credit));
check('T14 credit-rule 页含门槛', /60|50|40/.test(creditRule));

console.log('\n### 7. 后端（T05 坐标）');
const svc = readFileSync(join(V7, 'server/src/orders/orders.service.ts'), 'utf8');
check('T05 toOrderView 返回 stationLng', /stationLng/.test(svc));
check('T05 toOrderView 返回 stationLat', /stationLat/.test(svc));
check('T05 OrderRow 声明坐标列', /station_lng/.test(svc) && /station_lat/.test(svc));
check('T05 publish 写入坐标', /station_lng:\s*st/.test(svc) || /station_lng/.test(svc));

console.log('\n### 8. ⚠️ 未落地项（T11/T12/T13 后端）');
check('T11 SmsService 存在', existsSync(join(V7, 'server/src/auth/sms.service.ts')));
check('T12 OcrService 存在', existsSync(join(V7, 'server/src/ocr/ocr.service.ts')));
check('T13 runner 模块存在', existsSync(join(V7, 'server/src/runner')));
check('T13 admin 模块存在', existsSync(join(V7, 'server/src/admin')));

console.log('\n### 9. 跨端规范抽查（新增组件）');
const viewNet = (s) => {
  let o = 0, c = 0, p = 0;
  while (p < s.length) {
    if (s.startsWith('</View>', p)) { c++; p += 7; continue; }
    if (s.startsWith('<View', p) && /[\s>]/.test(s[p + 5] ?? '')) {
      let j = p + 5, q = null;
      for (; j < s.length; j++) {
        const ch = s[j];
        if (q) { if (ch === q) q = null; continue; }
        if (ch === '"' || ch === "'") { q = ch; continue; }
        if (ch === '>') break;
      }
      if (!/\/\s*>$/.test(s.slice(p, j + 1))) o++;
      p = j + 1; continue;
    }
    p++;
  }
  return o - c;
};
for (const f of ['app-header.tsx', 'location-map.tsx', 'empty-state.tsx', 'success-overlay.tsx', 'first-visit-dialog.tsx', 'order-card-skeleton.tsx', 'floating-assistant.tsx']) {
  const p = join(V7, 'src/components', f);
  if (!existsSync(p)) continue;
  const s = readFileSync(p, 'utf8');
  const net = viewNet(s);
  const bads = [];
  if (net !== 0) bads.push(`View 不配平(${net})`);
  if (/w-\[\d+px\]/.test(s)) bads.push('硬编码 px');

  // ★ 只检查"顶层 Text"是否带 block。
  //   嵌套在 block 父级内的行内链接（如《用户协议》文字链）不该加 block，
  //   加了反而换行破坏排版 —— 所以按缩进判断层级，只查顶层。
  const lines = s.split('\n');
  const topLevelNoBlock = lines.filter((l) => {
    const m = l.match(/^(\s*)<Text className="([^"]*)"/);
    if (!m) return false;
    const indent = m[1].length;
    const cls = m[2];
    // 顶层 = 缩进 <= 8（组件内直接子级）；且不是自闭合
    return indent <= 8 && !/\bblock\b/.test(cls);
  });
  if (topLevelNoBlock.length) bads.push(`顶层 Text 缺 block(${topLevelNoBlock.length})`);

  check(f, bads.length === 0, bads.join(', '));
}

console.log('\n' + '='.repeat(80));
console.log(`结果：通过 ${pass} · 失败 ${fail} · 警告 ${warn}`);
console.log('='.repeat(80));
