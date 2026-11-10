/**
 * VTJ 兼容层
 * ----------------------------------------------------------------------------
 * 原代码来自 VTJ 设计器导出，依赖 `@vtj/renderer` 的 useProvider / useStore。
 * 这个模块用**真实后端**替换掉 VTJ 运行时，让代码可以直接在 Vite 里跑。
 *
 * 设计原则：
 *   1. 保持与 VTJ 完全相同的调用签名，页面代码一行不用改
 *   2. 接口名（getDashboardStats 等）映射到我们 Java 后端的真实路径
 *   3. 返回值形状对齐页面期望（例如 dashboard 要 totalOrders/todayOrders）
 */
import { reactive, readonly } from 'vue'
import request from '@/api/request'

// ============================================================================
// Store：替代 VTJ 的 useStore()
// ============================================================================
interface UserInfo {
  id?: string
  name?: string
  nickname?: string
  role?: string
  phone?: string
  isAdmin?: boolean
}

interface StoreState {
  token: string
  userInfo: UserInfo | null
  role: string
  isAdmin: boolean
}

export const TOKEN_KEY = 'zhipao_admin_token'
export const USER_KEY = 'zhipao_admin_user'

const state = reactive<StoreState>({
  token: localStorage.getItem(TOKEN_KEY) || '',
  userInfo: JSON.parse(localStorage.getItem(USER_KEY) || 'null'),
  role: 'admin',
  isAdmin: true
})

/** 替代 VTJ 的 useStore() */
export function useStore() {
  return {
    get token() {
      return state.token
    },
    get userInfo() {
      return state.userInfo
    },
    get role() {
      return state.role
    },
    get isAdmin() {
      return state.isAdmin
    },

    setUser(payload: { token?: string; userInfo?: UserInfo; role?: string; isAdmin?: boolean }) {
      if (payload.token) {
        state.token = payload.token
        localStorage.setItem(TOKEN_KEY, payload.token)
      }
      if (payload.userInfo) {
        state.userInfo = payload.userInfo
        localStorage.setItem(USER_KEY, JSON.stringify(payload.userInfo))
      }
      if (payload.role) state.role = payload.role
      if (payload.isAdmin !== undefined) state.isAdmin = payload.isAdmin
    },

    logout() {
      state.token = ''
      state.userInfo = null
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
    }
  }
}

// ============================================================================
// 接口适配：VTJ 的 apis['name'] -> 后端真实接口
// ============================================================================

/** 后端统一信封 { code, msg, data }，request.ts 已拆过一层 */
type ApiFn = (payload?: unknown, opts?: { params?: Record<string, unknown> }) => Promise<unknown>

/** 把页面传来的各种参数形态归一为 query 对象 */
function toQuery(payload?: unknown, opts?: { params?: Record<string, unknown> }): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  const merge = (src: unknown) => {
    if (!src || typeof src !== 'object') return
    Object.entries(src as Record<string, unknown>).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') out[k] = v
    })
  }
  merge(opts?.params)
  merge(payload)
  return out
}

/** 归一化分页参数：VTJ 用 size，后端用 pageSize */
function normalizePaging(q: Record<string, unknown>) {
  if (q.size !== undefined && q.pageSize === undefined) {
    q.pageSize = q.size
    delete q.size
  }
  return q
}

