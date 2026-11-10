import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const V5 = join(HERE, '_分析-智跑校园-v5', 'projects');
const V4 = join(HERE, '_分析-智跑校园-v4', 'projects');

let pass = 0, fail = 0;
const check = (n, ok, d = '') => {
  if (ok) { pass++; console.log(`  [OK]   ${n}`); }
  else { fail++; console.log(`  [FAIL] ${n}${d ? ' -> ' + d : ''}`); }
};
const warn = (n, d = '') => console.log(`  [WARN] ${n}${d ? ' -> ' + d : ''}`);

function viewNet(s) {
  let opens = 0, closes = 0, p = 0;
  while (p < s.length) {
    if (s.startsWith('</View>', p)) { closes++; p += 7; continue; }
    if (s.startsWith('<View', p) && /[\s>]/.test(s[p + 5] ?? '')) {
      let j = p + 5, q = null;
      for (; j < s.length; j++) {
        const c = s[j];
        if (q) { if (c === q) q = null; continue; }
        if (c === '"' || c === "'") { q = c; continue; }
        if (c === '>') break;
      }
      if (!/\/\s*>$/.test(s.slice(p, j + 1))) opens++;
      p = j + 1; continue;
    }
    p++;
  }
  return opens - closes;
}

console.log('='.repeat(78));
console.log('v5 首页美化改动 · 批判性核查');
console.log('='.repeat(78));

const idx = readFileSync(join(V5, 'src/pages/index/index.tsx'), 'utf8');
const pub = readFileSync(join(V5, 'src/pages/publish/index.tsx'), 'utf8');
const css = readFileSync(join(V5, 'src/app.css'), 'utf8');

console.log('\n### 1. 结构完整性（改动后不能破坏 JSX）');
for (const [n, s] of [['index/index.tsx', idx], ['publish/index.tsx', pub]]) {
  check(`${n} View 配平 (net=${viewNet(s)})`, viewNet(s) === 0);
  const ob = (s.match(/\{/g) || []).length, cb = (s.match(/\}/g) || []).length;
  check(`${n} 花括号配平 (${ob}/${cb})`, ob === cb);
  const pr = (s.match(/\(/g) || []).length, prc = (s.match(/\)/g) || []).length;
  check(`${n} 圆括号配平 (${pr}/${prc})`, pr === prc);
}

console.log('\n### 2. 改动 1：导航栏');
check('状态栏高度已取', /statusBarHeight/.test(idx));
check('胶囊避让已做', /capsuleRight/.test(idx) && /getMenuButtonBoundingClientRect/.test(idx));
check('渐变色已用', /bg-gradient-to-br from-primary to-success/.test(idx));
check('标题「智跑校园」已加', /智跑校园/.test(idx));
check('config 标题已改', /navigationBarTitleText: '智跑校园'/.test(readFileSync(join(V5, 'src/pages/index/index.config.ts'), 'utf8')));

console.log('\n### 3. 改动 2：搜索栏');
check('聚焦态 state 已加', /searchFocused/.test(idx));
check('白底圆角已加', /bg-surface rounded-full px-4 h-10/.test(idx));
check('清除按钮已加', /setKeyword\(''\)/.test(idx));
check('热门标签已加', /热门标签/.test(idx));

