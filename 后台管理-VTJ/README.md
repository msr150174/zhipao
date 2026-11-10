# 智跑校园 · 运营管理后台（VTJ 风格版）

> 校园跑腿平台（取快递 / 取外卖）的管理端。
> 界面来自 VTJ 设计器导出，接口已对接真实 Java 后端。

---

## 一、快速开始

### 1. 先启动后端

后端必须先在跑，否则登录会失败。

```powershell
cd "D:\智跑校园\后端\zhipao-server"
.\start.bat
```

**验证**：浏览器打开 <http://localhost:3000/api/health>，应看到：

```json
{ "code": 200, "data": { "status": "UP", "mysql": { "connected": true } } }
```

### 2. 启动前端

```powershell
cd "D:\智跑校园\后台管理-VTJ"
npm install          # 首次运行
npm run dev
```

**访问**：<http://localhost:5174>

### 3. 登录

| 项 | 值 |
|---|---|
| 手机号 | `13800001234` |
| 验证码 | **看后端控制台日志** |

开发模式下短信不会真实发送，验证码会打印在后端窗口：

```
【开发模式】手机号 13800001234 的验证码为 268549（5 分钟内有效）
```

> ⚠️ 验证码有 **60 秒频率限制**，点太频繁会提示「请 XX 秒后再试」。

---

## 二、可用命令

| 命令 | 说明 |
|---|---|
| `npm run dev` | 启动开发服务器（端口 5174） |
| `npm run build` | 生产构建，产物在 `dist/` |
| `npm run preview` | 预览构建产物 |
| `npm run ts-check` | TypeScript 类型检查 |

---

## 三、目录结构

