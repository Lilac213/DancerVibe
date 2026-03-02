import { notification } from 'ant-design-vue'

export const notifyError = (message: string) => {
  notification.error({
    message: '请求失败',
    description: message,
    placement: 'bottomRight',
    duration: 2
  })
}
