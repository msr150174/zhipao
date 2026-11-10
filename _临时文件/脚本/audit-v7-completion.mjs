import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const V7 = join(HERE, '_分析-智跑校园-v7', 'projects');

let pass = 0, fail = 0;
const ok = (n, d = '') => { pass++; console.log(`  [OK]   ${n}${d ? ' — ' + d : ''}`); };
const bad = (n, d = '') => { fail++; console.log(`  [--]   ${n}${d ? ' — ' + d : ''}`); };
const ck = (n, c, d = '') => (c ? ok(n, d) : bad(n, d));

console.log('='.repeat(82));
console.log('v7 完工度盘点（用于生成 Coze 最后更新清单）');
console.log('='.repeat(82));

const pages = readdirSync(join(V7, 'src/pages'));
const comps = readdirSync(join(V7, 'src/components'));
const serverSrc = join(V7, 'server/src');
const modules = existsSync(serverSrc) ? readdirSync(serverSrc).filter((f) => !f.includes('.')) : [];

console.log('\n### A. 页面清单（共 ' + pages.length + ' 个）');
console.log('  ' + pages.join(', '));

console.log('\n### B. 后端模块（共 ' + modules.length + ' 个）');
console.log('  ' + modules.join(', '));

console.log('\n### C. 已完成的组件（src/components/）');
for (const f of comps.filter((c) => c.endsWith('.tsx'))) {
  const s = readFileSync(join(V7, 'src/components', f), 'utf8');
  const lines = s.split('\n').length;
  console.log(`  ${f.padEnd(28)} ${String(lines).padStart(4)} 行`);
}

console.log('\n### D. 逐模块完工度');
const checks = [
  ['地图-取件信息', () => readFileSync(join(V7, 'src/pages/order-detail/index.tsx'), 'utf8').split('{/* 取件信息 */}')[1]?.split('{/* 收件信息 */}')[0]?.includes('LocationMap') ?? false],
  ['地图-收件信息', () => {
    const s = readFileSync(join(V7, 'src/pages/order-detail/index.tsx'), 'utf8');
    const seg = s.split('{/* 收件信息 */}')[1] ?? '';
    return seg.slice(0, 1200).includes('LocationMap');
  }],
  ['地图-发布页选点', () => readFileSync(join(V7, 'src/pages/publish/index.tsx'), 'utf8').includes('LocationMap')],
  ['地图-首页入口', () => readFileSync(join(V7, 'src/pages/index/index.tsx'), 'utf8').includes('LocationMap')],
  ['浮窗-可拖动', () => /onTouchMove|onTouchStart/.test(readFileSync(join(V7, 'src/components/floating-assistant.tsx'), 'utf8'))],
  ['浮窗-位置统一', () => {
    const fps = ['index', 'mine', 'order-list', 'order-detail'];
    const bs = fps.map((p) => {
      const f = join(V7, 'src/pages', p, 'index.tsx');
      if (!existsSync(f)) return null;
      const m = readFileSync(f, 'utf8').match(/<FloatingAssistant[^>]*bottom=\{(\d+)\}/);
      return m ? m[1] : null;
    }).filter(Boolean);
    return new Set(bs).size <= 1;
  }],
  ['跑腿员入驻-页面', () => pages.includes('runner-apply')],
  ['跑腿员入驻-后端', () => modules.includes('runner')],
  ['账户设置-页面', () => pages.includes('account') || pages.includes('settings')],
  ['账户设置-后端', () => /change-phone|updateProfile|deleteAccount/.test(
    existsSync(join(serverSrc, 'users')) ? readdirSync(join(serverSrc, 'users')).map((f) => readFileSync(join(serverSrc, 'users', f), 'utf8')).join('') : '')],
  ['手机号登录-页面', () => pages.includes('login-phone')],
  ['手机号登录-后端', () => existsSync(join(serverSrc, 'auth/sms.service.ts'))],
  ['OCR-后端', () => existsSync(join(serverSrc, 'ocr'))],
  ['审核后台-后端', () => modules.includes('admin')],
];
for (const [n, fn] of checks) {
  let r = false;
  try { r = fn(); } catch { r = false; }
  ck(n, r);
}

console.log('\n### E. mine 页「开发中」占位还有几处');
const mine = readFileSync(join(V7, 'src/pages/mine/index.tsx'), 'utf8');
const notReady = [...mine.matchAll(/notReady\(['"]([^'"]+)['"]/g)].map((m) => m[1]);
console.log('  剩余占位: ' + (notReady.length ? notReady.join(' / ') : '（无）'));

console.log('\n### F. 依赖安装情况（判断 T11/T12 是否已具备）');
const pkg = readFileSync(join(V7, 'server/package.json'), 'utf8');
for (const dep of ['tencentcloud-sdk-nodejs-sms', 'tencentcloud-sdk-nodejs-ocr', '@alicloud/dysmsapi20170525']) {
  console.log(`  ${dep.padEnd(38)} ${pkg.includes(dep) ? '已安装' : '未安装'}`);
}

console.log('\n### G. 环境变量模板');
const envEx = existsSync(join(V7, 'server/.env.example')) ? readFileSync(join(V7, 'server/.env.example'), 'utf8') : '';
console.log('  .env.example 存在: ' + Boolean(envEx));
if (envEx) console.log('  ' + envEx.split('\n').filter((l) => l.trim() && !l.startsWith('#')).join('\n  '));

console.log('\n' + '='.repeat(82));
console.log(`汇总：已具备 ${pass} 项 · 待开发 ${fail} 项`);
console.log('='.repeat(82));