```
后台管理-VTJ/
├── src/
│   ├── api/
│   │   └── request.ts           ★ Axios 封装（拆信封 + 401 跳转）
│   ├── components/
│   │   ├── AppHeader.vue        顶栏
│   │   ├── AppSidebar.vue       侧边栏
│   │   ├── StatCard.vue         数据卡片
│   │   └── TrendChart.vue       ECharts 折线图
│   ├── layout/
│   │   └── AdminLayout.vue      主布局（侧边栏 + 顶栏 + 内容区）
│   ├── router/
│   │   └── index.ts             路由 + 登录守卫
│   ├── styles/
│   │   ├── index.scss           全局样式入口
│   │   └── variables.scss       ★ CSS 变量（品牌色、间距、圆角）
│   ├── views/
│   │   ├── login/index.vue      登录
│   │   ├── dashboard/index.vue  数据看板
│   │   ├── order/index.vue      订单管理
│   │   ├── user/index.vue       用户管理
│   │   ├── runner/index.vue     跑腿员审核
│   │   └── finance/index.vue    财务中心
│   ├── vtj-compat.ts            ★ VTJ 兼容层（见下文）
│   ├── App.vue
│   └── main.ts
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## 四、★ VTJ 兼容层说明

### 为什么需要它

页面代码来自 **VTJ 设计器导出**，原本依赖 `@vtj/renderer` 运行时：

```ts
import { useProvider, useStore } from '@vtj/renderer'
const __provider = useProvider({ id: '13ptnvaho', version: '...' })
const res = await __provider.apis['getDashboardStats']()
```

`@vtj/renderer` 只在 VTJ 平台内可用，脱离平台就报错。

### 解决方式

`src/vtj-compat.ts` **用真实 HTTP 替换了 VTJ 运行时**，保持完全相同的调用签名：

```ts
import { useProvider, useStore } from '@/vtj-compat'   // 只改这一行
const __provider = useProvider({ id: '...', version: '...' })
const res = await __provider.apis['getDashboardStats']()   // 页面代码不用动
```

### 接口映射

| 页面里的名字 | 实际后端接口 |
|---|---|
| `login` | `POST /api/auth/sms/login` |
| `sendSmsCode` | `POST /api/auth/sms/send` |
| `getDashboardStats` | `GET /api/admin/dashboard` |
| `getDashboardTrend` | `GET /api/admin/dashboard` |
| `getOrderList` | `GET /api/admin/orders` |
| `getOrderDetail` | `GET /api/admin/orders/{id}` |
| `cancelOrder` | `POST /api/admin/orders/{id}/cancel` |
| `completeOrder` | `POST /api/admin/orders/{id}/complete` |
| `getUserList` | `GET /api/admin/users` |
| `getUserDetail` | `GET /api/admin/users/{id}` |
| `adjustCredit` | `POST /api/admin/users/{id}/credit` |
| `freezeUser` | `POST /api/admin/users/{id}/freeze` |
| `unfreezeUser` | `POST /api/admin/users/{id}/unfreeze` |
| `setAdmin` | `POST /api/admin/users/{id}/admin` |
| `getRunnerApplications` | `GET /api/admin/runner-applications` |
| `approveRunner` | `POST /api/admin/runner-applications/{id}/approve` |
| `rejectRunner` | `POST /api/admin/runner-applications/{id}/reject` |
| `getFinanceRecords` | `GET /api/admin/transactions` |
| `getWithdrawals` | `GET /api/admin/withdrawals` |
| `reviewWithdrawal` | `POST /api/admin/withdrawals/{id}/review` |

### 字段映射

后端用 `camelCase`，页面模板用的是 `snake_case`（VTJ 导出时定的）。
兼容层负责转换，例如：

| 后端字段 | 页面字段 |
|---|---|
| `orderNo` | `order_no` |
| `reward` | `amount` |
| `publisherName` | `user_name` |
| `buildingName + roomNo` | `address` |

> ⚠️ **资金接口例外**：`/admin/transactions` 和 `/admin/withdrawals`
> 后端返回的就是**下划线字段**（`order_no`、`created_at`、`apply_no`），
> 兼容层原样透出。

---

## 五、接口契约（重要）

### 响应信封

所有接口统一返回：

```json
{ "code": 200, "msg": "ok", "data": {} }
```

**关键规则**：

| # | 规则 |
|---|---|
| 1 | **HTTP 状态码永远是 200**，业务成败看 `body.code` |
| 2 | `code === 200` 成功，其他为错误，`msg` 是中文提示 |
| 3 | **401 / 403 都要清 token 跳登录** |
| 4 | 登录后必须校验 `user.isAdmin` |
| 5 | 资金接口字段是**下划线命名** |

这些都在 `src/api/request.ts` 和 `src/vtj-compat.ts` 里统一处理了。

### 错误码

| code | 含义 | 前端行为 |
|---|---|---|
| 200 | 成功 | 正常处理 |
| 400 | 参数错误 | Toast 提示 `msg` |
| 401 | 未登录 | 清 token → 跳登录 |
| 403 | 无权限 | 清 token → 跳登录 |
| 404 | 不存在 | Toast 提示 |
| 500 | 服务端错误 | Toast 提示 |

---

## 六、页面功能

| 页面 | 路由 | 功能 |
|---|---|---|
| 登录 | `/login` | 手机号 + 验证码，校验管理员 |
| 数据看板 | `/dashboard` | 6 个指标卡 + 7 日趋势图 |
| 订单管理 | `/orders` | 列表筛选、分页、详情抽屉 |
| 用户管理 | `/users` | 列表、信用分调整、禁用/启用 |
| 跑腿员审核 | `/runner-applications` | Tab 分类、通过/拒绝 |
| 财务中心 | `/finance` | 收支概览、流水明细 |

---

## 七、常见问题

### Q1：登录报「网络异常」

**后端没启动。** 检查 <http://localhost:3000/api/health>。

### Q2：登录报「无管理权限」

该手机号对应的用户 `is_admin = 0`。执行：

```sql
UPDATE users SET is_admin = 1 WHERE phone = '13800001234';
```

> 注意：手机号首次登录会**自动创建用户**，新用户默认不是管理员。

### Q3：验证码收不到

开发模式不发短信，**看后端控制台**。或者点登录页的「收不到验证码？」查看说明。

### Q4：端口冲突

- 前端：`5174`（在 `vite.config.ts` 里改）
- 后端：`3000`

**5173 被占用**（uni-app H5 用过），所以前端用 5174。

### Q5：类型检查报错

```powershell
npm run ts-check
```

当前代码 **0 错误**。如果报错，通常是编辑器用了不同的 TS 版本。

---

## 八、技术栈

| 类别 | 技术 | 版本 |
|---|---|---|
| 框架 | Vue | 3.5 |
| 语言 | TypeScript | 6.0 |
| 构建 | Vite | 8.3 |
| UI | Element Plus | 2.14 |
| 路由 | Vue Router | 4.6 |
| 状态 | Pinia | 3.0 |
| HTTP | Axios | 1.20 |
| 图表 | ECharts | 5.6 |
| 样式 | SCSS | 1.105 |

---

## 九、与另一个版本的区别

项目里有两套后台：

| 项目 | 界面来源 | 说明 |
|---|---|---|
| `后台管理` | Coze 生成 | 标准 Vue 项目结构，直接调接口 |
| **`后台管理-VTJ`** | **VTJ 设计器导出** | 保留 VTJ 风格，通过兼容层对接后端 |

**功能完全一样，界面风格不同。** 按需选用。

---

## 十、后端接口清单（21 个）

```
POST   /api/auth/sms/send
POST   /api/auth/sms/login
GET    /api/auth/me
POST   /api/auth/logout

GET    /api/admin/dashboard

GET    /api/admin/orders
GET    /api/admin/orders/{id}
POST   /api/admin/orders/{id}/cancel
POST   /api/admin/orders/{id}/complete

GET    /api/admin/users
GET    /api/admin/users/{id}
POST   /api/admin/users/{id}/credit
POST   /api/admin/users/{id}/freeze
POST   /api/admin/users/{id}/unfreeze
POST   /api/admin/users/{id}/admin

GET    /api/admin/runner-applications
POST   /api/admin/runner-applications/{id}/approve
POST   /api/admin/runner-applications/{id}/reject

GET    /api/admin/transactions
GET    /api/admin/withdrawals
POST   /api/admin/withdrawals/{id}/review
```
