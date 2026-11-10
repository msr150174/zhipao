// ============================================================
// 智跑校园 · 沙箱演示后端 —— 按契约文档实现 21 个接口
// 响应信封：{ code, msg, data }，HTTP 状态码永远 200
// ============================================================

import express from 'express'
import {
  createDb,
  fmt,
  fmtDay,
  maskPhone,
  rid,
  ORDER_STATUS_TEXT,
  DELIVERY_TYPE_TEXT,
  PACKAGE_SIZE_TEXT,
  RUNNER_STATUS_TEXT
} from './data.mjs'

const ACTIVE_STATUS = ['WAITING_ACCEPT', 'ACCEPTED', 'PICKING', 'DELIVERING', 'APPEALING']
const FINAL_STATUS = ['COMPLETED', 'CANCELLED']

export function createMockApp() {
  const app = express()
  app.use(express.json())

  const db = createDb()

  const ok = (res, data) => res.json({ code: 200, msg: 'ok', data })
  const fail = (res, code, msg) => res.json({ code, msg, data: null })

  const paginate = (arr, pageRaw, sizeRaw) => {
    const page = Math.max(1, parseInt(pageRaw, 10) || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(sizeRaw, 10) || 20))
    const start = (page - 1) * pageSize
    return {
      list: arr.slice(start, start + pageSize),
      total: arr.length,
      page,
      pageSize,
      hasMore: start + pageSize < arr.length
    }
  }

  // ==================== 鉴权 ====================

  function authRequired(req, res, next) {
    const header = req.headers.authorization || ''
    const token = header.replace(/^Bearer\s+/i, '')
    const userId = db.tokens.get(token)
    const user = userId ? db.users.find((u) => u.id === userId) : null
    if (!user) {
      return fail(res, 401, '未登录或登录已失效')
    }
    req.authUser = user
    next()
  }

  function adminRequired(req, res, next) {
    authRequired(req, res, () => {
      if (!req.authUser.isAdmin) {
        return fail(res, 403, '无管理权限')
      }
      next()
    })
  }

  // ==================== 数据映射 ====================

  const userById = (id) => db.users.find((u) => u.id === id)
  const stationById = (id) => db.stations.find((s) => s.id === id)
  const buildingById = (id) => db.buildings.find((b) => b.id === id)

  /** 登录态用户对象（手机号脱敏） */
  function authUserView(u) {
    return {
      id: u.id,
      nickname: u.nickname,
      phone: maskPhone(u.phone),
      creditScore: u.creditScore,
      balance: u.balance,
      income: u.income,
      isRunner: u.isRunner,
      isAdmin: u.isAdmin,
      realNameVerified: u.realNameVerified
    }
  }

  function adminUserView(u) {
    return {
      id: u.id,
      nickname: u.nickname,
      phone: u.phone,
      studentNo: u.studentNo,
      creditScore: u.creditScore,
      balance: u.balance,
      income: u.income,
      isRunner: u.isRunner,
      isAdmin: u.isAdmin,
      realNameVerified: u.realNameVerified,
      status: u.status,
      statusText: u.status === 1 ? '正常' : '已冻结',
      createTime: fmt(u.created)
    }
  }

  function orderListView(o) {
    const publisher = userById(o.publisherId)
    const runner = o.runnerId ? userById(o.runnerId) : null
    return {
      id: o.id,
      orderNo: o.orderNo,
      status: o.status,
      statusText: ORDER_STATUS_TEXT[o.status],
      deliveryType: o.deliveryType,
      deliveryTypeText: DELIVERY_TYPE_TEXT[o.deliveryType],
      packageSizeText: PACKAGE_SIZE_TEXT[o.packageSize],
      stationName: stationById(o.stationId)?.name || '',
      buildingName: buildingById(o.buildingId)?.name || '',
      roomNo: o.roomNo,
      reward: o.reward,
      urgent: o.urgent,
      publisherId: o.publisherId,
      publisherName: publisher?.nickname || '',
      runnerId: o.runnerId,
      runnerName: runner?.nickname || null,
      createTime: fmt(o.createTime),
      deadline: fmt(o.deadline)
    }
  }

  function orderDetailView(o) {
    const station = stationById(o.stationId)
    const building = buildingById(o.buildingId)
    const publisher = userById(o.publisherId)
    const runner = o.runnerId ? userById(o.runnerId) : null
    return {
      ...orderListView(o),
      packageSize: o.packageSize,
      stationId: o.stationId,
      pickupCode: o.pickupCode,
      shopNo: o.shopNo,
      stationLng: station?.lng ?? null,
      stationLat: station?.lat ?? null,
      buildingId: o.buildingId,
      buildingLng: building?.lng ?? null,
      buildingLat: building?.lat ?? null,
      itemCount: o.itemCount,
      remark: o.remark,
      distanceMeters: o.distanceMeters,
      publisherPhone: publisher?.phone || '',
      runnerCredit: runner ? runner.creditScore : null,
      cancelReason: o.cancelReason,
      acceptTime: o.acceptTime ? fmt(o.acceptTime) : null,
      completeTime: o.completeTime ? fmt(o.completeTime) : null,
      expired: ACTIVE_STATUS.includes(o.status) && o.deadline.getTime() < Date.now()
    }
  }

  function applicationView(a) {
    return {
      id: a.id,
      userId: a.userId,
      realName: a.realName,
      studentNo: a.studentNo,
      phone: a.phone,
      campus: a.campus,
      idCardImg: a.idCardImg,
      intro: a.intro,
      status: a.status,
      statusText: RUNNER_STATUS_TEXT[a.status],
      rejectReason: a.rejectReason,
      createTime: fmt(a.createTime),
      reviewedAt: a.reviewedAt ? fmt(a.reviewedAt) : null
    }
  }

  /** 流水视图（★ 下划线字段，去掉内部字段） */
  function txnView(t, extra = {}) {
    const { _created, ...rest } = t
    return { ...rest, ...extra }
  }

  // ==================== 健康检查 ====================

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'UP', mode: 'mock', mysql: { connected: true }, redis: { connected: true } })
  })

  // ==================== 登录（4 个） ====================

  // ① 发送验证码
  app.post('/api/auth/sms/send', (req, res) => {
    const { phone } = req.body || {}
    if (!/^1[3-9]\d{9}$/.test(phone || '')) {
      return fail(res, 400, '手机号格式不正确')
    }
    const code = String(Math.floor(100000 + Math.random() * 900000))
    db.smsCodes.set(phone, { code, expires: Date.now() + 5 * 60 * 1000 })
    console.log(`【开发模式】手机号 ${phone} 的验证码为 ${code}（5 分钟内有效）`)
    // devCode 为演示便利字段，真实后端只返回 { sent, devMode }
    ok(res, { sent: true, devMode: true, devCode: code })
  })

  // ② 手机号登录
  app.post('/api/auth/sms/login', (req, res) => {
    const { phone, code } = req.body || {}
    if (!phone || !code) {
      return fail(res, 400, '手机号和验证码必填')
    }
    const record = db.smsCodes.get(phone)
    if (!record || record.code !== String(code) || record.expires < Date.now()) {
      return fail(res, 400, '验证码错误或已过期')
    }
    db.smsCodes.delete(phone)

    let user = db.users.find((u) => u.phone === phone)
    if (!user) {
      // 新手机号自动注册为普通用户（isAdmin=false → 前端会提示无管理权限）
      user = {
        id: rid(),
        openid: 'dev_openid_default',
        nickname: `用户${phone.slice(-4)}`,
        phone,
        studentNo: null,
        avatarUrl: null,
        creditScore: 60,
        balance: 0,
        income: 0,
        isRunner: false,
        isAdmin: false,
        realNameVerified: false,
        status: 1,
        created: new Date()
      }
      db.users.push(user)
    }

    const token = `mock_${rid(24)}`
    db.tokens.set(token, user.id)
    ok(res, { token, user: authUserView(user) })
  })

  // ③ 获取当前用户
  app.get('/api/auth/me', authRequired, (req, res) => {
    ok(res, authUserView(req.authUser))
  })

  // ④ 登出
  app.post('/api/auth/logout', authRequired, (req, res) => {
    const header = req.headers.authorization || ''
    db.tokens.delete(header.replace(/^Bearer\s+/i, ''))
    ok(res, { ok: true })
  })

  // ==================== 数据看板（1 个） ====================

  app.get('/api/admin/dashboard', adminRequired, (_req, res) => {
    const now = new Date()
    const today = fmtDay(now)
    const isToday = (d) => fmtDay(d) === today

    const orders = db.orders
    const completed = orders.filter((o) => o.status === 'COMPLETED')
    const sum = (arr, fn) => arr.reduce((acc, x) => acc + fn(x), 0)

    const trend = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const day = fmtDay(d)
      trend.push({
        day,
        order_count: orders.filter((o) => fmtDay(o.createTime) === day).length,
        amount: sum(
          completed.filter((o) => o.completeTime && fmtDay(o.completeTime) === day),
          (o) => o.reward
        )
      })
    }

    ok(res, {
      orders: {
        total: orders.length,
        today_total: orders.filter((o) => isToday(o.createTime)).length,
        waiting_accept: orders.filter((o) => o.status === 'WAITING_ACCEPT').length,
        in_progress: orders.filter((o) => ['ACCEPTED', 'PICKING', 'DELIVERING'].includes(o.status)).length,
        delivered: orders.filter((o) => o.status === 'DELIVERED').length,
        completed: completed.length,
        cancelled: orders.filter((o) => o.status === 'CANCELLED').length,
        appealing: orders.filter((o) => o.status === 'APPEALING').length,
        total_amount: sum(completed, (o) => o.reward),
        today_amount: sum(completed.filter((o) => o.completeTime && isToday(o.completeTime)), (o) => o.reward)
      },
      users: {
        total: db.users.length,
        today_new: db.users.filter((u) => isToday(u.created)).length,
        runners: db.users.filter((u) => u.isRunner).length,
        frozen: db.users.filter((u) => u.status === 0).length,
        low_credit: db.users.filter((u) => u.creditScore < 60).length,
        total_balance: sum(db.users, (u) => u.balance)
      },
      pending: {
        runnerApplications: db.applications.filter((a) => a.status === 0).length,
        appealingOrders: orders.filter((o) => o.status === 'APPEALING').length,
        withdrawals: db.transactions.filter((t) => t.type === 'WITHDRAW' && t.status === 'PENDING').length,
        overdueOrders: orders.filter((o) => o.status === 'WAITING_ACCEPT' && o.deadline.getTime() < Date.now()).length
      },
      trend
    })
  })

  // ==================== 订单管理（4 个） ====================

  // ① 订单列表
  app.get('/api/admin/orders', adminRequired, (req, res) => {
    const { status, deliveryType, keyword, startDate, endDate, page, pageSize } = req.query
    let arr = [...db.orders]

    if (status) arr = arr.filter((o) => o.status === status)
    if (deliveryType) arr = arr.filter((o) => o.deliveryType === Number(deliveryType))
    if (keyword) {
      const kw = String(keyword).trim()
      arr = arr.filter(
        (o) => o.orderNo.includes(kw) || (stationById(o.stationId)?.name || '').includes(kw)
      )
    }
    if (startDate) arr = arr.filter((o) => o.createTime >= new Date(`${startDate} 00:00:00`))
    if (endDate) arr = arr.filter((o) => o.createTime <= new Date(`${endDate} 23:59:59`))

    arr.sort((a, b) => b.createTime - a.createTime)
    const paged = paginate(arr.map(orderListView), page, pageSize)
    ok(res, paged)
  })

  // ② 订单详情（不脱敏，取件码明文）
  app.get('/api/admin/orders/:id', adminRequired, (req, res) => {
    const order = db.orders.find((o) => o.id === req.params.id)
    if (!order) return fail(res, 404, '订单不存在')
    ok(res, orderDetailView(order))
  })

  // ③ 强制取消订单
  app.post('/api/admin/orders/:id/cancel', adminRequired, (req, res) => {
    const order = db.orders.find((o) => o.id === req.params.id)
    if (!order) return fail(res, 404, '订单不存在')
    const { reason } = req.body || {}
    if (!reason || !String(reason).trim()) return fail(res, 400, '原因必填')
    if (FINAL_STATUS.includes(order.status)) return fail(res, 400, '订单已是终态，无法取消')

    order.status = 'CANCELLED'
    order.cancelReason = String(reason).trim()
    ok(res, { ok: true, orderNo: order.orderNo, message: '订单已强制取消' })
  })

  // ④ 强制完成订单（仅 DELIVERED）
  app.post('/api/admin/orders/:id/complete', adminRequired, (req, res) => {
    const order = db.orders.find((o) => o.id === req.params.id)
    if (!order) return fail(res, 404, '订单不存在')
    const { reason } = req.body || {}
    if (!reason || !String(reason).trim()) return fail(res, 400, '原因必填')
    if (order.status !== 'DELIVERED') return fail(res, 400, '仅「已送达待确认」的订单可强制完成')

    order.status = 'COMPLETED'
    order.completeTime = new Date()
    ok(res, { ok: true, orderNo: order.orderNo, message: '订单已强制完成' })
  })

  // ==================== 用户管理（6 个） ====================

  // ① 用户列表
  app.get('/api/admin/users', adminRequired, (req, res) => {
    const { keyword, minCredit, maxCredit, isRunner, status, page, pageSize } = req.query
    let arr = [...db.users]

    if (keyword) {
      const kw = String(keyword).trim()
      arr = arr.filter(
        (u) => u.nickname.includes(kw) || u.phone.includes(kw) || (u.studentNo || '').includes(kw)
      )
    }
    if (minCredit !== undefined && minCredit !== '') arr = arr.filter((u) => u.creditScore >= Number(minCredit))
    if (maxCredit !== undefined && maxCredit !== '') arr = arr.filter((u) => u.creditScore <= Number(maxCredit))
    if (isRunner !== undefined && isRunner !== '') arr = arr.filter((u) => u.isRunner === (String(isRunner) === 'true'))
    if (status !== undefined && status !== '') arr = arr.filter((u) => u.status === Number(status))

    arr.sort((a, b) => b.created - a.created)
    ok(res, paginate(arr.map(adminUserView), page, pageSize))
  })

  // ② 用户详情（含订单统计）
  app.get('/api/admin/users/:id', adminRequired, (req, res) => {
    const user = userById(req.params.id)
    if (!user) return fail(res, 404, '用户不存在')

    const related = db.orders.filter((o) => o.publisherId === user.id || o.runnerId === user.id)
    const taken = db.orders.filter((o) => o.runnerId === user.id)
    const takenCompleted = taken.filter((o) => o.status === 'COMPLETED')

    ok(res, {
      ...adminUserView(user),
      openid: user.openid,
      avatarUrl: user.avatarUrl,
      stats: {
        total: related.length,
        published: db.orders.filter((o) => o.publisherId === user.id).length,
        taken: taken.length,
        completed: takenCompleted.length,
        earned: takenCompleted.reduce((acc, o) => acc + o.reward, 0)
      }
    })
  })

  // ③ 调整信用分
  app.post('/api/admin/users/:id/credit', adminRequired, (req, res) => {
    const user = userById(req.params.id)
    if (!user) return fail(res, 404, '用户不存在')
    const { delta, reason } = req.body || {}
    const d = Number(delta)
    if (!Number.isFinite(d) || d === 0) return fail(res, 400, '变动值不能为 0')
    if (Math.abs(d) > 100) return fail(res, 400, '变动值绝对值不能超过 100')
    if (!reason || !String(reason).trim()) return fail(res, 400, '原因必填')

    const before = user.creditScore
    user.creditScore = Math.min(100, Math.max(0, before + d))
    ok(res, { ok: true, before, after: user.creditScore, message: '信用分已调整' })
  })

  // ④ 冻结账号
  app.post('/api/admin/users/:id/freeze', adminRequired, (req, res) => {
    const user = userById(req.params.id)
    if (!user) return fail(res, 404, '用户不存在')
    const { reason } = req.body || {}
    if (!reason || !String(reason).trim()) return fail(res, 400, '原因必填')
    user.status = 0
    ok(res, { ok: true, message: '账号已冻结' })
  })

  // ⑤ 解冻账号
  app.post('/api/admin/users/:id/unfreeze', adminRequired, (req, res) => {
    const user = userById(req.params.id)
    if (!user) return fail(res, 404, '用户不存在')
    user.status = 1
    ok(res, { ok: true, message: '账号已解冻' })
  })

  // ⑥ 设置 / 取消管理员
  app.post('/api/admin/users/:id/admin', adminRequired, (req, res) => {
    const user = userById(req.params.id)
    if (!user) return fail(res, 404, '用户不存在')
    const { isAdmin } = req.body || {}
    if (typeof isAdmin !== 'boolean') return fail(res, 400, 'isAdmin 必须为布尔值')
    if (user.id === req.authUser.id && !isAdmin) return fail(res, 400, '不能取消自己的管理员权限')
    user.isAdmin = isAdmin
    ok(res, { ok: true, message: isAdmin ? '已设置管理员' : '已取消管理员' })
  })

  // ==================== 跑腿员审核（3 个） ====================

  // ① 申请列表（status 0=待审 1=通过 2=驳回，不传=全部）
  app.get('/api/admin/runner-applications', adminRequired, (req, res) => {
    const { status, page, pageSize } = req.query
    let arr = [...db.applications]
    if (status !== undefined && status !== '') {
      arr = arr.filter((a) => a.status === Number(status))
    }
    arr.sort((a, b) => b.createTime - a.createTime)
    ok(res, paginate(arr.map(applicationView), page, pageSize))
  })

  // ② 审核通过
  app.post('/api/admin/runner-applications/:id/approve', adminRequired, (req, res) => {
    const appItem = db.applications.find((a) => a.id === Number(req.params.id))
    if (!appItem) return fail(res, 404, '申请不存在')
    if (appItem.status !== 0) return fail(res, 400, '该申请已审核')

    appItem.status = 1
    appItem.reviewedAt = new Date()
    const user = userById(appItem.userId)
    if (user) user.isRunner = true
    ok(res, { ok: true, userId: appItem.userId, message: '已通过，该用户现在可以接单' })
  })

  // ③ 审核驳回
  app.post('/api/admin/runner-applications/:id/reject', adminRequired, (req, res) => {
    const appItem = db.applications.find((a) => a.id === Number(req.params.id))
    if (!appItem) return fail(res, 404, '申请不存在')
    const { reason } = req.body || {}
    if (!reason || !String(reason).trim()) return fail(res, 400, '原因必填')
    if (String(reason).trim().length > 200) return fail(res, 400, '原因最长 200 字')
    if (appItem.status !== 0) return fail(res, 400, '该申请已审核')

    appItem.status = 2
    appItem.rejectReason = String(reason).trim()
    appItem.reviewedAt = new Date()
    ok(res, { ok: true, userId: appItem.userId, message: '已驳回' })
  })

  // ==================== 资金管理（3 个，★ 下划线字段） ====================

  // ① 全局流水
  app.get('/api/admin/transactions', adminRequired, (req, res) => {
    const { type, keyword, page, pageSize } = req.query
    let arr = [...db.transactions]
    if (type) arr = arr.filter((t) => t.type === type)
    if (keyword) {
      const kw = String(keyword).trim()
      arr = arr.filter(
        (t) =>
          (t.order_no || '').includes(kw) ||
          (t.apply_no || '').includes(kw) ||
          t.nickname.includes(kw) ||
          t.phone.includes(kw)
      )
    }
    arr.sort((a, b) => b._created - a._created)
    ok(res, paginate(arr.map((t) => txnView(t)), page, pageSize))
  })

  // ② 提现申请列表（额外含 user_balance）
  app.get('/api/admin/withdrawals', adminRequired, (req, res) => {
    const { status, page, pageSize } = req.query
    let arr = db.transactions.filter((t) => t.type === 'WITHDRAW')
    if (status) arr = arr.filter((t) => t.status === status)
    arr.sort((a, b) => b._created - a._created)
    const withBalance = arr.map((t) => {
      const user = userById(t.user_id)
      return txnView(t, { user_balance: user ? user.balance : 0 })
    })
    ok(res, paginate(withBalance, page, pageSize))
  })

  // ③ 审核提现：pass=false 时自动把金额退回用户余额
  app.post('/api/admin/withdrawals/:id/review', adminRequired, (req, res) => {
    const txnItem = db.transactions.find((t) => t.id === Number(req.params.id) && t.type === 'WITHDRAW')
    if (!txnItem) return fail(res, 404, '提现申请不存在')
    const { pass } = req.body || {}
    if (typeof pass !== 'boolean') return fail(res, 400, 'pass 必须为布尔值')
    if (txnItem.status !== 'PENDING') return fail(res, 400, '该申请已审核')

    const user = userById(txnItem.user_id)
    if (pass) {
      txnItem.status = 'SUCCESS'
      // 通过：标记已线下转账，扣减余额
      if (user) user.balance = Math.max(0, user.balance - txnItem.amount)
      txnItem.balance = user ? user.balance : txnItem.balance
      return ok(res, { ok: true, message: '已通过，请尽快线下转账' })
    }

    // 驳回：金额退回用户余额
    txnItem.status = 'REJECTED'
    if (user) user.balance = user.balance + 0 // 申请时未冻结，余额保持不变
    return ok(res, { ok: true, message: '已驳回，金额已退回用户余额' })
  })

  // 兜底 404（信封格式）
  app.use('/api', (_req, res) => fail(res, 404, '接口不存在'))

  return app
}
