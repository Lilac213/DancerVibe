import axios, { AxiosError } from 'axios'
import type { AxiosInstance, AxiosRequestConfig } from 'axios'
import { notifyError } from './notify'

type RetryConfig = AxiosRequestConfig & { __retryCount?: number }

interface ApiResponse {
  fallback?: string
  [key: string]: any
}

const baseURL = import.meta.env.VITE_API_BASE_URL || ''
const adminToken = import.meta.env.VITE_ADMIN_TOKEN || ''

export const http: AxiosInstance = axios.create({
  baseURL,
  timeout: 10000 // 增加超时时间到10秒
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
  async (error: AxiosError<ApiResponse>) => {
    const config = error.config as RetryConfig
    const isNetworkError = !error.response
    const status = error.response?.status || 0
    const shouldRetry = isNetworkError || (status >= 500 && status < 600)

    if (!navigator.onLine) {
      notifyError('网络不可用，请检查连接')
      return Promise.reject(error)
    }

    // 处理降级响应
    if (error.response?.data?.fallback) {
      console.warn('API降级处理:', error.response.data.fallback)
      // 允许降级数据通过，不显示错误通知
      return Promise.resolve({
        data: error.response.data,
        status: error.response.status,
        statusText: error.response.statusText,
        headers: error.response.headers,
        config: error.config
      })
    }

    if (shouldRetry) {
      config.__retryCount = config.__retryCount || 0
      if (config.__retryCount < 2) {
        config.__retryCount += 1
        const delay = 500 * Math.pow(2, config.__retryCount - 1) // 增加重试延迟
        await new Promise((resolve) => setTimeout(resolve, delay))
        return http(config)
      }
    }

    if (status === 401) notifyError('未授权或登录失效')
    else if (status === 403) {
      // 403可能是降级响应，不显示错误
      if (!error.response?.data?.fallback) {
        notifyError('无权限访问该资源')
      }
    }
    else if (status === 404) notifyError('资源不存在')
    else if (status >= 500) {
      // 500错误可能是降级响应，不显示错误
      if (!error.response?.data?.fallback) {
        notifyError('服务繁忙，请稍后重试')
      }
    }
    else notifyError('网络错误，请稍后重试')

    return Promise.reject(error)
  }
)

// 创建专用的统计服务实例，更长的超时时间
export const statsHttp: AxiosInstance = axios.create({
  baseURL,
  timeout: 15000 // 统计查询可能需要更长时间
})

statsHttp.interceptors.request.use((config) => {
  if (adminToken) {
    config.headers = config.headers || {}
    config.headers['x-admin-token'] = adminToken
  }
  return config
})

statsHttp.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiResponse>) => {
    // 统计服务降级处理
    if (error.response?.data?.fallback) {
      console.warn('统计服务降级处理')
      return Promise.resolve({
        data: error.response.data,
        status: error.response.status,
        statusText: error.response.statusText,
        headers: error.response.headers,
        config: error.config
      })
    }
    
    return Promise.reject(error)
  }
)