export const apiMap: Record<string, ApiFn> = {
  // ---------- 登录 ----------
  // VTJ 版是用户名密码；我们的后端是手机号 + 验证码，这里做一次桥接
  login: async (payload?: unknown) => {
    const p = (payload || {}) as Record<string, string>
    const phone = p.phone || p.username || ''
    const code = p.code || p.password || ''
    const data = (await request.post('/auth/sms/login', { phone, code })) as {
      token: string
      user: Record<string, unknown>
    }
    return {
      token: data.token,
      role: 'admin',
      userInfo: {
        id: String(data.user.id || ''),
        name: String(data.user.nickname || '管理员'),
        phone: String(data.user.phone || ''),
        isAdmin: Boolean(data.user.isAdmin)
      }
    }
  },

  sendSmsCode: async (payload?: unknown) => {
    const p = (payload || {}) as Record<string, string>
    return request.post('/auth/sms/send', { phone: p.phone })
  },

  getMe: () => request.get('/auth/me'),

  logout: () => request.post('/auth/logout'),

  // ---------- 看板 ----------
  // 后端返回 orders/users/pending/trend，这里转成页面要的扁平结构
  getDashboardStats: async () => {
    const d = (await request.get('/admin/dashboard')) as {
      orders: Record<string, number>
      users: Record<string, number>
      pending: Record<string, number>
    }
    return {
      totalOrders: d.orders?.total || 0,
      todayOrders: d.orders?.today_total || 0,
      activeUsers: d.users?.total || 0,
      runnerCount: d.users?.runners || 0,
      revenue: Number(d.orders?.total_amount || 0),
      pendingCount:
        (d.pending?.runnerApplications || 0) +
        (d.pending?.withdrawals || 0) +
        (d.pending?.appealingOrders || 0)
    }
  },

  getDashboardTrend: async () => {
    const d = (await request.get('/admin/dashboard')) as {
      trend?: Array<{ day: string; order_count: number; amount: number }>
    }
    const trend = d.trend || []
    return {
      dates: trend.map((t) => String(t.day).slice(5)),
      orders: trend.map((t) => t.order_count),
      revenue: trend.map((t) => Number(t.amount))
    }
  },

  // ---------- 订单 ----------
  getOrderList: async (payload?: unknown, opts?: { params?: Record<string, unknown> }) => {
    const q = normalizePaging(toQuery(payload, opts))
    // 页面筛选字段名 -> 后端字段名
    if (q.orderNo) {
      q.keyword = q.orderNo
      delete q.orderNo
    }
    if (q.userName) {
      q.keyword = q.keyword || q.userName
      delete q.userName
    }
    if (q.status) {
      q.status = STATUS_TO_CODE[String(q.status)] || q.status
    }
    // 后端分页从 1 开始，页面也是；字段一致
    const res = (await request.get('/admin/orders', { params: q })) as {
      list: Record<string, unknown>[]
      total: number
    }
    return {
      list: (res.list || []).map(toOrderRow),
      total: res.total || 0
    }
  },

  getOrderDetail: async (payload?: unknown, opts?: { params?: Record<string, unknown> }) => {
    const q = toQuery(payload, opts)
    const d = (await request.get(`/admin/orders/${q.id}`)) as Record<string, unknown>
    return {
      ...toOrderRow(d),
      runner_name: d.runnerName || '',
      remark: d.remark || '',
      pickup_code: d.pickupCode || '',
      timeline: buildTimeline(d)
    }
  },

  cancelOrder: async (payload?: unknown) => {
    const p = (payload || {}) as Record<string, string>
    return request.post(`/admin/orders/${p.id}/cancel`, { reason: p.reason || '后台强制取消' })
  },

  completeOrder: async (payload?: unknown) => {
    const p = (payload || {}) as Record<string, string>
    return request.post(`/admin/orders/${p.id}/complete`, { reason: p.reason || '后台强制完成' })
  },

  // ---------- 用户 ----------
  getUserList: async (payload?: unknown, opts?: { params?: Record<string, unknown> }) => {
    const q = normalizePaging(toQuery(payload, opts))
    if (q.status) {
      q.status = q.status === '正常' ? 1 : 0
    }
    const res = (await request.get('/admin/users', { params: q })) as {
      list: Record<string, unknown>[]
      total: number
    }
    return {
      list: (res.list || []).map(toUserRow),
      total: res.total || 0
    }
  },

  getUserDetail: async (payload?: unknown, opts?: { params?: Record<string, unknown> }) => {
    const q = toQuery(payload, opts)
    const d = (await request.get(`/admin/users/${q.id}`)) as Record<string, unknown>
    return { ...toUserRow(d), stats: d.stats }
  },

  adjustCredit: async (payload?: unknown) => {
    const p = (payload || {}) as Record<string, unknown>
    return request.post(`/admin/users/${p.id}/credit`, {
      delta: Number(p.delta || 0),
      reason: p.reason || '管理员调整'
    })
  },

  freezeUser: async (payload?: unknown) => {
    const p = (payload || {}) as Record<string, string>
    return request.post(`/admin/users/${p.id}/freeze`, { reason: p.reason || '管理员冻结' })
  },

  unfreezeUser: async (payload?: unknown) => {
    const p = (payload || {}) as Record<string, string>
    return request.post(`/admin/users/${p.id}/unfreeze`)
  },

  setAdmin: async (payload?: unknown) => {
    const p = (payload || {}) as Record<string, unknown>
    return request.post(`/admin/users/${p.id}/admin`, { isAdmin: Boolean(p.isAdmin) })
  },

  // ---------- 跑腿员审核 ----------
  getRunnerApplications: async (payload?: unknown, opts?: { params?: Record<string, unknown> }) => {
    const q = normalizePaging(toQuery(payload, opts))
    if (q.status) {
      q.status = RUNNER_STATUS_TO_CODE[String(q.status)] ?? q.status
    }
    const res = (await request.get('/admin/runner-applications', { params: q })) as {
      list: Record<string, unknown>[]
      total: number
    }
    return {
      list: (res.list || []).map(toRunnerRow),
      total: res.total || 0
    }
  },

  approveRunner: async (payload?: unknown) => {
    const p = (payload || {}) as Record<string, string>
    return request.post(`/admin/runner-applications/${p.id}/approve`)
  },

  rejectRunner: async (payload?: unknown) => {
    const p = (payload || {}) as Record<string, string>
    return request.post(`/admin/runner-applications/${p.id}/reject`, {
      reason: p.reason || '不符合要求'
    })
  },

  // ---------- 财务 ----------
  getFinanceOverview: async () => {
    const d = (await request.get('/admin/dashboard')) as { orders: Record<string, number> }
    return {
      totalIncome: Number(d.orders?.total_amount || 0),
      totalExpense: Number(d.orders?.total_amount || 0),
      platformFee: 0,
      runnerPayout: Number(d.orders?.total_amount || 0)
    }
  },

  getFinanceRecords: async (payload?: unknown, opts?: { params?: Record<string, unknown> }) => {
    const q = normalizePaging(toQuery(payload, opts))
    const res = (await request.get('/admin/transactions', { params: q })) as {
      list: Record<string, unknown>[]
      total: number
    }
    return {
      list: (res.list || []).map(toTransactionRow),
      total: res.total || 0
    }
  },

  getWithdrawals: async (payload?: unknown, opts?: { params?: Record<string, unknown> }) => {
    const q = normalizePaging(toQuery(payload, opts))
    const res = (await request.get('/admin/withdrawals', { params: q })) as {
      list: Record<string, unknown>[]
      total: number
    }
    return {
      list: (res.list || []).map(toTransactionRow),
      total: res.total || 0
    }
  },

  reviewWithdrawal: async (payload?: unknown) => {
    const p = (payload || {}) as Record<string, unknown>
    return request.post(`/admin/withdrawals/${p.id}/review`, {
      pass: Boolean(p.pass),
      reason: p.reason || ''
    })
  }
}

