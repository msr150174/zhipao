/**
 * Text block 检查（v3 · 正确的父容器解析）
 *
 * v1/v2 的问题：用"向上找最近含 className 的行"来定位父容器，
 * 但 JSX 的 <View 开始标签可能跨多行（如 <View\n  className="..."\n  onClick={...}\n>），
 * 于是会把更上层的容器误判为父级，导致结论完全相反。
 *
 * v3 做法：做真正的**标签深度跟踪**——
 *   逐行扫描，维护一个容器栈；遇到 <View / <Card 等压栈，
 *   遇到 </View> 或自闭合 /> 弹栈；遇到 <Text 时取栈顶作为父容器。
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, 'projects');
const PAGES = join(ROOT, 'src', 'pages');

function walk(d, out = []) {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx$/.test(e)) out.push(p);
  }
  return out;
}

const CONTAINERS = ['View', 'Card', 'CardContent', 'ScrollView', 'ScrollArea', 'Sheet', 'Dialog'];

const need = [];
const skip = [];

for (const f of walk(PAGES)) {
  const lines = readFileSync(f, 'utf8').split('\n');
  const rel = relative(ROOT, f).replace(/\\/g, '/');

  /** 栈：{ cls, line } */
  const stack = [];

  for (let i = 0; i < lines.length; i++) {
    let raw = lines[i];
    const t = raw.trim();
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) continue;

    // 收集 <Text 时，先判断栈顶
    if (/<Text[\s>]/.test(raw)) {
      if (!/\bblock\b/.test(raw) && !/\binline\b/.test(raw)) {
        const parent = stack.length ? stack[stack.length - 1] : null;
        const pc = parent ? parent.cls : '';
        const isRow = /\bflex\b/.test(pc) && !/\bflex-col\b/.test(pc) &&
                      (/items-center|\bflex-row\b/.test(pc));
        const item = {
          rel, line: i + 1,
          code: t.slice(0, 76),
          parentLine: parent ? parent.line : 0,
          parentCls: pc || '(无)',
        };
        (isRow ? skip : need).push(item);
      }
    }

    // 维护容器栈
    // 1) 自闭合容器：<View ... />
    // 2) 闭合标签：</View>
    // 3) 开始标签：<View ...> （可能多行）

    // 处理闭合
    for (const c of CONTAINERS) {
      const closeRe = new RegExp(`</${c}>`, 'g');
      const nClose = (raw.match(closeRe) || []).length;
      for (let k = 0; k < nClose; k++) if (stack.length) stack.pop();
    }

    // 处理开始标签（含跨行）：从 <View 开始，找到本行或后续行的 '>'
    for (const c of CONTAINERS) {
      const openRe = new RegExp(`<${c}(?=[\\s>])`, 'g');
      let m;
      while ((m = openRe.exec(raw)) !== null) {
        // 取从该位置到标签结束的文本
        let seg = raw.slice(m.index);
        let cursor = i;
        let guard = 0;
        while (!/>/.test(seg) && cursor + 1 < lines.length && guard++ < 25) {
          cursor++;
          seg += '\n' + lines[cursor];
        }
        const selfClose = /\/>/.test(seg.slice(0, seg.indexOf('>') + 1));
        if (selfClose) continue; // 自闭合不压栈

        // 若闭合与本标签在同一段内，也不算（避免误配）
        const cm = seg.match(/className="([^"]+)"/);
        stack.push({ cls: cm ? cm[1] : '', line: i + 1 });

        // 如果标签跨行，需要跳过这些行（避免重复处理）
        if (cursor > i) i = cursor;
        break;
      }
    }
  }
}

console.log('='.repeat(80));
console.log(`确认需要加 block（父容器为垂直布局）：${need.length} 处`);
console.log('='.repeat(80));
for (const x of need) {
  console.log(`\n  ${x.rel}:${x.line}`);
  console.log(`      父容器 L${x.parentLine}: ${x.parentCls.slice(0, 66)}`);
  console.log(`      ${x.code}`);
}

console.log('\n' + '='.repeat(80));
console.log(`横向排列（不需要 block）：${skip.length} 处`);
console.log('='.repeat(80));
for (const x of skip) {
  console.log(`  ${x.rel}:${x.line}  父L${x.parentLine}: ${x.parentCls.slice(0, 52)}`);
}
