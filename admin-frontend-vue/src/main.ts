import { createApp } from 'vue'
import App from './App.vue'
import './style.css'
import 'ant-design-vue/dist/antd.css'
import { createPinia } from 'pinia'
import { router } from './router'
import { i18n } from './i18n'
import Antd from 'ant-design-vue'
import { permissionDirective } from './directives/permission'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.use(i18n)
app.use(Antd)
app.directive('permission', permissionDirective)
app.mount('#app')