// ============================================================================
// 字段映射（后端 camelCase -> 页面期望的字段名）
// ============================================================================

const STATUS_TO_CODE: Record<string, string> = {
  待接单: 'WAITING_ACCEPT',
  已接单: 'ACCEPTED',
  取件中: 'PICKING',
  配送中: 'DELIVERING',
  待确认: 'DELIVERED',
  已完成: 'COMPLETED',
  已取消: 'CANCELLED',
  申诉中: 'APPEALING'
}

const RUNNER_STATUS_TO_CODE: Record<string, number> = {
  待审核: 0,
  已通过: 1,
  已拒绝: 2
}

function toOrderRow(d: Record<string, unknown>) {
  return {
    id: d.id,
    order_no: d.orderNo || '',
    user_name: d.publisherName || '',
    runner_name: d.runnerName || '',
    address: [d.buildingName, d.roomNo].filter(Boolean).join(' '),
    station_name: d.stationName || '',
    amount: Number(d.reward || 0),
    status: d.statusText || '',
    status_code: d.status || '',
    create_time: d.createTime || '',
    detail_type: d.deliveryTypeText || '',
    urgent: Boolean(d.urgent)
  }
}

function toUserRow(d: Record<string, unknown>) {
  return {
    id: d.id,
    name: d.nickname || '',
    nickname: d.nickname || '',
    phone: d.phone || '',
    student_no: d.studentNo || '',
    credit: Number(d.creditScore || 0),
    balance: Number(d.balance || 0),
    income: Number(d.income || 0),
    is_runner: Boolean(d.isRunner),
    is_admin: Boolean(d.isAdmin),
    status: Number(d.status) === 1 ? '正常' : '禁用',
    status_code: Number(d.status),
    create_time: d.createTime || ''
  }
}

