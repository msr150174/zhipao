import axios from 'axios'
import { ElMessage } from 'element-plus'
import router from '@/router'

const request = axios.create({
  baseURL: '/api',
  timeout: 15000
})

// 请求拦截：自动带 token
request.interceptors.request.use((config) => {
  const token = localStorage.getItem('zhipao_admin_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// 响应拦截：★ 拆信封（HTTP 状态码永远 200，业务成败看 body.code）
request.interceptors.response.use(
  (response) => {
    const body = response.data

    if (body.code !== 200) {
      // 401 / 403 → 清除 token 跳登录
      if (body.code === 401 || body.code === 403) {
        localStorage.removeItem('zhipao_admin_token')
        ElMessage.error(body.msg || '登录已失效')
        router.push('/login')
        return Promise.reject(new Error(body.msg))
      }

      ElMessage.error(body.msg || '请求失败')
      return Promise.reject(new Error(body.msg))
    }

    // ★ 成功时直接返回业务数据
    return body.data
  },
  (error) => {
    ElMessage.error('网络异常，请检查后端是否启动')
    return Promise.reject(error)
  }
)

export default request
