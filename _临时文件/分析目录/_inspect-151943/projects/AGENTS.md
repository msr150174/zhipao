# AGENTS.md

## 项目概览
智跑校园 · 运营管理后台 —— 校园跑腿业务（取快递/取外卖）的调度指挥台。
Vue 3 SPA 管理端，对接 Java 后端（契约见下方"接口契约"），沙箱内由内置 mock 后端提供演示数据。

## 技术栈（严格约束，禁止更换）
- Vue 3 Composition API + `<script setup lang="ts">` + Vite 8 (rolldown) + TypeScript
- Element Plus 2.x（UI 唯一组件库）+ @element-plus/icons-vue
- Vue Router 4 + Pinia 3 + Axios + ECharts 5 + SCSS（scoped）
- 禁止：React/Nuxt/SSR/Tailwind/Ant Design、`any` 类型、中文全角标点

## 常用命令
```bash
pnpm install          # 安装依赖（唯一包管理器 pnpm）
pnpm run dev          # 开发：concurrently 启动 mock(:3000) + vite(:DEPLOY_RUN_PORT 或 5174)
pnpm run mock         # 仅 mock 后端（localhost:3000）
pnpm run ts-check     # vue-tsc 类型检查
pnpm run build        # 产物构建（target es2019）
pnpm run start        # 生产：node server.mjs（静态托管 dist + 挂载 mock API）
```

## 目录结构
```
src/
├── api/            # 21 个接口的 typed 封装 + request.ts（信封拆解拦截器）
├── layout/         # AdminLayout.vue（墨绿侧边栏 + 顶栏）
├── router/         # 路由 + 登录守卫
├── stores/user.ts  # token（localStorage zhipao_admin_token）+ 用户信息
├── styles/         # 全局 SCSS（el-color-primary=#14a152 等 CSS 变量覆盖）
├── types/          # 全部 TS 类型（资金相关为 snake_case）
├── utils/          # constants.ts（状态字典/选项/creditColor）、format.ts（金额格式化）
└── views/          # login / dashboard / order / user / runner / finance 六个页面
mock/               # 演示后端（Express + 内存数据，实现全部 21 接口）
server.mjs          # 生产入口（dist 静态托管 + mock API + SPA 兜底）
```

## 接口契约（改动后端/接口封装时必须遵守）
- 基础路径 `/api`；dev 通过 vite proxy 转发到 `API_PROXY_TARGET || http://localhost:3000`
- 响应信封 `{ code, msg, data }`，HTTP 状态恒 200，业务成败看 body.code
- 401/403：清 token 跳 /login（request.ts 已统一处理）
- 登录必须校验 `user.isAdmin === true`，否则拒绝进入
- 资金接口（withdrawals/transactions）字段为**下划线命名**（apply_no/user_balance/created_at），其余接口 camelCase
- 危险操作（强制取消/冻结/驳回/设管理员）二次确认，需原因的操作原因必填

## 沙箱适配要点（勿删）
- **vite.config.ts 中 `fix-proxy-query` 插件 [关键]**：预览代理会把空值查询参数改写为 `?vue=`、`&lang.scss=`，
  导致 SFC `<style>` 子请求返回裸 CSS（浏览器报 `Unexpected token '.'` 白屏）。该中间件在 vite 处理前还原 URL。
- 端口必须读 `process.env.DEPLOY_RUN_PORT`（禁硬编码）；HMR 走 6000 端口 + `/hot/vite-hmr` + wss:443
- **源码禁用 ES2020+ 语法**（`?.`、`??`、`??=`、数字分隔符）：Vite 8 rolldown dev 模式不做语法降级，
  沙箱预览 webview 内核较旧。模板表达式与 script 均须手写 ES2019 兼容代码
- mock 验证码：devMode 下接口返回 devCode 并在登录页提示；真实后端不会有此字段

## 演示账号
- 管理员手机号 `13800001234`，验证码点"获取验证码"后看页面演示提示（mock 控制台同步打印）

## 验证方式
- 静态检查：`pnpm run ts-check` + `pnpm run build`
- 接口冒烟：21 个接口均可用 curl 经 vite 代理测试（登录链路：sms/send 取 devCode → sms/login 取 token → Bearer 调用）
- test_run 注意：每条命令独立 shell（文件不共享）、多命令并发（短信码竞态——需合并单条顺序执行）、
  URL 中 `&` 会被拆断（用 `curl -G --data-urlencode` 替代）
