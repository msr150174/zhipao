import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import path from 'node:path'

// 沙箱环境通过 DEPLOY_RUN_PORT 指定服务端口；本地开发默认 5174（★ 不要用 5173，已被小程序占用）
const isSandbox = !!process.env.DEPLOY_RUN_PORT
const port = Number(process.env.DEPLOY_RUN_PORT) || 5174

// 后端地址：本地对接 Java 后端 http://localhost:3000；可用 API_PROXY_TARGET 覆盖
const apiTarget = process.env.API_PROXY_TARGET || 'http://localhost:3000'

export default defineConfig({
  plugins: [
    vue(),
    // 沙箱预览代理会给空值查询参数补 '='（?vue → ?vue=、&lang.scss → &lang.scss=），
    // 导致 plugin-vue 无法识别 SFC 样式子请求而返回裸 CSS（浏览器报 Unexpected token '.'）。
    // 在 vite 处理前还原 URL；本地无代理时正则不命中，零副作用。
    {
      name: 'fix-proxy-query',
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          if (req.url && req.url.includes('/src/')) {
            req.url = req.url
              .replace(/([?&])vue=&/, '$1vue&')
              .replace(/&lang\.(scss|sass|less|css|styl|stylus)=$/, '&lang.$1')
          }
          next()
        })
      }
    }
  ],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') }
  },
  // 生产构建降级到 ES2019（rolldown 会对依赖一并转译；dev 源码已手写为 ES2019 兼容）
  build: { target: 'es2019', chunkSizeWarningLimit: 1600 },
  server: {
    port,
    host: isSandbox ? true : undefined,
    allowedHosts: isSandbox ? true : undefined,
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true
      }
    },
    // 沙箱环境热更新规范：6000 端口 + /hot/vite-hmr 路径；本地开发走 Vite 默认（同端口）
    hmr: isSandbox
      ? { port: 6000, path: '/hot/vite-hmr', clientPort: 443, protocol: 'wss' }
      : true
  }
})
