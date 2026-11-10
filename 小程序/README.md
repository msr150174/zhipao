# 智跑校园 · uni-app 前端

> **技术栈**：uni-app + Vue 3 + TypeScript + Pinia
> **平台**：微信小程序（主）/ H5
> **页面**：18 个 · **组件**：9 个 · **代码**：约 6,200 行

---

## 快速开始

### 1. 安装依赖

```bash
cd zhipao-uniapp
npm install
# 或 pnpm install
```

### 2. 配置后端地址

**H5 开发**：`vite.config.ts` 已配好代理到 `http://localhost:3000`，无需修改。

**微信小程序**：编辑 `src/services/request.ts`，设置 `BASE_URL`：

```ts
export const BASE_URL = 'http://localhost:3000'
```

> ⚠️ 小程序要求 https，但**开发阶段**可在微信开发者工具
> 「详情 → 本地设置 → 勾选**不校验合法域名**」绕过。

### 3. 运行

```bash
# 微信小程序（产物在 dist/dev/mp-weixin）
npm run dev:mp-weixin

# H5（浏览器预览）
npm run dev:h5
```

### 4. 微信开发者工具

**导入项目** → 选择 `dist/dev/mp-weixin` 目录 → AppID 选「测试号」

---

## 目录结构

```
src/
├── main.ts                  入口
├── App.vue                  根组件 + 全局样式
├── pages.json               页面路由 + tabBar
├── manifest.json            应用配置
│
├── pages/                   18 个页面
│   ├── index/               首页（待接单列表）
│   ├── login/               微信登录
│   ├── login-phone/         手机号登录
│   ├── publish/             ★ 发布需求（含地图）
│   ├── order-list/          我的订单
│   ├── order-detail/        ★ 订单详情（含地图）
│   ├── mine/                我的
│   ├── credit/              信用分
│   ├── credit-rule/         信用分规则
│   ├── wallet/              钱包 + 提现
│   ├── service/             AI 客服
│   ├── evaluate/            评价
│   ├── runner-apply/        跑腿员入驻
│   ├── account/             账户设置
│   ├── admin/               入驻审核（管理员）
│   ├── privacy/             隐私政策
│   ├── agreement/           用户协议
│   └── about/               关于我们
│
├── components/              9 个组件
│   ├── AppHeader.vue        统一头部（状态栏 + 胶囊避让）
│   ├── LocationMap.vue      ★ 地图（跨端降级）
│   ├── FloatingAssistant.vue ★ 客服浮窗（长按拖动）
│   ├── FabGroup.vue         浮窗统一容器
│   ├── EmptyState.vue       空状态
│   ├── OrderCardSkeleton.vue 骨架屏
│   ├── SuccessOverlay.vue   成功反馈
│   ├── FirstVisitDialog.vue 隐私同意
│   └── NavButton.vue        导航按钮
│
├── services/
│   ├── request.ts           网络封装（信封解包 + token）
│   └── api.ts               39 个接口
│
├── stores/
│   └── user.ts              会话状态（Pinia）
│
├── utils/
│   ├── order.ts             订单工具（距离/规格/截止）
│   └── haptics.ts           触觉反馈
│
├── types/
│   └── index.ts             全局类型（与后端契约对齐）
│
└── static/tabbar/           6 个 tabBar 图标
```

---

## ★ 关键实现（针对你反馈的问题）

### 1️⃣ 地图常显，且在收件地点下方

**`publish/index.vue`** 和 **`order-detail/index.vue`** 里，
地图组件放在**送达地点的正下方**：

```vue
<!-- 送达地点 -->
<view class="picker-row">...</view>
<input v-model="roomNo" />

<!-- ★★ 地图就在收件地点下方 -->
<LocationMap
  mode="pick"
  title="送达点位置"
  :center="buildingPoint"
  :markers="mapMarkers"
  height="300rpx"
  @pick="onPickBuilding"
/>
```

### 2️⃣ 坐标兜底（修复"没地图"）

**`order-detail/index.vue`** 做了两级兜底：

```ts
const stationPoint = computed(() => {
  const o = order.value
  if (o?.stationLng && o?.stationLat) return { lng: +o.stationLng, lat: +o.stationLat }
  return null   // 让地图组件回退到中心点
})
```

配合**后端的坐标回填**（`GeoService` 用 `COALESCE` 回写），
双保险确保地图能显示。

