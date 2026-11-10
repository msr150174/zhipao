#!/usr/bin/env node
/**
 * 向 IDEA 的 jdk.table.xml 注册一个新 JDK（默认：IDEA 自带的 JBR / Java 21）
 *
 * 为什么需要这个：
 *   项目用 Lombok 生成 getter/setter，Lombok 依赖 javac 内部结构。
 *   Spring Boot 3.2.5 默认的 Lombok 1.18.32 只支持到 JDK 21，
 *   用 JDK 25 编译会崩：TypeTag :: UNKNOWN。
 *   所以让 IDEA 改用 JBR（Java 21）来编译。
 *
 * 用法: node register-jbr.mjs <jdk.table.xml> <jbrHome> [名称]
 */

import fs from 'node:fs'
import path from 'node:path'

const [, , tablePath, jbrHome, nameArg] = process.argv
if (!tablePath || !jbrHome) {
  console.error('用法: node register-jbr.mjs <jdk.table.xml> <jbr目录> [显示名]')
  process.exit(1)
}
if (!fs.existsSync(tablePath)) {
  console.error(`找不到 jdk.table.xml: ${tablePath}`)
  process.exit(1)
}
if (!fs.existsSync(path.join(jbrHome, 'release'))) {
  console.error(`不是有效的 JDK 目录（缺 release 文件）: ${jbrHome}`)
  process.exit(1)
}

const name = nameArg || 'jbr-21'

// ---- 读取 JBR 的 release 文件，拿到模块列表和版本 ----
const release = fs.readFileSync(path.join(jbrHome, 'release'), 'utf8')
const getField = (k) => {
  const m = release.match(new RegExp(`^${k}="([^"]*)"`, 'm'))
  return m ? m[1] : ''
}
const javaVersion = getField('JAVA_VERSION')            // 21.0.6
const modules = getField('MODULES').trim().split(/\s+/).filter(Boolean)

console.log(`JBR 版本: ${javaVersion}`)
console.log(`模块数:   ${modules.length}`)

// ---- 检查是否已存在同名条目 ----
let xml = fs.readFileSync(tablePath, 'utf8')
if (xml.includes(`<name value="${name}" />`)) {
  console.log(`✅ "${name}" 已存在于 jdk.table.xml，无需重复注册`)
  process.exit(0)
}

// ---- 构造新的 <jdk> 条目 ----
// classPath / sourcePath 都用 jrt:// 协议指向模块
const jrtRoots = (mods) =>
  mods.map((m) => `          <root url="jrt://${jbrHome}!/${m}" type="simple" />`).join('\n')

const entry = `    <jdk version="2">
      <name value="${name}" />
      <type value="JavaSDK" />
      <version value="JetBrains Runtime ${javaVersion}" />
      <homePath value="${jbrHome}" />
      <roots>
        <annotationsPath>
          <root type="composite">
            <root url="jar://$APPLICATION_HOME_DIR$/plugins/java/lib/resources/jdkAnnotations.jar!/" type="simple" />
          </root>
        </annotationsPath>
        <classPath>
          <root type="composite">
${jrtRoots(modules)}
          </root>
        </classPath>
        <sourcePath>
          <root type="composite" />
        </sourcePath>
      </roots>
      <additional />
    </jdk>
`

// ---- 插入到 </component> 之前 ----
const idx = xml.lastIndexOf('  </component>')
if (idx < 0) {
  console.error('❌ 找不到 </component> 标签，文件结构异常')
  process.exit(1)
}

// 备份
fs.writeFileSync(`${tablePath}.bak`, xml, 'utf8')
console.log(`已备份: ${path.basename(tablePath)}.bak`)

xml = xml.slice(0, idx) + entry + xml.slice(idx)
fs.writeFileSync(tablePath, xml, 'utf8')

console.log(`✅ 已注册 JDK "${name}" (Java ${javaVersion})`)
console.log(`   路径: ${jbrHome}`)
