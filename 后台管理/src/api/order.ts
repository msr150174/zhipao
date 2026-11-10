import request from './request'
import type { OrderActionResult, OrderDetail, OrderItem, OrderQuery, PageResult } from '@/types'

/** 订单列表 */
export function getOrders(params: OrderQuery) {
  return request.get<PageResult<OrderItem>, PageResult<OrderItem>>('/admin/orders', { params })
}

/** 订单详情（管理员视角，取件码明文） */
export function getOrderDetail(id: string) {
  return request.get<OrderDetail, OrderDetail>(`/admin/orders/${id}`)
}

/** 强制取消订单 */
export function cancelOrder(id: string, reason: string) {
  return request.post<OrderActionResult, OrderActionResult>(`/admin/orders/${id}/cancel`, { reason })
}

/** 强制完成订单（仅 DELIVERED 状态可用） */
export function completeOrder(id: string, reason: string) {
  return request.post<OrderActionResult, OrderActionResult>(`/admin/orders/${id}/complete`, { reason })
}
