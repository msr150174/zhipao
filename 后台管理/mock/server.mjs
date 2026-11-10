// ============================================================
// 沙箱演示后端独立进程：监听 3000 端口，供 Vite proxy 转发
// 本地开发时若真实 Java 后端已占用 3000，本进程自动退出（不干扰）
// ============================================================

import { createMockApp } from './app.mjs'

const port = Number(process.env.MOCK_PORT) || 3000
const app = createMockApp()

const server = app.listen(port, () => {
  console.log(`[mock-api] 智跑校园演示后端已启动: http://localhost:${port}/api (health: /api/health)`)
})

server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    console.log(`[mock-api] 端口 ${port} 已被占用，假定真实后端已启动，跳过 mock`)
    process.exit(0)
  }
  throw err
})
