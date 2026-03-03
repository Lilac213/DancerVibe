import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { router } from './router'
import { i18n } from './i18n'
import App from './App.vue'
import './style.css'

// 引入 Ant Design Vue
import Antd from 'ant-design-vue'

// 引入权限指令
import { permissionDirective } from './directives/permission'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(i18n)
app.use(Antd)

// 注册权限指令
app.directive('permission', permissionDirective)

app.mount('#app')