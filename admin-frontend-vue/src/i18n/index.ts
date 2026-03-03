import { createI18n } from 'vue-i18n'

const messages = {
  'zh-CN': {
    menu: {
      templates: '爬虫模版管理',
      ocrTasks: 'OCR任务管理',
      ocrResults: '解析结果查看',
      audit: '人工审核台',
      dictionary: '码值表管理',
      mapping: '映射规则管理',
      quality: '质量监控'
    },
    dashboard: {
      welcome: '欢迎使用 DancerVibe 管理系统',
      description: '高效管理舞蹈课程数据，提升运营效率',
      totalStudios: '合作舞室',
      todayCourses: '今日课程',
      activeTasks: '活跃任务',
      quickActions: '快速操作',
      recentActivity: '最近活动',
      systemStatus: '系统状态',
      manageTemplates: '管理模板',
      manageTemplatesDesc: '创建和管理爬虫模板，配置解析规则',
      ocrTasks: 'OCR任务',
      ocrTasksDesc: '管理图片识别任务，监控处理进度',
      auditWorkbench: '审核工作台',
      auditWorkbenchDesc: '审核和修正识别结果，确保数据质量',
      dictionary: '码值管理',
      dictionaryDesc: '管理系统码值表，维护数据字典',
      mappingRules: '映射规则',
      mappingRulesDesc: '配置字段映射规则，优化数据解析',
      qualityMonitor: '质量监控',
      qualityMonitorDesc: '监控系统运行状态，分析数据质量',
      database: '数据库',
      ocrService: 'OCR服务',
      crawlerService: '爬虫服务'
    },
    common: {
      healthy: '正常',
      error: '错误',
      refresh: '刷新',
      refreshSuccess: '刷新成功'
    }
  },
  'en-US': {
    menu: {
      templates: 'Crawler Templates',
      ocrTasks: 'OCR Tasks',
      ocrResults: 'Parsing Results',
      audit: 'Audit Workbench',
      dictionary: 'Code Dictionary',
      mapping: 'Mapping Rules',
      quality: 'Quality Monitor'
    },
    dashboard: {
      welcome: 'Welcome to DancerVibe Management System',
      description: 'Efficiently manage dance course data and improve operational efficiency',
      totalStudios: 'Partner Studios',
      todayCourses: "Today's Courses",
      activeTasks: 'Active Tasks',
      quickActions: 'Quick Actions',
      recentActivity: 'Recent Activity',
      systemStatus: 'System Status',
      manageTemplates: 'Manage Templates',
      manageTemplatesDesc: 'Create and manage crawler templates, configure parsing rules',
      ocrTasks: 'OCR Tasks',
      ocrTasksDesc: 'Manage image recognition tasks and monitor processing progress',
      auditWorkbench: 'Audit Workbench',
      auditWorkbenchDesc: 'Review and correct recognition results to ensure data quality',
      dictionary: 'Code Management',
      dictionaryDesc: 'Manage system code tables and maintain data dictionaries',
      mappingRules: 'Mapping Rules',
      mappingRulesDesc: 'Configure field mapping rules to optimize data parsing',
      qualityMonitor: 'Quality Monitor',
      qualityMonitorDesc: 'Monitor system operation status and analyze data quality',
      database: 'Database',
      ocrService: 'OCR Service',
      crawlerService: 'Crawler Service'
    },
    common: {
      healthy: 'Healthy',
      error: 'Error',
      refresh: 'Refresh',
      refreshSuccess: 'Refresh successful'
    }
  }
}

export const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  fallbackLocale: 'zh-CN',
  messages
})
