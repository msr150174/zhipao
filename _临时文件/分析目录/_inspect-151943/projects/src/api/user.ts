import request from './request'
import type { AdminUserDetail, AdminUserItem, PageResult, UserQuery } from '@/types'

export interface CreditAdjustResult {
  ok: boolean
  before: number
  after: number
  message: string
}

export interface SimpleActionResult {
  ok: boolean
  message: string
}

/** 用户列表 */
export function getUsers(params: UserQuery) {
  return request.get<PageResult<AdminUserItem>, PageResult<AdminUserItem>>('/admin/users', { params })
}

/** 用户详情（含订单统计） */
export function getUserDetail(id: string) {
  return request.get<AdminUserDetail, AdminUserDetail>(`/admin/users/${id}`)
}

/** 调整信用分：delta 不为 0，绝对值 ≤ 100，reason 必填，最终分值限制在 0~100 */
export function adjustCredit(id: string, delta: number, reason: string) {
  return request.post<CreditAdjustResult, CreditAdjustResult>(`/admin/users/${id}/credit`, { delta, reason })
}

/** 冻结账号 */
export function freezeUser(id: string, reason: string) {
  return request.post<SimpleActionResult, SimpleActionResult>(`/admin/users/${id}/freeze`, { reason })
}

/** 解冻账号 */
export function unfreezeUser(id: string) {
  return request.post<SimpleActionResult, SimpleActionResult>(`/admin/users/${id}/unfreeze`)
}

/** 设置 / 取消管理员 */
export function setAdmin(id: string, isAdmin: boolean) {
  return request.post<SimpleActionResult, SimpleActionResult>(`/admin/users/${id}/admin`, { isAdmin })
}
