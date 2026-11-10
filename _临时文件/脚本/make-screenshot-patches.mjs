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
// 图2 修复：order-list 搜索框 —— 两层 View 结构
//   违反 AGENTS.md：「Input 必须 View 包裹，样式放外层」「flex 放 View 上」
// ─────────────────────────────────────────────────────────
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
              直接子元素 —— 这违反 AGENTS.md 的跨端规则：
                「Taro 原生 Input 样式：H5 端 inline 导致样式失效 → View 包裹，样式放外层」
                「Taro 原生 Input/Button Flex：H5 不支持 flex → View 包装，flex 放 View 上」
              后果：Input 无法正确撑开/透明化，背景色显形为一整块灰色实心块。
              修法：拆成两层 —— 外层负责布局(flex)，内层负责外观(背景/圆角/内边距)。 */}
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
    const re = /\{\/\* 搜索 \*\/\}\s*\n\s*<View className="flex items-center bg-surface-container[^>]*>[\s\S]*?<\/View>/;
    if (re.test(t)) {
      t = t.replace(re, good.trim());
      writeFileSync(join(OUT, 'order-list-index-v2.tsx'), t, 'utf8');
      rec('order-list/index.tsx', true, '宽松匹配替换成功（修图2 灰块）');
    } else {
      rec('order-list/index.tsx', false, '未找到搜索框代码块');
    }
  }
}

// ─────────────────────────────────────────────────────────
// 图4 修复：mine 退出弹窗 —— 拆分遮罩与弹窗为兄弟节点
//   opacity-50 加在同时作为弹窗父级的遮罩上 → 弹窗本体被一起淡化
// ─────────────────────────────────────────────────────────
{
  const p = join(PROJ, 'src', 'pages', 'mine', 'index.tsx');
  let t = readFileSync(p, 'utf8');

  // 精确定位：从「退出确认弹窗」注释到 {showLogout && ( ... )} 块结束
  const startMark = '{/* 退出确认弹窗 */}';
  const si = t.indexOf(startMark);
  if (si < 0) {
    rec('mine/index.tsx', false, '未找到「退出确认弹窗」注释');
  } else {
    const endMark = '\n      )}';
    const endRel = t.indexOf(endMark, si);
    if (endRel < 0) {
      rec('mine/index.tsx', false, '未能定位弹窗块结尾');
    } else {
      // ★ 关键：必须匹配「弹窗块」自己的结尾 `)}`，而不是块内嵌套的 `)}`。
      //   上一版用 indexOf('\n      )}') 会命中块内更早的同缩进 `)}`，
      //   导致把根容器的 </View> 一起删掉（View 配平 35/28+6 暴露了该问题）。
      //   现改为「{showLogout && (」起算，做括号配对精确定位结束位置。
      const openMark = '{showLogout && (';
      const oi = t.indexOf(openMark, si);
      let endAbs = -1;
      if (oi >= 0) {
        let depth2 = 0;
        for (let j = oi + openMark.length - 1; j < t.length; j++) {
          const c = t[j];
          if (c === '(') depth2++;
          else if (c === ')') {
            depth2--;
            if (depth2 === 0 && t[j + 1] === '}') { endAbs = j + 2; break; }
          }
        }
      }
      if (endAbs < 0) {
        rec('mine/index.tsx', false, '括号配对未能定位弹窗块结束位置');
      } else {
      const oldBlock = t.slice(si, endAbs);

      const newBlock = `{/* 退出确认弹窗
          ★ 修复：原先遮罩容器用 \`bg-black opacity-50\`，而它同时是弹窗的**父元素**。
            Tailwind 的 opacity 作用于整个子树，导致弹窗本体也被一起淡化（真机截图可见弹窗发灰）。
            修法：把遮罩与弹窗拆成**兄弟节点** —— 遮罩用 \`bg-black/50\`（背景透明度），
            弹窗作为独立节点，不再继承遮罩的透明效果。 */}
      {showLogout && (
        <>
          {/* 遮罩：独立节点，仅自身半透明 */}
          <View
            className="fixed inset-0 z-50 bg-black/50"
            style={{ position: 'fixed' }}
            onClick={() => setShowLogout(false)}
          />
          {/* 弹窗：独立节点，不继承遮罩透明度 */}
          <View
            className="fixed inset-x-0 bottom-0 z-50 bg-surface rounded-t-2xl w-full p-6 pb-8"
            style={{ position: 'fixed' }}
          >
            <View className="w-10 h-1 rounded-full bg-surface-container mx-auto mb-4" />
            <Text className="block text-lg font-semibold text-on-surface text-center">
              退出登录
            </Text>
            <Text className="block text-sm text-on-surface-variant mt-2 text-center">
              确定要退出当前账号吗？退出后需要重新登录。
            </Text>
            <View className="mt-6 space-y-3">
              <Button className="w-full bg-primary rounded-xl py-3" onClick={onLogout}>
                确认退出
              </Button>
              <Button
                variant="secondary"
                className="w-full rounded-xl py-3"
                onClick={() => setShowLogout(false)}
              >
                取消
              </Button>
            </View>
          </View>
        </>
      )}`;
          // View 配平核对：本块含 4 个 <View（遮罩1 + 弹窗根1 + 手柄1(自闭合) + space-y-3 容器1）
          // 其中 1 个自闭合，故需 3 个 </View>：
          //   ① 闭合 space-y-3 容器
          //   ② 闭合弹窗根容器
          //   ③ 遮罩是自闭合，无需闭合 —— 但上面弹窗根容器关闭后还剩一个「弹窗包裹层」
          // 为确保配平，这里显式校验：
          {
            const cnt = (s, re) => (s.match(re) || []).length;
            const net = cnt(newBlock, /<View\b/g) - cnt(newBlock, /<View\b[^>]*\/>/g) - cnt(newBlock, /<\/View>/g);
            if (net !== 0) {
              rec('mine/index.tsx', false, `生成的块 View 不配平（净差 ${net}），已中止以免产出坏文件`);
              t = null;
            }
          }
          if (t !== null) {
      t = t.slice(0, si) + newBlock + t.slice(endAbs);
      writeFileSync(join(OUT, 'mine-index-v2.tsx'), t, 'utf8');
      rec('mine/index.tsx', true, `退出弹窗拆分为遮罩+弹窗兄弟节点（替换 ${oldBlock.length} 字符，括号配对定位）`);
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
