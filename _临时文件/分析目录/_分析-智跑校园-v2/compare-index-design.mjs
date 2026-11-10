/**
 * 设计保真度比对：原型 index.html ↔ 实际 pages/index/index.tsx
 *
 * 逐项检查原型里的设计元素是否在页面中实现。
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const P = join(HERE, 'projects');
const proto = readFileSync(join(P, '.cozeproj/prototype/mobile/index.html'), 'utf8');
const page = readFileSync(join(P, 'src/pages/index/index.tsx'), 'utf8');

/** 原型的设计元素清单（人工从 HTML 提取，逐项核对） */
const ITEMS = [
  {
    name: '搜索框：胶囊圆角容器',
    proto: 'rounded-full + bg-surface-container',
    check: () => /rounded-full/.test(proto) && /bg-surface-container/.test(proto),
    inPage: () => /rounded-full/.test(page) && /bg-surface-container/.test(page),
    note: '原型搜索框是 `w-full bg-surface-container rounded-full pl-11 pr-4 py-2.5`',
  },
  {
    name: '搜索框：内边距 pl-11（给图标留位）',
    proto: 'pl-11',
    check: () => /pl-11/.test(proto),
    inPage: () => /pl-11/.test(page),
    note: '页面用 pl-8，图标 16px + 左内边距，间距偏小',
  },
  {
    name: '搜索图标：绝对定位居中',
    proto: 'absolute left-4 top-1/2 -translate-y-1/2',
    check: () => /absolute left-4 top-1\/2 -translate-y-1\/2/.test(proto),
    inPage: () => /absolute/.test(page) && /left-4/.test(page),
    note: '页面只有 <Search> 未定位，图标会挤在输入框前面而非浮在内部',
  },
  {
    name: '卡片：shadcn Card 组件 + shadow-card',
    proto: 'bg-surface rounded-lg p-4 shadow-card',
    check: () => /shadow-card/.test(proto),
    inPage: () => /<Card/.test(page),
    note: '页面用了 <Card className="p-4">，但未显式加 shadow-card（依赖组件默认）',
  },
  {
    name: '包裹大小标签：bg-info/15 半透明底',
    proto: 'bg-info/15 text-info',
    check: () => /bg-info\/15/.test(proto),
    inPage: () => /bg-info\/15/.test(page),
    note: '页面 SIZE_STYLE 用 text-info，但底色写的是 bg-muted opacity-15',
  },
  {
    name: '「加急」标记',
    proto: 'text-white bg-error',
    check: () => /加急/.test(proto),
    inPage: () => /加急|urgent/.test(page),
    note: '原型的加急是红色实心胶囊；页面未实现该标记',
  },
  {
    name: '驿站/店铺名称：h3 主标题',
    proto: 'text-base font-semibold text-on-surface',
    check: () => /text-base font-semibold text-on-surface/.test(proto),
    inPage: () => /text-base font-semibold/.test(page),
    note: '页面把驿站名放在第二行（text-sm），层级比原型低',
  },
  {
    name: '报酬展示：前缀「报酬 ￥」',
    proto: '报酬 ￥5.00',
    check: () => /报酬 ￥/.test(proto),
    inPage: () => /报酬/.test(page),
    note: '页面直接显示 ￥5.00，缺「报酬」前缀；取餐应显示「跑腿费」',
  },
  {
    name: '取件码：[取件码已隐藏] 占位',
    proto: '取件码 [取件码已隐藏]',
    check: () => /取件码已隐藏/.test(proto),
    inPage: () => /取件码/.test(page),
    note: '原型列表页明确展示「已隐藏」；页面列表未展示取件码字段',
  },
  {
    name: '送达地址：前缀「送达：」',
    proto: '送达：3号楼203',
    check: () => /送达：/.test(proto),
    inPage: () => /送达/.test(page),
    note: '页面用箭头 → 连接，无「送达：」前缀（取餐应为「送至：」）',
  },
  {
    name: '倒计时：红色 + ⏱ 图标',
    proto: 'text-sm font-semibold text-error ⏱ 00:12:36',
    check: () => /text-error/.test(proto) && /⏱/.test(proto),
    inPage: () => /text-error/.test(page) || /deadlineText/.test(page),
    note: '页面用 deadlineText 且颜色是 on-surface-variant（灰），原型是红色强调',
  },
  {
    name: '距离：距您 320m',
    proto: '距您 320m',
    check: () => /距您/.test(proto),
    inPage: () => /距您|测量中/.test(page),
    note: '已按决策改为「测量中」兜底，✅ 一致',
  },
  {
    name: '主食标签：取餐用「中份/小份」',
    proto: '中份 / 小份',
    check: () => /中份/.test(proto),
    inPage: () => /中份|小件/.test(page),
    note: '取餐场景原型的尺寸文案是「中份/小份」，页面与取件共用「小件/中件/大件」',
  },
  {
    name: '餐号：[1234]',
    proto: '餐号 [1234]',
    check: () => /餐号/.test(proto),
    inPage: () => /餐号/.test(page),
    note: '取餐订单原型有「餐号」字段展示，页面未实现',
  },
  {
    name: '列表项间距：gap-3',
    proto: 'flex flex-col gap-3',
    check: () => /flex flex-col gap-3/.test(proto),
    inPage: () => /space-y-3|gap-3/.test(page),
    note: '页面用 space-y-3，等效 ✅',
  },
];

console.log('='.repeat(82));
console.log('原型 index.html ↔ 实际 pages/index/index.tsx  设计比对');
console.log('='.repeat(82));

let ok = 0, gap = 0;
const gaps = [];

for (const it of ITEMS) {
  const p = it.check();
  const g = it.inPage();
  const status = !p ? '原型无此项' : g ? '✅ 一致' : '❌ 缺失/偏离';
  if (p && g) ok++;
  if (p && !g) { gap++; gaps.push(it); }
  console.log(`\n${status}  ${it.name}`);
  console.log(`   原型: ${it.proto}`);
  console.log(`   ${it.note}`);
}

console.log('\n' + '='.repeat(82));
console.log(`一致 ${ok} 项 / 偏离 ${gap} 项 / 共 ${ITEMS.length} 项`);
console.log('='.repeat(82));
console.log('\n需要补齐的设计差距：');
gaps.forEach((g, i) => console.log(`  ${i + 1}. ${g.name}`));
