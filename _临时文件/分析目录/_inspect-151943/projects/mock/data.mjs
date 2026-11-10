// ============================================================
// 智跑校园 · 沙箱演示后端 —— 内存数据种子
// ★ 仅用于沙箱预览 / 本地无后端时演示，字段与契约文档完全一致
// ============================================================

const HEX = '0123456789abcdef'
const ALNUM = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export const rid = (len = 32) =>
  Array.from({ length: len }, () => HEX[Math.floor(Math.random() * 16)]).join('')

const randChars = (len) =>
  Array.from({ length: len }, () => ALNUM[Math.floor(Math.random() * ALNUM.length)]).join('')

const pad = (n) => String(n).padStart(2, '0')

/** YYYY-MM-DD HH:mm:ss */
export const fmt = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`

/** YYYY-MM-DD */
export const fmtDay = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/** YYMMDD */
const fmtShort = (d) =>
  `${String(d.getFullYear()).slice(2)}${pad(d.getMonth() + 1)}${pad(d.getDate())}`

export const maskPhone = (p) => (p && p.length === 11 ? `${p.slice(0, 3)}****${p.slice(7)}` : p)

/** n 天前某时刻 */
function at(daysAgo, hour, minute = 0) {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  d.setHours(hour, minute, Math.floor(Math.random() * 50) + 5, 0)
  return d
}

/** 证件照示意图（SVG data URI，自包含不依赖外网） */
function idCardImg(name) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="150">
  <rect width="240" height="150" rx="8" fill="#eef2f0"/>
  <rect x="16" y="20" width="64" height="80" rx="4" fill="#c9d6ce"/>
  <circle cx="48" cy="48" r="14" fill="#9fb8aa"/>
  <rect x="30" y="66" width="36" height="24" rx="12" fill="#9fb8aa"/>
  <rect x="96" y="30" width="110" height="10" rx="5" fill="#c9d6ce"/>
  <rect x="96" y="50" width="80" height="10" rx="5" fill="#c9d6ce"/>
  <rect x="96" y="70" width="96" height="10" rx="5" fill="#c9d6ce"/>
  <text x="120" y="130" font-size="13" fill="#8a9a90" text-anchor="middle" font-family="sans-serif">证件照示意 · ${name}</text>
</svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

// ==================== 常量映射 ====================

export const ORDER_STATUS_TEXT = {
  CREATED: '已创建',
  WAITING_ACCEPT: '待接单',
  ACCEPTED: '已接单',
  PICKING: '取件中',
  DELIVERING: '配送中',
  DELIVERED: '已送达待确认',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
  APPEALING: '申诉中'
}

export const DELIVERY_TYPE_TEXT = { 1: '取快递', 2: '取外卖' }
export const PACKAGE_SIZE_TEXT = { 1: '小件', 2: '中件', 3: '大件' }
export const RUNNER_STATUS_TEXT = { 0: '待审核', 1: '已通过', 2: '已驳回' }

// ==================== 种子数据 ====================

export function createDb() {
  // ---------- 驿站 / 楼栋 ----------
  const stations = [
    { id: 'st_001', name: '菜鸟驿站(3号楼店)', lng: 113.335, lat: 23.155 },
    { id: 'st_002', name: '菜鸟驿站(7号楼店)', lng: 113.3362, lat: 23.1557 },
    { id: 'st_003', name: '妈妈驿站(南门店)', lng: 113.3341, lat: 23.1542 }
  ]
  const buildings = [
    { id: 'bd_001', name: '1号楼', lng: 113.3345, lat: 23.1548 },
    { id: 'bd_002', name: '2号楼', lng: 113.3349, lat: 23.1551 },
    { id: 'bd_003', name: '3号楼', lng: 113.3352, lat: 23.1544 },
    { id: 'bd_004', name: '5号楼', lng: 113.3358, lat: 23.1555 },
    { id: 'bd_005', name: '8号楼', lng: 113.3366, lat: 23.156 }
  ]

  // ---------- 用户（15 个） ----------
  const userSeed = [
    { id: '25c78b09fcc74449bd8bed3ef7252a96', nickname: '同学', phone: '13800001234', creditScore: 60, balance: 0, income: 0, isRunner: false, isAdmin: true, realNameVerified: false, studentNo: null, status: 1, created: at(6, 20, 31) },
    { nickname: '测试用户B', phone: '13800005678', creditScore: 63, balance: 10, income: 10, isRunner: true, isAdmin: false, realNameVerified: true, studentNo: '2021002', status: 1, created: at(5, 9, 12) },
    { nickname: '测试用户C', phone: '13800009999', creditScore: 45, balance: 0, income: 0, isRunner: false, isAdmin: false, realNameVerified: false, studentNo: '2021003', status: 1, created: at(5, 14, 40) },
    { nickname: '李同学', phone: '13811110001', creditScore: 88, balance: 3.5, income: 25, isRunner: true, isAdmin: false, realNameVerified: true, studentNo: '2021011', status: 1, created: at(4, 10, 5) },
    { nickname: '王同学', phone: '13811110002', creditScore: 92, balance: 0, income: 0, isRunner: false, isAdmin: false, realNameVerified: true, studentNo: '2021012', status: 1, created: at(4, 16, 22) },
    { nickname: '张同学', phone: '13811110003', creditScore: 70, balance: 6, income: 6, isRunner: false, isAdmin: false, realNameVerified: false, studentNo: null, status: 1, created: at(3, 11, 18) },
    { nickname: '陈同学', phone: '13811110004', creditScore: 55, balance: 0, income: 0, isRunner: false, isAdmin: false, realNameVerified: false, studentNo: '2021014', status: 1, created: at(3, 15, 47) },
    { nickname: '刘同学', phone: '13811110005', creditScore: 96, balance: 0, income: 20, isRunner: true, isAdmin: false, realNameVerified: true, studentNo: '2021015', status: 1, created: at(2, 8, 55) },
    { nickname: '赵同学', phone: '13811110006', creditScore: 76, balance: 0, income: 0, isRunner: false, isAdmin: false, realNameVerified: false, studentNo: '2021016', status: 0, created: at(2, 19, 8) },
    { nickname: '周同学', phone: '13811110007', creditScore: 100, balance: 12, income: 0, isRunner: false, isAdmin: false, realNameVerified: true, studentNo: '2021017', status: 1, created: at(1, 9, 30) },
    { nickname: '吴同学', phone: '13811110008', creditScore: 40, balance: 0, income: 0, isRunner: false, isAdmin: false, realNameVerified: false, studentNo: null, status: 1, created: at(1, 13, 26) },
    { nickname: '郑同学', phone: '13811110009', creditScore: 83, balance: 0, income: 0, isRunner: false, isAdmin: false, realNameVerified: false, studentNo: '2021019', status: 1, created: at(1, 18, 41) },
    { nickname: '孙同学', phone: '13811110010', creditScore: 67, balance: 0, income: 0, isRunner: false, isAdmin: false, realNameVerified: false, studentNo: '2021020', status: 1, created: at(0, 8, 14) },
    { nickname: '钱同学', phone: '13811110011', creditScore: 95, balance: 0, income: 0, isRunner: false, isAdmin: false, realNameVerified: true, studentNo: '2021021', status: 1, created: at(0, 9, 48) },
    { nickname: '冯同学', phone: '13811110012', creditScore: 58, balance: 0, income: 0, isRunner: false, isAdmin: false, realNameVerified: false, studentNo: null, status: 1, created: at(0, 10, 33) }
  ]
  const users = userSeed.map((u) => ({
    openid: 'dev_openid_default',
    avatarUrl: null,
    ...u,
    id: u.id || rid()
  }))
  const byName = (n) => users.find((u) => u.nickname === n)

  // ---------- 订单（15 个） ----------
  const C = byName('测试用户C')
  const B = byName('测试用户B')
  const L = byName('李同学')
  const W = byName('王同学')
  const ZH = byName('张同学')

  const orderSeed = [
    // 5 待接单（3 今天 / 2 昨天 → 昨天 2 单已超时）
    { status: 'WAITING_ACCEPT', publisher: C, reward: 10, created: at(0, 10, 17), station: 0, building: 0, roomNo: '203', pkg: 2, pickupCode: '8-2-3021', deliveryType: 1, remark: '', urgent: false },
    { status: 'WAITING_ACCEPT', publisher: W, reward: 8, created: at(0, 11, 5), station: 1, building: 2, roomNo: '515', pkg: 1, pickupCode: '3-1-1054', deliveryType: 1, remark: '麻烦轻拿轻放', urgent: true },
    { status: 'WAITING_ACCEPT', publisher: ZH, reward: 6, created: at(0, 12, 40), station: 2, building: 3, roomNo: '108', pkg: 1, pickupCode: '', deliveryType: 2, shopNo: 'A12', remark: '不要辣', urgent: false },
    { status: 'WAITING_ACCEPT', publisher: C, reward: 12, created: at(1, 9, 2), station: 0, building: 0, roomNo: '203', pkg: 3, pickupCode: '6-4-2210', deliveryType: 1, remark: '', urgent: false },
    { status: 'WAITING_ACCEPT', publisher: L, reward: 9, created: at(1, 15, 30), station: 1, building: 4, roomNo: '322', pkg: 2, pickupCode: '2-7-0987', deliveryType: 1, remark: '', urgent: true },
    // 进行中 2（已接单 1 + 配送中 1）
    { status: 'ACCEPTED', publisher: ZH, runner: B, reward: 10, created: at(1, 10, 8), station: 0, building: 2, roomNo: '610', pkg: 2, pickupCode: '5-3-3345', deliveryType: 1, remark: '', urgent: false },
    { status: 'DELIVERING', publisher: W, runner: B, reward: 7, created: at(0, 9, 50), station: 2, building: 1, roomNo: '214', pkg: 1, pickupCode: '', deliveryType: 2, shopNo: 'B07', remark: '', urgent: false },
    // 已完成 2（报酬合计 10）
    { status: 'COMPLETED', publisher: C, runner: B, reward: 5, created: at(2, 10, 12), station: 0, building: 0, roomNo: '203', pkg: 1, pickupCode: '1-5-7762', deliveryType: 1, remark: '', urgent: false },
    { status: 'COMPLETED', publisher: L, runner: B, reward: 5, created: at(4, 14, 25), station: 1, building: 4, roomNo: '601', pkg: 1, pickupCode: '7-2-4418', deliveryType: 1, remark: '', urgent: false },
    // 已取消 6
    { status: 'CANCELLED', publisher: C, reward: 10, created: at(1, 18, 20), station: 0, building: 0, roomNo: '203', pkg: 2, pickupCode: '4-6-5521', deliveryType: 1, remark: '', urgent: false, cancelReason: '用户申诉，订单异常' },
    { status: 'CANCELLED', publisher: ZH, reward: 6, created: at(2, 16, 45), station: 2, building: 2, roomNo: '404', pkg: 1, pickupCode: '', deliveryType: 2, shopNo: 'C03', remark: '', urgent: false, cancelReason: '重复下单' },
    { status: 'CANCELLED', publisher: W, reward: 8, created: at(3, 11, 33), station: 1, building: 1, roomNo: '517', pkg: 2, pickupCode: '9-1-2233', deliveryType: 1, remark: '', urgent: false, cancelReason: '取件码错误' },
    { status: 'CANCELLED', publisher: L, reward: 7, created: at(3, 17, 5), station: 0, building: 3, roomNo: '221', pkg: 1, pickupCode: '8-8-1145', deliveryType: 1, remark: '', urgent: false, cancelReason: '用户主动取消' },
    { status: 'CANCELLED', publisher: C, reward: 10, created: at(5, 12, 18), station: 0, building: 0, roomNo: '203', pkg: 2, pickupCode: '3-3-6677', deliveryType: 1, remark: '', urgent: false, cancelReason: '超时未接单' },
    { status: 'CANCELLED', publisher: ZH, reward: 9, created: at(6, 15, 52), station: 1, building: 2, roomNo: '118', pkg: 2, pickupCode: '2-2-8890', deliveryType: 1, remark: '', urgent: false, cancelReason: '用户主动取消' }
  ]

  const orders = orderSeed.map((o) => {
    const accepted = ['ACCEPTED', 'PICKING', 'DELIVERING', 'DELIVERED', 'COMPLETED'].includes(o.status)
    const completed = o.status === 'COMPLETED'
    return {
      id: rid(),
      orderNo: `ZP${fmtShort(o.created)}${randChars(6)}`,
      status: o.status,
      deliveryType: o.deliveryType,
      packageSize: o.pkg,
      stationId: stations[o.station].id,
      pickupCode: o.pickupCode,
      shopNo: o.shopNo || null,
      buildingId: buildings[o.building].id,
      roomNo: o.roomNo,
      reward: o.reward,
      urgent: o.urgent,
      publisherId: o.publisher.id,
      runnerId: o.runner ? o.runner.id : null,
      itemCount: o.pkg >= 3 ? 2 : 1,
      remark: o.remark,
      distanceMeters: null,
      cancelReason: o.cancelReason || null,
      createTime: o.created,
      deadline: new Date(o.created.getTime() + 2 * 3600 * 1000),
      acceptTime: accepted ? new Date(o.created.getTime() + 10 * 60 * 1000) : null,
      completeTime: completed ? new Date(o.created.getTime() + 55 * 60 * 1000) : null
    }
  })

  // ---------- 跑腿员申请（4 个：待审 2 / 通过 1 / 驳回 1） ----------
  const applications = [
    { id: 1, userId: byName('吴同学').id, realName: '张三', studentNo: '2021001', phone: '13800001111', campus: '东校区', idCardImg: idCardImg('张三'), intro: '空闲时间多，熟悉校园各楼栋分布', status: 0, rejectReason: null, createTime: at(0, 9, 0), reviewedAt: null },
    { id: 2, userId: byName('钱同学').id, realName: '赵六', studentNo: '2021045', phone: '13800002222', campus: '西校区', idCardImg: idCardImg('赵六'), intro: '有电动车，配送速度快', status: 0, rejectReason: null, createTime: at(0, 11, 20), reviewedAt: null },
    { id: 3, userId: B.id, realName: '李四', studentNo: '2021002', phone: '13800005678', campus: '东校区', idCardImg: idCardImg('李四'), intro: '责任心强，时间稳定', status: 1, rejectReason: null, createTime: at(2, 10, 0), reviewedAt: at(1, 9, 30) },
    { id: 4, userId: byName('陈同学').id, realName: '王五', studentNo: '2021077', phone: '13800003333', campus: '北校区', idCardImg: idCardImg('王五'), intro: '想赚点生活费', status: 2, rejectReason: '学号与姓名不匹配', createTime: at(3, 14, 0), reviewedAt: at(2, 16, 0) }
  ]

  // ---------- 资金流水（★ 下划线字段名） ----------
  const completedOrders = orders.filter((o) => o.status === 'COMPLETED')
  const cancelledOrders = orders.filter((o) => o.status === 'CANCELLED')
  let txnSeq = 1
  const txn = (partial) => ({
    id: txnSeq++,
    user_id: partial.user.id,
    type: partial.type,
    amount: partial.amount,
    balance: partial.balance,
    order_no: partial.orderNo || null,
    apply_no: partial.applyNo || null,
    status: partial.status || 'SUCCESS',
    remark: partial.remark,
    created_at: fmt(partial.created),
    nickname: partial.user.nickname,
    phone: partial.user.phone,
    _created: partial.created
  })

  const transactions = [
    txn({ user: B, type: 'INCOME', amount: 5, balance: 5, orderNo: completedOrders[1]?.orderNo, remark: '跑腿收入', created: at(4, 15, 25) }),
    txn({ user: C, type: 'EXPENSE', amount: 5, balance: 0, orderNo: completedOrders[0]?.orderNo, remark: '发布订单', created: at(2, 10, 13) }),
    txn({ user: B, type: 'INCOME', amount: 5, balance: 10, orderNo: completedOrders[0]?.orderNo, remark: '跑腿收入', created: at(2, 11, 12) }),
    txn({ user: C, type: 'EXPENSE', amount: 10, balance: 0, orderNo: cancelledOrders[0]?.orderNo, remark: '发布订单', created: at(1, 18, 21) }),
    txn({ user: C, type: 'REFUND', amount: 10, balance: 10, orderNo: cancelledOrders[0]?.orderNo, remark: '订单取消退款', created: at(1, 18, 40) }),
    txn({ user: byName('刘同学'), type: 'WITHDRAW', amount: 20, balance: 0, applyNo: `WD${fmtShort(at(1, 8, 0))}002`, status: 'SUCCESS', remark: '余额提现', created: at(1, 8, 30) }),
    txn({ user: B, type: 'WITHDRAW', amount: 10, balance: 10, applyNo: `WD${fmtShort(at(0, 0, 0))}001`, status: 'PENDING', remark: '余额提现', created: at(0, 9, 30) })
  ]

  return {
    users,
    stations,
    buildings,
    orders,
    applications,
    transactions,
    txnSeq,
    /** token → userId */
    tokens: new Map(),
    /** phone → { code, expires } */
    smsCodes: new Map()
  }
}
