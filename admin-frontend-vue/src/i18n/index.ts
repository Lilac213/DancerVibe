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
    }
  }
}

export const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  fallbackLocale: 'zh-CN',
  messages
})
