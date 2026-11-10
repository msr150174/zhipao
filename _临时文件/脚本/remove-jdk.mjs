#!/usr/bin/env node
/**
 * 从 IDEA 的 jdk.table.xml 中移除指定的 JDK 条目
 *
 * 用途：清理掉之前错误注册的 "jbr-21"（IDEA 自带运行时，
 * 不能当项目 SDK，会导致 IDEA 报 "JDK 'jbr-21' 缺失"）。
 *
 * 用法: node remove-jdk.mjs <jdk.table.xml> <要删除的名字>
 */

import fs from 'node:fs'

const [, , tablePath, name] = process.argv
if (!tablePath || !name) {
  console.error('用法: node remove-jdk.mjs <jdk.table.xml> <名称>')
  process.exit(1)
}
if (!fs.existsSync(tablePath)) {
  console.error(`找不到文件: ${tablePath}`)
  process.exit(1)
}

let xml = fs.readFileSync(tablePath, 'utf8')

const marker = `<name value="${name}" />`
if (!xml.includes(marker)) {
  console.log(`ℹ️ "${name}" 不存在，无需删除`)
  process.exit(0)
}

// 备份
fs.writeFileSync(`${tablePath}.bak2`, xml, 'utf8')
console.log(`已备份: ${tablePath.split(/[\\/]/).pop()}.bak2`)

// 定位该 <jdk ...> ... </jdk> 块并整块删除
const nameIdx = xml.indexOf(marker)
if (nameIdx < 0) {
  console.error('❌ 定位失败')
  process.exit(1)
}
const startIdx = xml.lastIndexOf('<jdk ', nameIdx)
if (startIdx < 0) {
  console.error('❌ 找不到对应的 <jdk> 起始标签')
  process.exit(1)
}
const endIdx = xml.indexOf('</jdk>', nameIdx)
if (endIdx < 0) {
  console.error('❌ 找不到 </jdk> 结束标签')
  process.exit(1)
}

const blockEnd = endIdx + '</jdk>'.length
// 连带后面的换行一起删掉
let removeEnd = blockEnd
while (removeEnd < xml.length && (xml[removeEnd] === '\n' || xml[removeEnd] === '\r')) {
  removeEnd++
}

const removed = xml.slice(startIdx, removeEnd)
xml = xml.slice(0, startIdx) + xml.slice(removeEnd)

fs.writeFileSync(tablePath, xml, 'utf8')

console.log(`✅ 已移除 JDK "${name}"（${removed.length} 字符）`)

// 列出剩余 JDK
const remaining = [...xml.matchAll(/<name value="([^"]+)" \/>/g)].map((m) => m[1])
console.log(`剩余 JDK: ${remaining.join(', ') || '(无)'}`)
