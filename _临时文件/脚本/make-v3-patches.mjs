import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJ = join(HERE, '_分析-智跑校园-v3', 'projects');
const OUT = join(HERE, '易援小程序', '补丁-v3');
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

const results = [];
const rec = (n, ok, why) => results.push({ n, ok, why });

// JSX <View> 配平（字符级，正确处理跨行自闭合）
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
      const tag = s.slice(p, j + 1);
      if (!/\/\s*>$/.test(tag)) opens++;
      p = j + 1;
      continue;
    }
    p++;
  }
  return opens - closes;
}

// ─────────────────────────────────────────────────────────────
// ① P0 verify-patches.mjs：去掉明文密钥 + 修断言写法
// ─────────────────────────────────────────────────────────────
{
  const p = join(PROJ, 'verify-patches.mjs');
  let t = readFileSync(p, 'utf8');
  const orig = t;

  // 1a. 断言写法：config.get(.WX_APP_ID  →  用环境变量名字符串判断
  t = t.replace(
    /check\('从环境变量读 WX_APP_ID \/ WX_APP_SECRET', \(\) => \{[\s\S]*?\n  \}\);/,
    `check('从环境变量读 WX_APP_ID / WX_APP_SECRET（且不得硬编码明文）', () => {
    const a = mustContain(src, 'WX_APP_ID');
    if (a !== true) return a;
    const b = mustContain(src, 'WX_APP_SECRET');
    if (b !== true) return b;

    // ★ 用「32 位 hex 字面量」这个**模式**判断，而不是比对具体密钥值。
    //   原实现写的是 if (_src.includes('<真实AppSecret>')) ——
    //   为了防泄漏却在防线里写下了密钥本身，等于把要防的东西放进防线。
    const _src = read('server/src/auth/auth.controller.ts');
    const HEX32 = /['"][0-9a-f]{32}['"]/i;
    if (HEX32.test(_src)) {
      return '源码中检测到疑似明文密钥（32 位 hex 字面量），必须改为 config.get() 读取';
    }
    return true;
  });`,
  );

  const stillLeak = /65310f1244e78ae9ded6265bc328b2e6|wxc9c6da82f1b21327/.test(t);
  if (t !== orig && !stillLeak) {
    writeFileSync(join(OUT, 'verify-patches.mjs'), t, 'utf8');
    rec('verify-patches.mjs', true, '移除明文密钥 + 修正断言（改用 hex 模式检测）');
  } else if (stillLeak) {
    rec('verify-patches.mjs', false, '替换后仍残留明文密钥');
  } else {
    rec('verify-patches.mjs', false, '未匹配到目标断言段');
  }
}

// ─────────────────────────────────────────────────────────────
// ② P1 order-list 搜索框：拆两层 View
// ─────────────────────────────────────────────────────────────
{
  const p = join(PROJ, 'src', 'pages', 'order-list', 'index.tsx');
  let t = readFileSync(p, 'utf8');

  const bad = `        <View className="flex items-center bg-surface-container rounded-full px-4 py-2 gap-2 mt-4">
          <Search size={16} color="#6B7280" />
          <Input
            className="w-full bg-transparent text-sm"
            value={keyword}
            onInput={(e) => setKeyword(e.detail.value)}
            placeholder="搜索订单号/驿站/楼栋"
            onBlur={load}
          />
        </View>`;

  const good = `        {/* ★ 修复：原先 flex + items-center + 背景色在同一层，而原生 Input 是其直接子元素。
            违反 AGENTS.md：「Input 必须 View 包裹，样式放外层」「flex 放 View 上」。
            后果：Input 无法正确撑开/透明化，背景色显形为一整块灰色。
            修法：拆两层 —— 外层负责布局，内层负责外观。 */}
        <View className="flex items-center gap-2 mt-4">
          <View className="flex-1 flex items-center gap-2 bg-surface-container rounded-full px-4 py-2">
            <Search size={16} color="#6B7280" />
            <Input
              className="w-full bg-transparent text-sm"
              value={keyword}
              onInput={(e) => setKeyword(e.detail.value)}
              placeholder="搜索订单号/驿站/楼栋"
              onBlur={load}
            />
          </View>
        </View>`;

  if (t.includes(bad) && viewNet(good) === 0) {
    t = t.replace(bad, good);
    if (viewNet(t) === 0) {
      writeFileSync(join(OUT, 'order-list-index.tsx'), t, 'utf8');
      rec('order-list/index.tsx', true, '搜索框拆两层（修 H5 灰块）');
    } else {
      rec('order-list/index.tsx', false, `整文件 View 不配平（${viewNet(t)}）`);
    }
  } else {
    rec('order-list/index.tsx', false, '未匹配搜索框代码块');
  }
}

