import request from './request'
import type { PageResult, RunnerApplication, RunnerReviewResult } from '@/types'

/** 跑腿员申请列表：status 0=待审 1=通过 2=驳回，不传=全部 */
export function getRunnerApplications(params: { status?: number; page: number; pageSize: number }) {
  return request.get<PageResult<RunnerApplication>, PageResult<RunnerApplication>>('/admin/runner-applications', { params })
}

/** 审核通过 */
export function approveRunner(id: number) {
  return request.post<RunnerReviewResult, RunnerReviewResult>(`/admin/runner-applications/${id}/approve`)
}

/** 审核驳回：reason 必填，最长 200 字 */
export function rejectRunner(id: number, reason: string) {
  return request.post<RunnerReviewResult, RunnerReviewResult>(`/admin/runner-applications/${id}/reject`, { reason })
}
