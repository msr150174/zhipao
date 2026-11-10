#!/usr/bin/env node
/**
 * Coze Bot API 连通性测试
 *
 * 验证：
 *   1. Token 是否有效
 *   2. Bot ID 是否正确
 *   3. Bot 能否正常回答
 *
 * 用法: node test-coze.mjs <api_token> <bot_id>
 */

const [, , token, botId] = process.argv
if (!token || !botId) {
  console.error('用法: node test-coze.mjs <token> <bot_id>')
  process.exit(1)
}

const BASE = 'https://api.coze.cn'
const headers = {
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json'
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function main() {
  console.log('══════ Coze Bot API 测试 ══════\n')
  console.log(`  Token:  ${token.slice(0, 12)}...${token.slice(-6)}`)
  console.log(`  Bot ID: ${botId}\n`)

  // ---------- 1. 发起对话 ----------
  console.log('① 发起对话 (POST /v3/chat)')
  const question = '我是智跑校园的用户，信用分怎么算？'

  const resp = await fetch(`${BASE}/v3/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      bot_id: botId,
      user_id: 'zhipao_test_user',
      stream: false,
      auto_save_history: true,
      additional_messages: [
        { role: 'user', content: question, content_type: 'text' }
      ]
    })
  })

  const bodyText = await resp.text()
  console.log(`  HTTP ${resp.status}`)

  let body
  try {
    body = JSON.parse(bodyText)
  } catch {
    console.log(`  ❌ 返回非 JSON:\n${bodyText.slice(0, 500)}`)
    process.exit(1)
  }

  if (body.code !== 0) {
    console.log(`  ❌ API 返回错误`)
    console.log(`     code: ${body.code}`)
    console.log(`     msg:  ${body.msg}`)
    if (body.code === 4100) console.log('     → Token 无效或已过期')
    if (body.code === 4000) console.log('     → 请求参数错误（检查 Bot ID）')
    if (body.code === 4002) console.log('     → 未授权')
    if (body.code === 4101) console.log('     → Bot 不存在或无权访问')
    process.exit(1)
  }

  const data = body.data || {}
  const chatId = data.id
  const conversationId = data.conversation_id
  const status = data.status

  console.log(`  ✅ 已受理`)
  console.log(`     chat_id:         ${chatId}`)
  console.log(`     conversation_id: ${conversationId}`)
  console.log(`     status:          ${status}`)

  if (!chatId || !conversationId) {
    console.log('  ⚠️ 缺少 chat_id / conversation_id')
    process.exit(1)
  }

  // 如果首次响应就带答案
  const direct = pickAnswer(data.messages)
  if (direct) {
    console.log(`\n  ✅ 回答（直接返回）:\n     ${direct}`)
    return
  }

  // ---------- 2. 轮询取结果 ----------
  console.log('\n② 轮询取回答 (GET /v3/chat/message/list)')

  for (let i = 1; i <= 15; i++) {
    await sleep(1500)

    const listResp = await fetch(
      `${BASE}/v3/chat/message/list?conversation_id=${conversationId}&chat_id=${chatId}`,
      { headers }
    )
    const listBody = await listResp.json()

    if (listBody.code !== 0) {
      console.log(`  第 ${i} 次: API 错误 code=${listBody.code} msg=${listBody.msg}`)
      continue
    }

    const msgs = listBody.data || []
    const answer = pickAnswer(msgs)

    if (answer) {
      console.log(`  ✅ 第 ${i} 次轮询拿到回答\n`)
      console.log('══════ 回答内容 ══════')
      console.log(answer)
      console.log('══════════════════════')
      return
    }

    // 看对话是否已完成但没 answer
    const finished = msgs.find((m) => m.type === 'verbose' || m.type === 'function_call')
    console.log(`  第 ${i} 次: 等待中... (消息数 ${msgs.length})`)
  }

  console.log('\n  ⚠️ 超时未取到回答（Bot 可能响应很慢）')
}

/** 从消息列表里挑 type=answer 的内容 */
function pickAnswer(messages) {
  if (!Array.isArray(messages)) return null
  for (const m of messages) {
    if (m && m.type === 'answer' && typeof m.content === 'string' && m.content.trim()) {
      return m.content.trim()
    }
  }
  return null
}

main().catch((e) => {
  console.error('\n❌ 异常:', e.message)
  if (e.cause) console.error('   cause:', e.cause.message || e.cause)
  process.exit(1)
})