// ─────────────────────────────────────────────────────────────
// ③ P1 publish 报酬输入框：内层承载 flex
// ─────────────────────────────────────────────────────────────
{
  const p = join(PROJ, 'src', 'pages', 'publish', 'index.tsx');
  let t = readFileSync(p, 'utf8');

  const bad = `            <View className="flex items-center bg-surface-container rounded-xl px-4 py-2">
              <Text className="text-primary font-bold mr-1 block">￥</Text>
              <Input
                className="flex-1 bg-transparent"
                type="digit"
                value={reward}
                onInput={(e) => setReward(e.detail.value)}
                placeholder="5.00"
              />
            </View>`;

  const good = `            {/* ★ 修复：原先 flex + 背景同层，Text 与 Input 均为直接子元素；
                且 Input 自身用了 flex-1（H5 端 flex 对原生 Input 不生效）。
                修法：内层 View 承载 flex 布局，Input 只负责输入。 */}
            <View className="bg-surface-container rounded-xl px-4 py-2">
              <View className="flex items-center">
                <Text className="text-primary font-bold mr-1 block">￥</Text>
                <Input
                  className="w-full bg-transparent"
                  type="digit"
                  value={reward}
                  onInput={(e) => setReward(e.detail.value)}
                  placeholder="5.00"
                />
              </View>
            </View>`;

  if (t.includes(bad) && viewNet(good) === 0) {
    t = t.replace(bad, good);
    if (viewNet(t) === 0) {
      writeFileSync(join(OUT, 'publish-index.tsx'), t, 'utf8');
      rec('publish/index.tsx', true, '报酬输入框拆内层（修 H5 flex 失效）');
    } else {
      rec('publish/index.tsx', false, `整文件 View 不配平（${viewNet(t)}）`);
    }
  } else {
    rec('publish/index.tsx', false, '未匹配报酬输入框代码块');
  }
}

