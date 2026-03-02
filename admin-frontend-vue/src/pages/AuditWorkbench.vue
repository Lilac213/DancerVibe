<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { http } from '../services/http'
import { useTableState } from '../composables/useTableState'

const loading = ref(false)
const tasks = ref<any[]>([])
const status = ref('pending')
const { state, onChange } = useTableState('table:audit')

const columns = [
  { title: 'Task ID', dataIndex: 'id', key: 'id' },
  { title: 'Type', dataIndex: 'task_type', key: 'task_type' },
  { title: 'Priority', dataIndex: 'priority', key: 'priority' },
  { title: 'Confidence', dataIndex: 'confidence_score', key: 'confidence_score' }
]

const loadTasks = async () => {
  loading.value = true
  try {
    const res = await http.get('/api/crawler/audit/tasks', { params: { status: status.value } })
    tasks.value = res.data || []
  } finally {
    loading.value = false
  }
}

onMounted(loadTasks)
</script>

<template>
  <a-card title="人工审核台">
    <a-space style="margin-bottom: 12px">
      <a-select v-model:value="status" style="width: 160px" @change="loadTasks">
        <a-select-option value="pending">Pending</a-select-option>
        <a-select-option value="approved">Approved</a-select-option>
        <a-select-option value="rejected">Rejected</a-select-option>
      </a-select>
    </a-space>
    <a-table
      :loading="loading"
      :columns="columns"
      :data-source="tasks"
      row-key="id"
      :pagination="state.pagination"
      @change="onChange"
    />
  </a-card>
</template>
