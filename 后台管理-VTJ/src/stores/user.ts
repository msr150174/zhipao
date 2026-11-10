import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { UserInfo } from '@/types'
import * as authApi from '@/api/auth'

export const TOKEN_KEY = 'zhipao_admin_token'

/** 登录成功但非管理员的错误标记 */
export const NO_ADMIN_ERROR = 'NO_ADMIN'

export const useUserStore = defineStore('user', () => {
  const token = ref<string>(localStorage.getItem(TOKEN_KEY) || '')
  const userInfo = ref<UserInfo | null>(null)

  /** 手机号登录：★ 必须校验 isAdmin，非管理员拒绝进入后台 */
  async function login(phone: string, code: string): Promise<UserInfo> {
    const data = await authApi.smsLogin({ phone, code })
    if (!data.user.isAdmin) {
      throw new Error(NO_ADMIN_ERROR)
    }
    token.value = data.token
    userInfo.value = data.user
    localStorage.setItem(TOKEN_KEY, data.token)
    return data.user
  }

  /** 拉取当前用户（刷新页面后恢复昵称等信息） */
  async function fetchMe(): Promise<UserInfo> {
    const me = await authApi.getMe()
    userInfo.value = me
    return me
  }

  /** 登出：无论接口成败都清理本地状态 */
  async function logout(): Promise<void> {
    try {
      await authApi.logout()
    } catch {
      // 忽略登出接口异常
    }
    token.value = ''
    userInfo.value = null
    localStorage.removeItem(TOKEN_KEY)
  }

  return { token, userInfo, login, fetchMe, logout }
})
