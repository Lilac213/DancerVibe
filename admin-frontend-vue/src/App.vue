<script setup lang="ts">
import { computed } from 'vue'
import { ConfigProvider } from 'ant-design-vue'
import zhCN from 'ant-design-vue/es/locale/zh_CN'
import enUS from 'ant-design-vue/es/locale/en_US'
import AppLayout from './layouts/AppLayout.vue'
import { useAppStore } from './stores/app'

const appStore = useAppStore()
const antdLocale = computed(() => (appStore.locale === 'en-US' ? enUS : zhCN))
</script>

<template>
  <ConfigProvider :locale="antdLocale">
    <AppLayout />
  </ConfigProvider>
</template>
