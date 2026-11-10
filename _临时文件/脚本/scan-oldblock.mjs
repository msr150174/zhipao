import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const t = readFileSync(
  join(HERE, '_分析-智跑校园-v2', 'projects', 'src', 'pages', 'mine', 'index.tsx'),
  'utf8',
);

const si = t.indexOf('{/* 退出确认弹窗 */}');
const openMark = '{showLogout && (';
const oi = t.indexOf(openMark, si);

let d = 0;
let endAbs = -1;
for (let j = oi + openMark.length - 1; j < t.length; j++) {
  const c = t[j];
  if (c === '(') d++;
  else if (c === ')') {
    d--;
    if (d === 0 && t[j + 1] === '}') { endAbs = j + 2; break; }
  }
}

const blk = t.slice(si, endAbs);
console.log('旧块长度:', blk.length);

// 字符级扫描
let opens = 0, self = 0, closes = 0, i = 0;
const tags = [];
while (i < blk.length) {
  if (blk.startsWith('</View>', i)) {
    closes++;
    tags.push({ kind: 'close', text: '</View>' });
    i += 7;
    continue;
  }
  if (blk.startsWith('<View', i) && /[\s>]/.test(blk[i + 5] ?? '')) {
    let j = i + 5;
    let q = null;
    for (; j < blk.length; j++) {
      const c = blk[j];
      if (q) { if (c === q) q = null; continue; }
      if (c === '"' || c === "'") { q = c; continue; }
      if (c === '>') break;
    }
    const tag = blk.slice(i, j + 1);
    const isSelf = /\/\s*>$/.test(tag);
    if (isSelf) self++; else opens++;
    tags.push({ kind: isSelf ? 'self' : 'open', text: tag.replace(/\s+/g, ' ').slice(0, 58) });
    i = j + 1;
    continue;
  }
  i++;
}

console.log('\n标签序列:');
tags.forEach((x) => console.log(`  ${x.kind.padEnd(6)} ${x.text}`));
console.log(`\n<View=${opens}  自闭合=${self}  </View>=${closes}  net=${opens - self - closes}`);
