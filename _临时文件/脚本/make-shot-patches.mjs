import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJ = join(HERE, '_分析-智跑校园-v2', 'projects');
const OUT = join(HERE, '易援小程序', '补丁-v2');
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

const results = [];
const rec = (n, ok, why) => results.push({ n, ok, why });
const count = (s, re) => (s.match(re) || []).length;

/**
 * 统计 JSX <View> 的配平净值（字符级扫描，不依赖正则）
 *
 * 为什么不用正则：自闭合标签写成多行
 *     <View
 *       className="..."
 *     />
 * 用 `<View\b[^>]*\/>` 匹配不到（不跨行），用 `<View\b[\s\S]*?\/>` 又会贪婪跨越多个标签。
 *
 * 这里做一次真正的字符扫描：
 *   - 遇到 </View>            → closes++
 *   - 遇到 <View ... />       → selfClose++（**不计入 opens**）
 *   - 遇到 <View ... >        → opens++
 * 净值 = opens - closes（自闭合标签开合都在自身，不参与配平）
 */
const viewNet = (s) => {
  let opens = 0, closes = 0;
  let i = 0;
  while (i < s.length) {
    if (s.startsWith('</View>', i)) { closes++; i += 7; continue; }
    if (s.startsWith('<View', i) && /[\s>]/.test(s[i + 5] ?? '')) {
      let j = i + 5;
      let quote = null;
      for (; j < s.length; j++) {
        const c = s[j];
        if (quote) { if (c === quote) quote = null; continue; }
        if (c === '"' || c === "'") { quote = c; continue; }
        if (c === '>') break;
      }
      const tagText = s.slice(i, j + 1);
      if (!/\/\s*>$/.test(tagText)) opens++;   // 仅统计非自闭合
      i = j + 1;
      continue;
    }
    i++;
  }
  return opens - closes;
};

