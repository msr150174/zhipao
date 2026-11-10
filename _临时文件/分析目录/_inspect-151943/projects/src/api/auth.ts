import request from './request'
import type { LoginResult, SmsSendResult, UserInfo } from '@/types'

/** 发送验证码（开发模式不发短信，验证码见服务端日志） */
export function sendSmsCode(phone: string) {
  return request.post<SmsSendResult, SmsSendResult>('/auth/sms/send', { phone })
}

/** 手机号验证码登录 */
export function smsLogin(data: { phone: string; code: string }) {
  return request.post<LoginResult, LoginResult>('/auth/sms/login', data)
}

/** 获取当前登录用户 */
export function getMe() {
  return request.get<UserInfo, UserInfo>('/auth/me')
}

/** 登出 */
export function logout() {
  return request.post<null, null>('/auth/logout')
}
