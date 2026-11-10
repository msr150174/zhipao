#!/usr/bin/env node
/**
 * 「其他对话」测试 —— 规则库覆盖不到的自由提问
 *
 * 目的：看当前（Coze 不可用时）的真实表现
 */

const BASE = 'http://localhost:3000/api'

async function post(path, body, token) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  const r = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  })
  return r.json()
}

const QUESTIONS = [
  // 闲聊
  '你好',
  '你是谁',
  '你能做什么',
  '今天天气怎么样',
  '讲个笑话',
  // 平台相关但规则库没覆盖
  '你们平台靠谱吗',
  '东西丢了怎么办',
  '能不能帮忙带饭',
  '我可以一次接几单',
  '配送范围是哪里',
  '晚上还能用吗',
  '有没有优惠券',
  '怎么改地址',
  '取件码填错了怎么办',
  '跑腿员不接电话',
  // 业务边界
  '我想投诉一个跑腿员',
  '我的快递被拆了',
  '能不能开发票',
  '支持哪些学校',
  '可以加急吗'
]

async function main() {
  const login = await post('/auth/wx-login', { code: 'chat_test', devUser: 'a' })
  const token = login.data?.token
  if (!token) {
    console.log('❌ 登录失败')
    process.exit(1)
  }

  console.log('══════════ 「其他对话」测试 ══════════')
  console.log('（规则库覆盖不到的自由提问）\n')

  const stats = { local: 0, guard: 0, fallback: 0, coze: 0, cache: 0, ollama: 0, other: 0 }

  for (const q of QUESTIONS) {
    const t0 = Date.now()
    let r
    try {
      r = await post('/ai/chat', { messages: [{ role: 'user', content: q }] }, token)
    } catch (e) {
      console.log(`❌ 「${q}」异常: ${e.message}\n`)
      continue
    }
    const ms = Date.now() - t0
    const d = r.data || {}
    const p = d.provider || 'none'
    stats[p] = (stats[p] || 0) + 1

    // 判断是否为「万能回复」
    const isCanned = (d.text || '').includes('暂时无法回答')

    console.log(`「${q}」`)
    console.log(`   provider: ${p}   ${ms}ms   ${isCanned ? '⚠️ 万能回复' : ''}`)
    console.log(`   ${(d.text || '').slice(0, 100)}`)
    console.log('')
  }

  console.log('─'.repeat(66))
  console.log('\n统计:')
  for (const [k, v] of Object.entries(stats)) {
    if (v > 0) console.log(`   ${k.padEnd(10)} ${v}`)
  }
}

main().catch(console.error)
