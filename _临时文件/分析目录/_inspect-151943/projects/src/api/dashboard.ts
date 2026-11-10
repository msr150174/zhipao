import request from './request'
import type { DashboardData } from '@/types'

/** 数据看板 */
export function getDashboard() {
  return request.get<DashboardData, DashboardData>('/admin/dashboard')
}