console.log('\n### 4. 改动 3：动效');
check('anim-fade-in 已用', /anim-fade-in/.test(idx));
check('anim-pulse-soft 已用', /anim-pulse-soft/.test(idx));
check('anim-glow 已用', /anim-glow/.test(idx));
check('press-scale 已用', /press-scale/.test(idx));
check('app.css 有 anim-glow 定义', /\.anim-glow\s*\{/.test(css));
check('app.css 有 glow keyframes', /@keyframes glow/.test(css));

console.log('\n### 5. 改动 4：地图');
check('Map 组件已用', /<Map/.test(pub));
check('H5 降级已做', /Taro\.getEnv\(\)\s*===\s*Taro\.ENV_TYPE\.WEAPP/.test(pub));
check('chooseLocation 已用', /chooseLocation/.test(pub));
check('getLocation 已用', /getLocation/.test(pub));
const appCfg = readFileSync(join(V5, 'src/app.config.ts'), 'utf8');
check('app.config 声明 permission', /'scope\.userLocation'/.test(appCfg));
check('app.config 声明 requiredPrivateInfos', /requiredPrivateInfos/.test(appCfg));

console.log('\n### 6. ⚠️ 发现的问题');

// 问题A：分享文案语义不通
const shareMatch = idx.match(/title: '([^']*代取[^']*)'/);
if (shareMatch) {
  const t = shareMatch[1];
  const bad = /会员代取/.test(t);
  check(`分享文案通顺：「${t}」`, !bad, bad ? '含「会员代取」，语义不通（应为"跑腿费"或"顺路赚"）' : '');
}

// 问题B：requiredPrivateInfos 是否漏了 openLocation
const privMatch = appCfg.match(/requiredPrivateInfos:\s*\[([^\]]*)\]/);
if (privMatch) {
  const list = privMatch[1];
  const has = (k) => list.includes(k);
  warn(`requiredPrivateInfos = [${list.replace(/\s+/g, ' ').trim()}]`);
  // 只有真正调用了 openLocation 才需要声明
  const usesOpenLocation = /openLocation/.test(idx + pub);
  check('未调用 openLocation 则无需声明', !usesOpenLocation || has('openLocation'),
    usesOpenLocation ? '代码里调了 openLocation 但未声明' : '');
}

// 问题C：Map 是否有 markers（否则地图上看不到标记）
if (/<Map/.test(pub)) {
  check('Map 配了 markers', /markers=/.test(pub), '没有 markers 地图上无标记');
  check('Map 配了 showLocation', /showLocation/.test(pub));
}

// 问题D：Tab 滑动指示条是否有 transition
check('指示条用 transition 平滑移动', /transition-all|transition:\s*'left/.test(idx));

console.log('\n### 7. 跨端合规复查');
// 垂直 Text 是否都加了 block（只看新增区域附近）
const newRegion = idx.slice(idx.indexOf('bg-gradient-to-br'), idx.indexOf('bg-gradient-to-br') + 900);
const textsNoBlock = [...newRegion.matchAll(/<Text className="([^"]*)"/g)]
  .filter((m) => !/\bblock\b/.test(m[1]));
check('新增导航栏区域 Text 均带 block', textsNoBlock.length === 0,
  textsNoBlock.map((m) => m[1]).join(' | '));

// 是否有硬编码 px 尺寸
check('无 w-[NNNpx] 任意值', !/w-\[\d+px\]/.test(idx + pub));
check('无 style width 硬编码', !/style=\{\{[^}]*width:\s*'\d+px'/.test(idx + pub));

console.log('\n### 8. 回归：原有功能是否被破坏');
const oldIdx = readFileSync(join(V4, 'src/pages/index/index.tsx'), 'utf8');
const mustKeep = ['formatDistance', 'PACKAGE_SIZE_TEXT', 'onScrollToLower', 'usePullDownRefresh', 'Skeleton'];
for (const k of mustKeep) {
  check(`首页保留 ${k}`, idx.includes(k), !oldIdx.includes(k) ? '(原本也没有)' : '');
}
const oldPub = readFileSync(join(V4, 'src/pages/publish/index.tsx'), 'utf8');
for (const k of ['parseDemand', 'geoApi', 'SIZES']) {
  check(`发布页保留 ${k}`, pub.includes(k), !oldPub.includes(k) ? '(原本也没有)' : '');
}

console.log('\n' + '='.repeat(78));
console.log(`结果：通过 ${pass} 项，失败 ${fail} 项`);
console.log('='.repeat(78));
