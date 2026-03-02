import { mount } from '@vue/test-utils'
import AppLayout from '../../src/layouts/AppLayout.vue'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createRouter, createWebHistory } from 'vue-router'

const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  messages: { 'zh-CN': { menu: { templates: '爬虫模版管理' } } }
})

const router = createRouter({
  history: createWebHistory(),
  routes: [{ path: '/templates', component: { template: '<div />' } }]
})

describe('AppLayout', () => {
  it('renders menu', async () => {
    setActivePinia(createPinia())
    router.push('/templates')
    await router.isReady()
    const wrapper = mount(AppLayout, {
      global: {
        plugins: [i18n, router],
        stubs: {
          'a-layout': { template: '<div><slot /></div>' },
          'a-layout-sider': { template: '<div><slot /></div>' },
          'a-layout-header': { template: '<div><slot /></div>' },
          'a-layout-content': { template: '<div><slot /></div>' },
          'a-menu': { template: '<div><slot /></div>' },
          'a-select': { template: '<div><slot /></div>' },
          'a-select-option': { template: '<div><slot /></div>' },
          'a-switch': { template: '<div />' }
        }
      }
    })
    expect(wrapper.text()).toContain('DancerVibe')
  })
})