// ─────────────────────────────────────────────────────────────
// 图2 修复：order-list 搜索框 —— 两层 View 结构
// ─────────────────────────────────────────────────────────────
{
  const p = join(PROJ, 'src', 'pages', 'order-list', 'index.tsx');
  let t = readFileSync(p, 'utf8');

  const bad = `        {/* 搜索 */}
        <View className="flex items-center bg-surface-container rounded-full px-4 py-2 gap-2 mt-4">
          <Search size={16} color="#6B7280" />
          <Input
            className="w-full bg-transparent text-sm"
            value={keyword}
            onInput={(e) => setKeyword(e.detail.value)}
            placeholder="搜索订单号/驿站/楼栋"
            onBlur={load}
          />
        </View>`;

  const good = `        {/* 搜索
            ★ 修复：原先把 flex 与背景色放在同一个 View 上，而原生 Input 是该 flex 容器的
              直接子元素 —— 违反 AGENTS.md 的跨端规则：
                「Taro 原生 Input 样式：H5 端 inline 导致样式失效 → View 包裹，样式放外层」
                「Taro 原生 Input/Button Flex：H5 不支持 flex → View 包装，flex 放 View 上」
              后果：Input 无法正确撑开/透明化，背景色显形为一整块灰色实心块（真机截图可见）。
              修法：拆两层 —— 外层负责布局(flex)，内层负责外观(背景/圆角/内边距)。 */}
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

  if (t.includes(bad)) {
    t = t.replace(bad, good);
    writeFileSync(join(OUT, 'order-list-index-v2.tsx'), t, 'utf8');
    rec('order-list/index.tsx', true, '搜索框改为两层 View（修图2 灰块）');
  } else {
    rec('order-list/index.tsx', false, '未找到搜索框代码块');
  }
}

// ─────────────────────────────────────────────────────────────
// 图4 修复：mine 退出弹窗 —— 遮罩与弹窗拆为兄弟节点
// ─────────────────────────────────────────────────────────────
{
  const p = join(PROJ, 'src', 'pages', 'mine', 'index.tsx');
  let t = readFileSync(p, 'utf8');

  const startMark = '{/* 退出确认弹窗 */}';
  const si = t.indexOf(startMark);

  if (si < 0) {
    rec('mine/index.tsx', false, '未找到「退出确认弹窗」注释');
  } else {
    // 用括号配对精确定位 {showLogout && ( ... )} 的结束
    const openMark = '{showLogout && (';
    const oi = t.indexOf(openMark, si);
    let endAbs = -1;
    if (oi >= 0) {
      let d = 0;
      for (let j = oi + openMark.length - 1; j < t.length; j++) {
        const c = t[j];
        if (c === '(') d++;
        else if (c === ')') {
          d--;
          if (d === 0 && t[j + 1] === '}') { endAbs = j + 2; break; }
        }
      }
    }

    if (endAbs < 0) {
      rec('mine/index.tsx', false, '括号配对未能定位弹窗块');
    } else {
      const oldBlock = t.slice(si, endAbs);

      // 逐行构造新块，View 配平（4 开 1 自闭合 → 需 3 个 </View>）：
      //   <View 遮罩 ... />        自闭合（不占配平）
      //   <View 弹窗 ...>          ① 开
      //     <View 手柄 ... />      自闭合
      //     <View space-y-3>       ② 开
      //       <Button>…</Button>
      //     </View>                ① 关
      //   </View>                  ② 关
      // ★ 上一版只写了 2 个 </View>，少 1 个（4 开需要 3 关），
      //   配平守卫因此中止写入 —— 守卫起作用了。
      const NB = [
        '{/* 退出确认弹窗',
        '    ★ 修复：原先遮罩容器用 `bg-black opacity-50`，而它同时是弹窗的**父元素**。',
        '      Tailwind 的 opacity 作用于整个子树，导致弹窗本体也被一起淡化（真机截图可见弹窗发灰）。',
        '      修法：把遮罩与弹窗拆成**兄弟节点** —— 遮罩用 `bg-black/50`（背景透明度），',
        '      弹窗作为独立节点，不再继承遮罩的透明效果。 */}',
        '      {showLogout && (',
        '        <>',
        '          {/* 遮罩：独立节点，仅自身半透明 */}',
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
        '            </View>',   // 关：space-y-3 容器
        '          </View>',     // 关：弹窗根容器
        '        </>',
        '      )}',
      ].join('\n');

      // ★ 自动补齐缺失的 </View>：由字符扫描器算出净值，缺几个就补几个。
      //   与其反复手数标签，不如让程序保证配平（少一个就补，多一个就报错）。
      const nbRaw = NB;
      const nbNet = viewNet(nbRaw);
      let nbFixed = nbRaw;
      if (nbNet > 0) {
        // 缺 nbNet 个闭合：插在 </> 之前
        const pads = Array.from({ length: nbNet }, () => '        </View>').join('\n');
        nbFixed = nbRaw.replace(/\n(\s*)<\/>/, `\n${pads}\n$1</>`);
        console.log(`[info] 自动补齐 ${nbNet} 个 </View> 以配平新块`);
      }
      const netOld = viewNet(oldBlock);
      const netNew = viewNet(nbFixed);
      // 逐行打印标签序列，便于核准配平
      {
        let opens = 0, closes = 0, selfc = 0, p = 0;
        const seq = [];
        while (p < NB.length) {
          if (NB.startsWith('</View>', p)) { closes++; seq.push('CLOSE'); p += 7; continue; }
          if (NB.startsWith('<View', p) && /[\s>]/.test(NB[p + 5] || '')) {
            let j = p + 5, q = null;
            for (; j < NB.length; j++) {
              const c = NB[j];
              if (q) { if (c === q) q = null; continue; }
              if (c === '"' || c === "'") { q = c; continue; }
              if (c === '>') break;
            }
            const tag = NB.slice(p, j + 1);
            if (/\/\s*>$/.test(tag)) { selfc++; seq.push('SELF'); } else { opens++; seq.push('OPEN'); }
            p = j + 1; continue;
          }
          p++;
        }
        console.log(`[debug] NB 标签序列: ${seq.join(' ')}`);
        console.log(`[debug] NB 开=${opens} 自闭=${selfc} 关=${closes} net=${opens - closes}`);
      }
      console.log(
        `[debug] 新块 <View=${count(NB, /<View\b/g)} ` +
        `自闭合=${count(NB, /<View\b[^>]*\/>/g)} ` +
        `</View>=${count(NB, /<\/View>/g)} net=${netNew}`,
      );
      // 逐行打印，定位到底哪一行的计数不符合预期
      NB.split('\n').forEach((l, i) => {
        const o = count(l, /<View\b/g);
        const s = count(l, /<View\b[^>]*\/>/g);
        const c = count(l, /<\/View>/g);
        if (o || c) {
          console.log(`[debug] NB:${String(i + 1).padStart(3)} [${o}/${s}/${c}] ${l.trim().slice(0, 62)}`);
        }
      });

      if (netOld !== 0) {
        rec('mine/index.tsx', false, `原块本身 View 不配平（净差 ${netOld}），放弃替换`);
      } else if (netNew !== 0) {
        rec('mine/index.tsx', false, `新块 View 不配平（净差 ${netNew}），已中止以免产出坏文件`);
      } else {
        t = t.slice(0, si) + nbFixed + t.slice(endAbs);
        const finalNet = viewNet(t);
        if (finalNet !== 0) {
          rec('mine/index.tsx', false, `整文件 View 不配平（净差 ${finalNet}）`);
        } else {
          writeFileSync(join(OUT, 'mine-index-v2.tsx'), t, 'utf8');
          rec('mine/index.tsx', true,
            `弹窗拆为遮罩+弹窗兄弟节点（替换 ${oldBlock.length} 字符，View 配平校验通过）`);
        }
      }
    }
  }
}

console.log('='.repeat(76));
console.log('截图问题修复补丁生成结果');
console.log('='.repeat(76));
for (const r of results) {
  console.log(`${r.ok ? '[OK]  ' : '[FAIL]'} ${r.n}`);
  console.log(`        ${r.why}`);
}
console.log('\n输出: ' + OUT);
