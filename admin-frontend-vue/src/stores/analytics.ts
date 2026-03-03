import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface ConversionMetrics {
  pageViews: number
  buttonClicks: Record<string, number>
  navigationClicks: Record<string, number>
  timeOnPage: number
  bounceRate: number
  conversionRate: number
}

export interface UserBehavior {
  sessionId: string
  userId?: string
  page: string
  actions: Array<{
    type: 'click' | 'hover' | 'scroll' | 'input'
    element: string
    timestamp: number
    data?: any
  }>
  startTime: number
  endTime?: number
}

export const useAnalyticsStore = defineStore('analytics', () => {
  const metrics = ref<ConversionMetrics>({
    pageViews: 0,
    buttonClicks: {},
    navigationClicks: {},
    timeOnPage: 0,
    bounceRate: 0,
    conversionRate: 0
  })

  const userBehaviors = ref<UserBehavior[]>([])
  const currentSession = ref<UserBehavior | null>(null)
  const heatmapData = ref<Record<string, number>>({})

  // 计算关键指标
  const topActions = computed(() => {
    const allActions = [...Object.entries(metrics.value.buttonClicks), ...Object.entries(metrics.value.navigationClicks)]
    return allActions.sort((a, b) => (b[1] as number) - (a[1] as number)).slice(0, 5)
  })

  // 计算转化率漏斗
  const conversionFunnel = computed(() => {
    const funnel = [
      { step: '页面访问', count: metrics.value.pageViews, rate: 100 },
      { step: '快速操作点击', count: Object.values(metrics.value.buttonClicks).reduce((a, b) => a + b, 0), rate: 0 },
      { step: '功能页面访问', count: metrics.value.navigationClicks['/templates'] || 0, rate: 0 },
      { step: '任务完成', count: metrics.value.conversionRate * 100, rate: 0 }
    ]

    // 计算转化率，避免除以零和数组越界
    for (let i = 1; i < funnel.length; i++) {
      const prevStep = funnel[i - 1]
      const currentStep = funnel[i]
      if (prevStep && currentStep && prevStep.count > 0) {
        currentStep.rate = (currentStep.count / prevStep.count) * 100
      } else if (currentStep) {
        currentStep.rate = 0
      }
    }

    return funnel
  })

  // 初始化会话
  function startSession(page: string, userId?: string) {
    const sessionId = generateSessionId()
    currentSession.value = {
      sessionId,
      userId,
      page,
      actions: [],
      startTime: Date.now()
    }
    
    // 增加页面浏览量
    metrics.value.pageViews++
    
    // 开始监听用户行为
    startBehaviorTracking()
  }

  // 结束会话
  function endSession() {
    if (currentSession.value) {
      currentSession.value.endTime = Date.now()
      userBehaviors.value.push(currentSession.value)
      
      // 计算页面停留时间
      const duration = currentSession.value.endTime - currentSession.value.startTime
      metrics.value.timeOnPage = duration
      
      currentSession.value = null
    }
    
    stopBehaviorTracking()
  }

  // 跟踪点击事件
  function trackClick(element: string, type: 'button' | 'navigation' = 'button') {
    // 记录到当前会话
    if (currentSession.value) {
      currentSession.value.actions.push({
        type: 'click',
        element,
        timestamp: Date.now()
      })
    }

    // 更新指标
    if (type === 'button') {
      metrics.value.buttonClicks[element] = (metrics.value.buttonClicks[element] || 0) + 1
    } else {
      metrics.value.navigationClicks[element] = (metrics.value.navigationClicks[element] || 0) + 1
    }

    // 更新热力图数据
    heatmapData.value[element] = (heatmapData.value[element] || 0) + 1
  }

  // 跟踪转化事件
  function trackConversion(event: string, value?: number) {
    // 这里可以发送转化数据到后端
    console.log('Conversion tracked:', event, value)
    
    // 更新转化率
    if (event === 'task_completed') {
      metrics.value.conversionRate = (metrics.value.conversionRate || 0) + 1
    }
  }

  // 行为跟踪
  let behaviorTrackingInterval: number | null = null

  function startBehaviorTracking() {
    // 监听滚动事件
    const handleScroll = () => {
      if (currentSession.value) {
        currentSession.value.actions.push({
          type: 'scroll',
          element: 'window',
          timestamp: Date.now(),
          data: {
            scrollY: window.scrollY,
            scrollX: window.scrollX
          }
        })
      }
    }

    // 监听鼠标移动（简化版热力图）
    const handleMouseMove = (e: MouseEvent) => {
      const element = document.elementFromPoint(e.clientX, e.clientY)
      if (element) {
        const selector = getElementSelector(element)
        heatmapData.value[selector] = (heatmapData.value[selector] || 0) + 0.1
      }
    }

    window.addEventListener('scroll', handleScroll)
    window.addEventListener('mousemove', handleMouseMove)

    // 定期记录行为
    behaviorTrackingInterval = window.setInterval(() => {
      if (currentSession.value) {
        // 记录当前页面状态
        currentSession.value.actions.push({
          type: 'input',
          element: 'page_state',
          timestamp: Date.now(),
          data: {
            url: window.location.href,
            title: document.title
          }
        })
      }
    }, 10000) // 每10秒记录一次

    // 清理函数
    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('mousemove', handleMouseMove)
      if (behaviorTrackingInterval) {
        clearInterval(behaviorTrackingInterval)
      }
    }
  }

  function stopBehaviorTracking() {
    if (behaviorTrackingInterval) {
      clearInterval(behaviorTrackingInterval)
      behaviorTrackingInterval = null
    }
  }

  // 获取元素选择器
  function getElementSelector(element: Element): string {
    if (element.id) {
      return `#${element.id}`
    }
    
    if (element.className) {
      return `.${element.className.split(' ').join('.')}`
    }
    
    return element.tagName.toLowerCase()
  }

  // 生成会话ID
  function generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  // 获取优化建议
  function getOptimizationSuggestions() {
    const suggestions = []

    // 分析点击率
    const totalClicks = Object.values(metrics.value.buttonClicks).reduce((a, b) => a + b, 0)
    if (totalClicks > 0 && metrics.value.pageViews > 0) {
      const clickThroughRate = (totalClicks / metrics.value.pageViews) * 100
      if (clickThroughRate < 10) {
        suggestions.push({
          type: 'conversion',
          priority: 'high',
          title: '点击率偏低',
          description: `当前点击率为 ${clickThroughRate.toFixed(1)}%，建议优化按钮文案和视觉层次`,
          recommendation: '使用更吸引人的按钮文案，增加视觉权重'
        })
      }
    }

    // 分析页面停留时间
    if (metrics.value.timeOnPage < 30000) { // 30秒
      suggestions.push({
        type: 'engagement',
        priority: 'medium',
        title: '页面停留时间较短',
        description: '用户平均停留时间不足30秒，内容可能不够吸引人',
        recommendation: '增加更多有价值的内容，改善信息架构'
      })
    }

    // 分析热力图数据
    const topElements = Object.entries(heatmapData.value)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)

    if (topElements.length > 0) {
      const topElement = topElements[0]
      if (topElement) {
        const [element, clicks] = topElement
        suggestions.push({
          type: 'layout',
          priority: 'low',
          title: '热点区域分析',
          description: `用户最关注 ${element} 区域，点击次数: ${Math.floor(clicks)}`,
          recommendation: '考虑将重要功能放置在热点区域附近'
        })
      }
    }

    return suggestions
  }

  // 导出报告数据
  function exportReport() {
    const report = {
      timestamp: Date.now(),
      metrics: metrics.value,
      conversionFunnel: conversionFunnel.value,
      topActions: topActions.value,
      suggestions: getOptimizationSuggestions(),
      userBehaviors: userBehaviors.value.slice(-100) // 最近100个会话
    }

    return report
  }

  return {
    metrics,
    userBehaviors,
    currentSession,
    heatmapData,
    topActions,
    conversionFunnel,
    
    // 方法
    startSession,
    endSession,
    trackClick,
    trackConversion,
    getOptimizationSuggestions,
    exportReport
  }
})