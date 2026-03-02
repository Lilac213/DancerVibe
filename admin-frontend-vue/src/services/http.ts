import axios, { AxiosError } from 'axios'
import type { AxiosInstance, AxiosRequestConfig } from 'axios'
import { notifyError } from './notify'

type RetryConfig = AxiosRequestConfig & { __retryCount?: number }

const baseURL = import.meta.env.VITE_API_BASE_URL || ''
const adminToken = import.meta.env.VITE_ADMIN_TOKEN || ''

export const http: AxiosInstance = axios.create({
  baseURL,
  timeout: 3000
})

http.interceptors.request.use((config) => {
  if (adminToken) {
    config.headers = config.headers || {}
    config.headers['x-admin-token'] = adminToken
  }
  const method = (config.method || 'get').toLowerCase()
  if (['post', 'put', 'patch', 'delete'].includes(method)) {
    config.headers = config.headers || {}
    if (!config.headers['x-idempotency-key']) {
      config.headers['x-idempotency-key'] = crypto.randomUUID()
    }
  }
  return config
})

http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetryConfig
    const isNetworkError = !error.response
    const status = error.response?.status || 0
    const shouldRetry = isNetworkError || (status >= 500 && status < 600)

    if (!navigator.onLine) {
      notifyError('网络不可用，请检查连接')
      return Promise.reject(error)
    }

    if (shouldRetry) {
      config.__retryCount = config.__retryCount || 0
      if (config.__retryCount < 2) {
        config.__retryCount += 1
        const delay = 200 * Math.pow(2, config.__retryCount - 1)
        await new Promise((resolve) => setTimeout(resolve, delay))
        return http(config)
      }
    }

    if (status === 401) notifyError('未授权或登录失效')
    else if (status === 403) notifyError('无权限访问该资源')
    else if (status === 404) notifyError('资源不存在')
    else if (status >= 500) notifyError('服务繁忙，请稍后重试')
    else notifyError('网络错误，请稍后重试')

    return Promise.reject(error)
  }
)
