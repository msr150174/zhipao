# 智跑校园 · 运营管理后台

校园跑腿业务（取快递/取外卖）的运营管理后台：管订单、管骑手、管钱。
对接契约见 `AGENTS.md`，设计规范见 `DESIGN.md`。

## 技术栈
Vue 3（`<script setup>` + TypeScript）+ Vite 8 (rolldown) + Element Plus 2 + Vue Router 4 + Pinia 3 + Axios + ECharts 5 + SCSS。

## 快速开始
```bash
pnpm install     # 安装依赖
pnpm run dev     # 开发（mock :3000 + vite :DEPLOY_RUN_PORT/5174，HMR）
pnpm run mock    # 仅启动契约式 mock 后端
pnpm run ts-check
pnpm run build
pnpm run start   # 生产：node server.mjs（托管 dist + 挂载 mock API + SPA 兜底）
```

## 对接说明
- 本地对接真实 Java 后端：后端跑在 `http://localhost:3000`，dev proxy 自动转发（可用 `API_PROXY_TARGET` 覆盖）。
- 沙箱预览（无真实后端）时，由 `mock/` 内置契约级演示后端支撑全部 21 个接口。
- 演示管理员：手机号 `13800001234`，验证码见"获取验证码"后的页面演示提示。