### 3️⃣ 客服浮窗不抢下拉手势

**`FloatingAssistant.vue`** 的关键设计：

```ts
// 长按 300ms 才进入拖动模式
pressTimer = setTimeout(() => {
  longPressed = true
  drag.value = { dx: 0, dy: 0, active: true }
}, 300)

// 未进入长按 → 不拦截，页面正常滚动
if (!longPressed) {
  if (Math.abs(dx) > 8 || Math.abs(dy) > 8) clearTimeout(pressTimer)
  return
}
```

**拖动时用 `transform` 跟手**（零 transition），松手才吸附两侧：

```ts
if (drag.value.active) {
  base.transform = `translate(${dx}px, ${-dy}px) scale(1.1)`
  base.transition = 'none'        // ★ 完全跟手
} else {
  base.opacity = '0.35'           // ★ 平时半透明
  base.transition = 'left .28s cubic-bezier(.34,1.56,.64,1), ...'
}
```

### 4️⃣ 浮窗统一定位

**`FabGroup.vue`** 收敛所有浮窗，统一间距常量：

```ts
const FAB_POS = {
  right: 20,
  publish: 110,      // 发布按钮
  assistant: 170     // 客服浮窗
}
```

### 5️⃣ 首页标题与尺寸统一

**`pages.json`** 里**所有页面**都用 `navigationStyle: "custom"`，
由 `AppHeader.vue` 统一渲染 —— 高度 = 状态栏 + 88rpx，
并自动避让右上角胶囊按钮，**切换页面不跳动**。

---

## 与后端的契约

| 项 | 约定 |
|---|---|
| **前缀** | `/api` |
| **信封** | `{ code, msg, data }` |
| **HTTP** | 全部 200（业务码在 body） |
| **鉴权** | `Authorization: Bearer <token>` |
| **命名** | API camelCase（数据库 snake_case） |

**接口清单**：见 `src/services/api.ts`，共 **39 个**，与后端一一对应。

---

## 功能清单

| 模块 | 状态 |
|---|---|
| 微信登录 / 手机号登录 | ✅ |
| 首页（待接单列表 + 搜索 + 分类） | ✅ |
| 发布需求（地图选点 + OCR 取件码） | ✅ |
| 我的订单（角色/状态筛选） | ✅ |
| 订单详情（地图导航 + 状态推进） | ✅ |
| 评价 | ✅ |
| 钱包 + 提现 | ✅ |
| 信用分 + 规则 | ✅ |
| 跑腿员入驻 | ✅ |
| 入驻审核（管理员） | ✅ |
| **AI 客服**（双 AI） | ✅ |
| 账户设置 / 注销 | ✅ |
| 隐私政策 / 用户协议 / 关于 | ✅ |

---

## 注意事项

### 1. tabBar 图标

已从原工程复制到 `src/static/tabbar/`（6 个 PNG）。
**必须打包进项目**，不能用 CDN（微信要求）。

### 2. 地图权限

`manifest.json` 已声明：

```json
"requiredPrivateInfos": ["getLocation", "chooseLocation", "openLocation"]
```

**首次真机运行会弹权限申请。** 若未在微信后台申请该类目，
审核时可能报 `61040`。

### 3. H5 端限制

- **地图**降级为占位卡（uni-app 的 map 在 H5 需额外地图 SDK）
- **微信登录**用占位 code（后端开发模式会派生稳定 openid）
- **震动反馈**不可用（已 try/catch 兜底）

### 4. 样式方案

**未使用 Tailwind**（uni-app 对 Tailwind 4 支持不完善），
改用 **SCSS 语义类**（`App.vue` 里定义）：

- 布局：`.row` `.col` `.center` `.flex-1`
- 卡片：`.card`
- 按钮：`.btn` `.btn-primary` `.btn-outline` `.btn-ghost`
- 文字：`.title` `.subtitle` `.muted`
- 渐变：`.grad-brand` `.grad-fresh` `.grad-warm` `.grad-cool`
- 动效：`.anim-fade-in` `.anim-pop` `.anim-shake` `.press-scale`

---

## 待办

| 项 | 说明 |
|---|---|
| **真机测试** | 需在微信开发者工具里跑一遍 |
| **tabBar 图标风格** | 当前沿用原工程的图标 |
| **图片资源** | 如有插画需求，走对象存储（不入包） |
| **微信支付** | 待后端分账方案确定后接入 |
