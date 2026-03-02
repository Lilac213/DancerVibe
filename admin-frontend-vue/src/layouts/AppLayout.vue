<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '../stores/app'
import {
  AppstoreOutlined,
  FileSearchOutlined,
  RobotOutlined,
  CheckSquareOutlined,
  ProfileOutlined,
  SyncOutlined,
  DashboardOutlined
} from '@ant-design/icons-vue'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const appStore = useAppStore()

onMounted(() => {
  document.documentElement.setAttribute('data-theme', appStore.theme)
})

const selectedKeys = computed(() => [route.path])
const menuItems = computed(() => [
  { key: '/templates', label: t('menu.templates'), icon: AppstoreOutlined },
  { key: '/ocr-tasks', label: t('menu.ocrTasks'), icon: RobotOutlined },
  { key: '/ocr-results', label: t('menu.ocrResults'), icon: FileSearchOutlined },
  { key: '/audit', label: t('menu.audit'), icon: CheckSquareOutlined },
  { key: '/dictionary', label: t('menu.dictionary'), icon: ProfileOutlined },
  { key: '/mapping-rules', label: t('menu.mapping'), icon: SyncOutlined },
  { key: '/quality', label: t('menu.quality'), icon: DashboardOutlined }
])

const onMenuClick = ({ key }: { key: string }) => {
  router.push(key)
}
</script>

<template>
  <a-layout class="layout-root">
    <a-layout-sider breakpoint="lg" collapsed-width="0">
      <div class="logo">DancerVibe</div>
      <a-menu
        :selected-keys="selectedKeys"
        mode="inline"
        :items="menuItems"
        @click="onMenuClick"
      />
    </a-layout-sider>
    <a-layout>
      <a-layout-header class="layout-header">
        <div class="header-right">
          <a-select
            size="small"
            :value="appStore.locale"
            style="width: 120px"
            @change="appStore.setLocale"
          >
            <a-select-option value="zh-CN">中文</a-select-option>
            <a-select-option value="en-US">English</a-select-option>
          </a-select>
          <a-switch
            size="small"
            :checked="appStore.theme === 'dark'"
            @change="appStore.toggleTheme"
          />
        </div>
      </a-layout-header>
      <a-layout-content class="layout-content">
        <router-view />
      </a-layout-content>
    </a-layout>
  </a-layout>
</template>

<style scoped>
.layout-root {
  min-height: 100vh;
}
.logo {
  height: 48px;
  margin: 16px;
  color: #fff;
  font-weight: 600;
  font-size: 18px;
}
.layout-header {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  background: transparent;
  padding: 0 16px;
}
.layout-content {
  padding: 16px;
}
.header-right {
  display: flex;
  gap: 12px;
  align-items: center;
}
</style>
