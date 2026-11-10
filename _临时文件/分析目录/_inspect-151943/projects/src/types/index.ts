// ==================== 通用 ====================

/** 后端统一响应信封（HTTP 状态码永远 200，业务成败看 body.code） */
export interface ApiEnvelope<T = unknown> {
  code: number
  msg: string
  data: T
}

/** 分页响应 */
export interface PageResult<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

// ==================== 用户 / 登录 ====================

export interface UserInfo {
  id: string
  nickname: string
  phone: string
  creditScore: number
  balance: number
  income: number
  isRunner: boolean
  isAdmin: boolean
  realNameVerified: boolean
}

export interface SmsSendResult {
  sent: boolean
  devMode: boolean
  /** 演示后端额外返回，真实后端无此字段 */
  devCode?: string
}

export interface LoginResult {
  token: string
  user: UserInfo
}

/** 管理员视角用户列表项 */
export interface AdminUserItem extends UserInfo {
  studentNo: string | null
  status: number // 1 正常 0 冻结
  statusText: string
  createTime: string
}

export interface AdminUserStats {
  total: number
  published: number
  taken: number
  completed: number
  earned: number
}

export interface AdminUserDetail extends AdminUserItem {
  openid: string | null
  avatarUrl: string | null
  stats: AdminUserStats
}

export interface UserQuery {
  keyword?: string
  minCredit?: number
  maxCredit?: number
  isRunner?: boolean
  status?: number
  page: number
  pageSize: number
}

// ==================== 数据看板 ====================

export interface DashboardOrders {
  total: number
  today_total: number
  waiting_accept: number
  in_progress: number
  delivered: number
  completed: number
  cancelled: number
  appealing: number
  total_amount: number
  today_amount: number
}

export interface DashboardUsers {
  total: number
  today_new: number
  runners: number
  frozen: number
  low_credit: number
  total_balance: number
}

export interface DashboardPending {
  runnerApplications: number
  appealingOrders: number
  withdrawals: number
  overdueOrders: number
}

export interface TrendPoint {
  day: string
  order_count: number
  amount: number
}

export interface DashboardData {
  orders: DashboardOrders
  users: DashboardUsers
  pending: DashboardPending
  trend: TrendPoint[]
}

// ==================== 订单 ====================

export type OrderStatus =
  | 'CREATED'
  | 'WAITING_ACCEPT'
  | 'ACCEPTED'
  | 'PICKING'
  | 'DELIVERING'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'APPEALING'

export interface OrderItem {
  id: string
  orderNo: string
  status: OrderStatus
  statusText: string
  deliveryType: number
  deliveryTypeText: string
  packageSizeText: string
  stationName: string
  buildingName: string
  roomNo: string
  reward: number
  urgent: boolean
  publisherId: string
  publisherName: string
  runnerId: string | null
  runnerName: string | null
  createTime: string
  deadline: string
}

/** 订单详情（管理员视角，取件码明文） */
export interface OrderDetail extends OrderItem {
  packageSize: number
  stationId: string
  pickupCode: string
  shopNo: string | null
  stationLng: number | null
  stationLat: number | null
  buildingId: string
  buildingLng: number | null
  buildingLat: number | null
  itemCount: number
  remark: string
  distanceMeters: number | null
  publisherPhone: string
  runnerCredit: number | null
  cancelReason: string | null
  acceptTime: string | null
  completeTime: string | null
  expired: boolean
}

export interface OrderQuery {
  status?: string
  deliveryType?: number
  keyword?: string
  startDate?: string
  endDate?: string
  page: number
  pageSize: number
}

export interface OrderActionResult {
  ok: boolean
  orderNo: string
  message: string
}

// ==================== 跑腿员申请 ====================

export interface RunnerApplication {
  id: number
  userId: string
  realName: string
  studentNo: string
  phone: string
  campus: string
  idCardImg: string
  intro: string
  status: number // 0 待审 1 通过 2 驳回
  statusText: string
  rejectReason: string | null
  createTime: string
  reviewedAt: string | null
}

export interface RunnerReviewResult {
  ok: boolean
  userId: string
  message: string
}

// ==================== 资金（★ 下划线字段名，按原字段解析） ====================

export type TransactionType = 'INCOME' | 'EXPENSE' | 'WITHDRAW' | 'REFUND'

export interface TransactionItem {
  id: number
  user_id: string
  type: TransactionType
  amount: number
  balance: number
  order_no: string | null
  apply_no: string | null
  status: string
  remark: string
  created_at: string
  nickname: string
  phone: string
}

export interface WithdrawalItem extends TransactionItem {
  user_balance: number
}

export interface WithdrawalReviewResult {
  ok: boolean
  message: string
}