function toRunnerRow(d: Record<string, unknown>) {
  const code = Number(d.status)
  return {
    id: d.id,
    user_id: d.userId,
    name: d.realName || '',
    phone: d.phone || '',
    student_no: d.studentNo || '',
    campus: d.campus || '',
    intro: d.intro || '',
    id_card_img: d.idCardImg || '',
    status: code === 0 ? '待审核' : code === 1 ? '已通过' : '已拒绝',
    status_code: code,
    reject_reason: d.rejectReason || '',
    apply_time: d.createTime || '',
    reviewed_at: d.reviewedAt || ''
  }
}

/** ★ 资金接口返回下划线字段，这里原样透出（页面用的就是下划线） */
function toTransactionRow(d: Record<string, unknown>) {
  return {
    id: d.id,
    trade_no: d.apply_no || d.order_no || String(d.id || ''),
    type: d.type === 'INCOME' || d.type === 'REFUND' ? '收入' : '支出',
    type_code: d.type,
    amount: Number(d.amount || 0),
    balance: Number(d.balance || 0),
    order_no: d.order_no || '',
    apply_no: d.apply_no || '',
    status: d.status || '',
    remark: d.remark || '',
    create_time: d.created_at || '',
    user_name: d.nickname || '',
    phone: d.phone || ''
  }
}

/** 用时间字段拼出订单动态 */
function buildTimeline(d: Record<string, unknown>) {
  const out: Array<{ time: string; text: string }> = []
  if (d.createTime) out.push({ time: String(d.createTime), text: '用户下单' })
  if (d.acceptTime) out.push({ time: String(d.acceptTime), text: '跑腿员接单' })
  if (d.completeTime) out.push({ time: String(d.completeTime), text: '订单完成' })
  if (d.cancelReason) out.push({ time: String(d.completeTime || d.createTime || ''), text: `订单取消：${d.cancelReason}` })
  return out
}

// ============================================================================
// useProvider：替代 VTJ 的 useProvider({ id, version })
// ============================================================================
export function useProvider(_options?: { id?: string; version?: string }) {
  return {
    apis: new Proxy({} as Record<string, ApiFn>, {
      get(_t, name: string) {
        const fn = apiMap[name]
        if (!fn) {
          // 未实现的接口：给出明确提示而不是静默失败
          return async () => {
            console.warn(`[VTJ兼容层] 接口 "${name}" 未映射到后端，返回空数据`)
            return { list: [], total: 0 }
          }
        }
        return fn
      }
    }),
    env: {},
    store: readonly(state)
  }
}

export { state as __globalState }
