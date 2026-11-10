#!/usr/bin/env node
/**
 * 检查「用了但没 import」的跨包类引用
 *
 * 之前的检查脚本只验证了「已写的 import 能否解析」，
 * 漏掉了「代码里用了某个类，但根本没写 import」这种情况 ——
 * 这正是 OrderController 漏 import EvaluateService 的原因。
 *
 * 用法: node check-missing-imports.mjs <src目录>
 */

import fs from 'node:fs'
import path from 'node:path'

const srcRoot = process.argv[2]
if (!srcRoot || !fs.existsSync(srcRoot)) {
  console.error('用法: node check-missing-imports.mjs <src/main/java 目录>')
  process.exit(1)
}

/** 递归收集所有 .java 文件 */
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (e.name.endsWith('.java')) out.push(p)
  }
  return out
}

const files = walk(srcRoot)

/** 收集项目内每个类的全限定名 */
const classIndex = new Map() // 简单类名 -> [{fqn, pkg, file}]
for (const f of files) {
  const text = fs.readFileSync(f, 'utf8')
  const pkgM = text.match(/^\s*package\s+([\w.]+)\s*;/m)
  const pkg = pkgM ? pkgM[1] : ''
  const clsM = text.match(/^\s*(?:public\s+)?(?:final\s+|abstract\s+)?(?:class|interface|enum|record)\s+(\w+)/m)
  if (!clsM) continue
  const cls = clsM[1]
  if (!classIndex.has(cls)) classIndex.set(cls, [])
  classIndex.get(cls).push({ fqn: pkg ? `${pkg}.${cls}` : cls, pkg, file: f })
}

/** JDK / 框架常用类白名单（无需 import 或来自 java.lang） */
const BUILTIN = new Set([
  'String', 'Integer', 'Long', 'Double', 'Float', 'Boolean', 'Byte', 'Short', 'Character',
  'Object', 'Math', 'System', 'Exception', 'RuntimeException', 'Throwable', 'Error',
  'Override', 'Deprecated', 'SuppressWarnings', 'FunctionalInterface', 'SafeVarargs',
  'StringBuilder', 'StringBuffer', 'Number', 'Comparable', 'Iterable', 'Runnable',
  'Thread', 'Class', 'Enum', 'Record', 'Void', 'Process', 'ProcessBuilder',
  'IllegalArgumentException', 'IllegalStateException', 'NullPointerException',
  'UnsupportedOperationException', 'NumberFormatException', 'InterruptedException',
  'ArithmeticException', 'ClassCastException', 'IndexOutOfBoundsException'
])

const problems = []

for (const f of files) {
  const text = fs.readFileSync(f, 'utf8')
  const pkgM = text.match(/^\s*package\s+([\w.]+)\s*;/m)
  const pkg = pkgM ? pkgM[1] : ''

  // 收集已 import 的简单类名
  const imported = new Set()
  for (const m of text.matchAll(/^\s*import\s+(?:static\s+)?([\w.]+)\s*;/gm)) {
    const fqn = m[1]
    imported.add(fqn.split('.').pop())
  }

  // 收集同包内的类（无需 import）
  const samePkg = new Set()
  for (const [cls, defs] of classIndex) {
    if (defs.some((d) => d.pkg === pkg)) samePkg.add(cls)
  }

  // 去掉字符串和注释，避免误报
  const code = text
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ')
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/'(?:\\.|[^'\\])*'/g, "''")

  // 本文件自己定义的类名
  const selfCls = new Set()
  for (const m of code.matchAll(/\b(?:class|interface|enum|record)\s+(\w+)/g)) {
    selfCls.add(m[1])
  }

  // 找出代码里出现的「项目内类名」
  const usedButNotImported = new Set()
  for (const [cls, defs] of classIndex) {
    if (cls === 'package') continue
    if (selfCls.has(cls)) continue
    if (imported.has(cls)) continue
    if (samePkg.has(cls)) continue
    if (BUILTIN.has(cls)) continue

    // 作为独立标识符出现（前面不是 . 或字母）
    const re = new RegExp(`(?<![.\\w])${cls}(?![\\w])`)
    if (re.test(code)) {
      usedButNotImported.add(cls)
    }
  }

  if (usedButNotImported.size > 0) {
    problems.push({
      file: path.relative(srcRoot, f),
      pkg,
      classes: [...usedButNotImported].map((c) => ({
        cls: c,
        fqn: classIndex.get(c)[0].fqn
      }))
    })
  }
}

// ============ 输出 ============
console.log('══════ 缺失 import 检查 ══════')
console.log(`扫描 ${files.length} 个 Java 文件，索引 ${classIndex.size} 个类\n`)

if (problems.length === 0) {
  console.log('✅ 没有发现「用了但没 import」的跨包引用')
  process.exit(0)
}

console.log(`❌ 发现 ${problems.length} 个文件存在缺失 import：\n`)
for (const p of problems) {
  console.log(`  ${p.file}   (package ${p.pkg})`)
  for (const c of p.classes) {
    console.log(`      ❌ 缺少: import ${c.fqn};`)
  }
  console.log('')
}

process.exit(1)
