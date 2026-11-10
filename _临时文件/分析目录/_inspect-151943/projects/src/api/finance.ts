import request from './request'
import type { PageResult, TransactionItem, WithdrawalItem, WithdrawalReviewResult } from '@/types'

/** 全局流水（★ 返回下划线字段名） */
export function getTransactions(params: { type?: string; keyword?: string; page: number; pageSize: number }) {
  return request.get<PageResult<TransactionItem>, PageResult<TransactionItem>>('/admin/transactions', { params })
}

/** 提现申请列表（★ 返回下划线字段名，额外含 user_balance） */
export function getWithdrawals(params: { status?: string; page: number; pageSize: number }) {
  return request.get<PageResult<WithdrawalItem>, PageResult<WithdrawalItem>>('/admin/withdrawals', { params })
}

/** 审核提现：pass=false 时系统自动把金额退回用户余额 */
export function reviewWithdrawal(id: number, pass: boolean, reason: string) {
  return request.post<WithdrawalReviewResult, WithdrawalReviewResult>(`/admin/withdrawals/${id}/review`, { pass, reason })
}
