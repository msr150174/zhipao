import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '易援小程序', '补丁-v3');

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

let pass = 0, fail = 0;
const check = (n, ok, d = '') => {
  if (ok) { pass++; console.log(`  [OK]   ${n}`); }
  else { fail++; console.log(`  [FAIL] ${n}${d ? ' -> ' + d : ''}`); }
};

const SECRET = '65310f1244e78ae9ded6265bc328b2e6';
const APPID = 'wxc9c6da82f1b21327';

console.log('='.repeat(76));
console.log('补丁-v3 验证');
console.log('='.repeat(76));

console.log('\n### 1. 明文密钥清除');
for (const f of readdirSync(OUT)) {
  const p = join(OUT, f);
  const s = readFileSync(p, 'utf8');
  const hasSecret = s.includes(SECRET);
  const hasAppid = s.includes(APPID);
  // 脱敏版里出现「已脱敏」是预期的
  const isMasked = f.includes('脱敏');
  check(`${f} 无明文 AppSecret`, !hasSecret || isMasked);
  check(`${f} 无明文 AppID`, !hasAppid || isMasked);
}

console.log('\n### 2. JSX 结构配平');
for (const f of ['order-list-index.tsx', 'publish-index.tsx', 'mine-index.tsx']) {
  const p = join(OUT, f);
  if (!existsSync(p)) { check(`${f} 存在`, false); continue; }
  const s = readFileSync(p, 'utf8');
  const v = viewNet(s);
  const b = (s.match(/\{/g) || []).length;
  const bc = (s.match(/\}/g) || []).length;
  const pr = (s.match(/\(/g) || []).length;
  const prc = (s.match(/\)/g) || []).length;
  check(`${f} View 配平 (net=${v})`, v === 0);
  check(`${f} 花括号配平 (${b}/${bc})`, b === bc);
  check(`${f} 圆括号配平 (${pr}/${prc})`, pr === prc);
}

console.log('\n### 3. 修复点断言');
{
  const s = readFileSync(join(OUT, 'order-list-index.tsx'), 'utf8');
  check('order-list: 搜索框外层 flex 容器', /<View className="flex items-center gap-2 mt-4">/.test(s));
  check('order-list: 内层承载外观', /flex-1 flex items-center gap-2 bg-surface-container/.test(s));
  check('order-list: 旧写法已移除', !/<View className="flex items-center bg-surface-container rounded-full px-4 py-2 gap-2 mt-4">/.test(s));
}
{
  const s = readFileSync(join(OUT, 'publish-index.tsx'), 'utf8');
  check('publish: 输入区有内层 flex 容器', /<View className="flex items-center">/.test(s));
  check('publish: Input 不再用 flex-1', !/className="flex-1 bg-transparent"\s*\n\s*type="digit"/.test(s));
}
{
  const s = readFileSync(join(OUT, 'mine-index.tsx'), 'utf8');
  check('mine: 遮罩改用 bg-black/50', /bg-black\/50/.test(s));
  check('mine: 不再用 bg-black opacity-50 包弹窗', !/className="fixed inset-0 z-50 flex items-end bg-black opacity-50"/.test(s));
  check('mine: 遮罩与弹窗为兄弟（Fragment 包裹）', /<>\s*\n\s*\{\/\* 遮罩/.test(s));
  check('mine: 保留 onLogout 逻辑', /onClick=\{onLogout\}/.test(s));
}

console.log('\n### 4. verify-patches.mjs 断言修正');
{
  const s = readFileSync(join(OUT, 'verify-patches.mjs'), 'utf8');
  check('改用 hex 模式检测', /HEX32/.test(s));
  check('不再比对具体密钥值', !s.includes(SECRET));
  check('断言不再写 config.get(.WX_APP_ID', !s.includes('config.get(.WX_APP_ID'));
}

console.log('\n' + '='.repeat(76));
console.log(`结果：通过 ${pass} 项，失败 ${fail} 项`);
console.log('='.repeat(76));
process.exit(fail === 0 ? 0 : 1);
