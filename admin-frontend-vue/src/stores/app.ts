import { defineStore } from 'pinia'

type Locale = 'zh-CN' | 'en-US'
type Theme = 'light' | 'dark'

export const useAppStore = defineStore('app', {
  state: () => ({
    locale: (localStorage.getItem('locale') as Locale) || 'zh-CN',
    theme: (localStorage.getItem('theme') as Theme) || 'light'
  }),
  actions: {
    setLocale(locale: Locale) {
      this.locale = locale
      localStorage.setItem('locale', locale)
    },
    toggleTheme() {
      this.theme = this.theme === 'light' ? 'dark' : 'light'
      localStorage.setItem('theme', this.theme)
      document.documentElement.setAttribute('data-theme', this.theme)
    }
  }
})
