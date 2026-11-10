// ============================================================
// 生产模式服务：静态托管 dist + 挂载演示后端 /api
// 端口从 DEPLOY_RUN_PORT 读取（沙箱注入），禁止硬编码
// ============================================================

import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createMockApp } from './mock/app.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const port = Number(process.env.DEPLOY_RUN_PORT) || 5000

const app = express()

// /api 演示后端（与沙箱开发环境一致；真实部署时可替换为反向代理到 Java 后端）
app.use(createMockApp())

// 静态资源 + SPA 兜底
const dist = path.join(__dirname, 'dist')
app.use(express.static(dist))
app.get('*', (_req, res) => {
  res.sendFile(path.join(dist, 'index.html'))
})

app.listen(port, () => {
  console.log(`[zhipao-admin] production server listening on port ${port}`)
})