// ─────────────────────────────────────────────────────────────
// ④ P1 mine 退出弹窗：遮罩与弹窗拆兄弟节点
// ─────────────────────────────────────────────────────────────
{
  const p = join(PROJ, 'src', 'pages', 'mine', 'index.tsx');
  let t = readFileSync(p, 'utf8');

  const si = t.indexOf('{/* 退出确认弹窗 */}');
  if (si < 0) {
    rec('mine/index.tsx', false, '未找到「退出确认弹窗」注释');
  } else {
    const openMark = '{showLogout && (';
    const oi = t.indexOf(openMark, si);
    let endAbs = -1;
    if (oi >= 0) {
      let d = 0;
      for (let j = oi + openMark.length - 1; j < t.length; j++) {
        const c = t[j];
        if (c === '(') d++;
        else if (c === ')') { d--; if (d === 0 && t[j + 1] === '}') { endAbs = j + 2; break; } }
      }
    }
    if (endAbs < 0) {
      rec('mine/index.tsx', false, '括号配对未定位到弹窗块');
    } else {
      const oldBlock = t.slice(si, endAbs);
      const NB = [
        '{/* 退出确认弹窗',
        '    ★ 修复：原先遮罩用 `bg-black opacity-50`，而它同时是弹窗的父元素。',
        '      Tailwind 的 opacity 作用于整个子树 → 弹窗本体被一起淡化（真机可见弹窗发灰）。',
        '      修法：遮罩与弹窗拆为**兄弟节点**；遮罩用 `bg-black/50`（背景透明度）。 */}',
        '      {showLogout && (',
        '        <>',
        '          {/* 遮罩：独立节点 */}',
        '          <View',
        '            className="fixed inset-0 z-50 bg-black/50"',
        "            style={{ position: 'fixed' }}",
        '            onClick={() => setShowLogout(false)}',
        '          />',
        '          {/* 弹窗：独立节点，不继承遮罩透明度 */}',
        '          <View',
        '            className="fixed inset-x-0 bottom-0 z-50 bg-surface rounded-t-2xl w-full p-6 pb-8"',
        "            style={{ position: 'fixed' }}",
        '          >',
        '            <View className="w-10 h-1 rounded-full bg-surface-container mx-auto mb-4" />',
        '            <Text className="block text-lg font-semibold text-on-surface text-center">',
        '              退出登录',
        '            </Text>',
        '            <Text className="block text-sm text-on-surface-variant mt-2 text-center">',
        '              确定要退出当前账号吗？退出后需要重新登录。',
        '            </Text>',
        '            <View className="mt-6 space-y-3">',
        '              <Button className="w-full bg-primary rounded-xl py-3" onClick={onLogout}>',
        '                确认退出',
        '              </Button>',
        '              <Button',
        '                variant="secondary"',
        '                className="w-full rounded-xl py-3"',
        '                onClick={() => setShowLogout(false)}',
        '              >',
        '                取消',
        '              </Button>',
        '            </View>',
        '          </View>',
        '        </>',
        '      )}',
      ].join('\n');

      let nb = NB;
      const net = viewNet(nb);
      if (net > 0) {
        // 自动补齐缺失的闭合
        const pads = Array.from({ length: net }, () => '          </View>').join('\n');
        nb = nb.replace(/\n(\s*)<\/>/, `\n${pads}\n$1</>`);
      }

      if (viewNet(nb) !== 0) {
        rec('mine/index.tsx', false, `新块 View 不配平（${viewNet(nb)}）`);
      } else {
        const out = t.slice(0, si) + nb + t.slice(endAbs);
        if (viewNet(out) !== 0) {
          rec('mine/index.tsx', false, `整文件 View 不配平（${viewNet(out)}）`);
        } else {
          writeFileSync(join(OUT, 'mine-index.tsx'), out, 'utf8');
          rec('mine/index.tsx', true, '弹窗拆兄弟节点（修真机弹窗发灰）');
        }
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────
// ⑤ P0 分析文档脱敏（不改原文件，另出脱敏副本）
// ─────────────────────────────────────────────────────────────
{
  const orig = join(HERE, '易援小程序', '智跑校园v2-全部问题汇总.md');
  const alt = join(PROJ, 'assets', '智跑校园v2-全部问题汇总.md');
  const src = existsSync(orig) ? orig : (existsSync(alt) ? alt : null);
  if (!src) {
    rec('资产文档脱敏', false, '未找到 v2 汇总文档');
  } else {
    let t = readFileSync(src, 'utf8');
    const before = t.length;
    t = t.replace(/65310f1244e78ae9ded6265bc328b2e6/g, '6531****（已脱敏）');
    t = t.replace(/wxc9c6da82f1b21327/g, 'wx****1327');
    const changed = t.length !== before || !t.includes('65310f1244e78ae9ded6265bc328b2e6');
    writeFileSync(join(OUT, '智跑校园v2-全部问题汇总-脱敏版.md'), t, 'utf8');
    rec('智跑校园v2-全部问题汇总-脱敏版.md', changed,
      changed ? '密钥已替换为掩码' : '未发生替换（可能本就不含密钥）');
  }
}

console.log('='.repeat(78));
console.log('v3 修复补丁生成结果');
console.log('='.repeat(78));
for (const r of results) {
  console.log(`${r.ok ? '[OK]  ' : '[FAIL]'} ${r.n}`);
  console.log(`        ${r.why}`);
}
console.log('\n输出: ' + OUT);
