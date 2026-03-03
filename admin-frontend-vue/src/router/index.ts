import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  { path: '/', component: () => import('../pages/Dashboard.vue') },
  { path: '/templates', component: () => import('../pages/TemplateManager.vue') },
  { path: '/ocr-tasks', component: () => import('../pages/OcrTaskManager.vue') },
  { path: '/ocr-results', component: () => import('../pages/OcrResults.vue') },
  { path: '/audit', component: () => import('../pages/AuditWorkbench.vue') },
  { path: '/dictionary', component: () => import('../pages/DictionaryManager.vue') },
  { path: '/mapping-rules', component: () => import('../pages/MappingRuleManager.vue') },
  { path: '/quality', component: () => import('../pages/QualityMonitor.vue') }
]

export const router = createRouter({
  history: createWebHistory(),
  routes
})
