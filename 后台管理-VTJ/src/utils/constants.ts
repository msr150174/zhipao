// ==================== 订单 ====================

export type TagType = 'primary' | 'success' | 'info' | 'warning' | 'danger'

/** 订单状态 → el-tag type 颜色映射（契约文档 3.5） */
export const ORDER_STATUS_COLOR: Record<string, TagType> = {
  CREATED: 'info',
  WAITING_ACCEPT: 'warning',
  ACCEPTED: 'primary',
  PICKING: 'primary',
  DELIVERING: 'primary',
  DELIVERED: 'info',
  COMPLETED: 'success',
  CANCELLED: 'info',
  APPEALING: 'danger'
}

export const ORDER_STATUS_OPTIONS = [
  { label: '全部', value: '' },
  { label: '待接单', value: 'WAITING_ACCEPT' },
  { label: '已接单', value: 'ACCEPTED' },
  { label: '取件中', value: 'PICKING' },
  { label: '配送中', value: 'DELIVERING' },
  { label: '已送达待确认', value: 'DELIVERED' },
  { label: '已完成', value: 'COMPLETED' },
  { label: '已取消', value: 'CANCELLED' },
  { label: '申诉中', value: 'APPEALING' }
]

export const DELIVERY_TYPE_OPTIONS = [
  { label: '全部', value: undefined },
  { label: '取快递', value: 1 },
  { label: '取外卖', value: 2 }
]

/** 终态订单（不可再操作） */
export const FINAL_ORDER_STATUS = ['COMPLETED', 'CANCELLED']

// ==================== 用户 ====================

/** 信用分颜色规则（契约文档 3.6） */
export function creditColor(score: number): string {
  if (score >= 90) return '#67c23a' // 优秀 绿
  if (score >= 70) return '#13c2c2' // 良好 青
  if (score >= 60) return '#409eff' // 正常 蓝
  return '#f56c6c' // 受限 红
}

export const USER_RUNNER_OPTIONS = [
  { label: '全部', value: undefined },
  { label: '跑腿员', value: true },
  { label: '普通用户', value: false }
]

export const USER_STATUS_OPTIONS = [
  { label: '全部', value: undefined },
  { label: '正常', value: 1 },
  { label: '已冻结', value: 0 }
]

// ==================== 跑腿员审核 ====================

export const RUNNER_STATUS_TABS = [
  { label: '待审核', value: 0 },
  { label: '已通过', value: 1 },
  { label: '已驳回', value: 2 }
]

export const RUNNER_STATUS_COLOR: Record<number, TagType> = {
  0: 'warning',
  1: 'success',
  2: 'danger'
}

// ==================== 资金 ====================

export const TXN_TYPE_OPTIONS = [
  { label: '全部', value: '' },
  { label: '跑腿收入', value: 'INCOME' },
  { label: '发布支出', value: 'EXPENSE' },
  { label: '余额提现', value: 'WITHDRAW' },
  { label: '退款', value: 'REFUND' }
]

export const TXN_TYPE_TEXT: Record<string, string> = {
  INCOME: '跑腿收入',
  EXPENSE: '发布支出',
  WITHDRAW: '余额提现',
  REFUND: '退款'
}

export const TXN_TYPE_COLOR: Record<string, TagType> = {
  INCOME: 'success',
  EXPENSE: 'warning',
  WITHDRAW: 'primary',
  REFUND: 'danger'
}

export const WITHDRAW_STATUS_OPTIONS = [
  { label: '待审核', value: 'PENDING' },
  { label: '已通过', value: 'SUCCESS' },
  { label: '已驳回', value: 'REJECTED' },
  { label: '全部', value: '' }
]

export const WITHDRAW_STATUS_TEXT: Record<string, string> = {
  PENDING: '待审核',
  SUCCESS: '已通过',
  REJECTED: '已驳回'
}

export const WITHDRAW_STATUS_COLOR: Record<string, TagType> = {
  PENDING: 'warning',
  SUCCESS: 'success',
  REJECTED: 'danger'
}
