<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { http } from '../services/http'
import { useTableState } from '../composables/useTableState'

const loading = ref(false)
const stats = ref<any>({})
const { state, onChange } = useTableState('table:quality')

const loadStats = async () => {
  loading.value = true
  try {
    const res = await http.get('/api/admin/stats')
    stats.value = res.data || {}
  } finally {
    loading.value = false
  }
}

onMounted(loadStats)
</script>

<template>
  <a-card title="质量监控" :loading="loading">
    <a-row gutter="16">
      <a-col :span="6">
        <a-statistic title="总舞室" :value="stats.totalStudios || 0" />
      </a-col>
      <a-col :span="6">
        <a-statistic title="已完成" :value="stats.completed || 0" />
      </a-col>
      <a-col :span="6">
        <a-statistic title="待处理" :value="stats.pending || 0" />
      </a-col>
      <a-col :span="6">
        <a-statistic title="失败数" :value="stats.failures?.length || 0" />
      </a-col>
    </a-row>
    <a-table
      style="margin-top: 16px"
      :data-source="stats.failures || []"
      row-key="id"
      :pagination="state.pagination"
      @change="onChange"
      :columns="[
        { title: 'Studio', dataIndex: 'studio', key: 'studio' },
        { title: 'Branch', dataIndex: 'branch', key: 'branch' },
        { title: 'Status', dataIndex: 'status', key: 'status' }
      ]"
    />
  </a-card>
</template>
