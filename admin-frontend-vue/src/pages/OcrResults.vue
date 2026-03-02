<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { http } from '../services/http'
import { useTableState } from '../composables/useTableState'

const loading = ref(false)
const results = ref<any[]>([])
const { state, onChange } = useTableState('table:ocr-results')

const columns = [
  { title: 'Task ID', dataIndex: 'task_id', key: 'task_id' },
  { title: 'Weekday', dataIndex: 'weekday', key: 'weekday' },
  { title: 'Time', dataIndex: 'time_range', key: 'time_range' },
  { title: 'Course', dataIndex: 'course', key: 'course' },
  { title: 'Teacher', dataIndex: 'teacher', key: 'teacher' },
  { title: 'Style', dataIndex: 'style', key: 'style' }
]

const loadResults = async () => {
  loading.value = true
  try {
    const res = await http.get('/api/ocr/tasks')
    const tasks = res.data || []
    const parsed: any[] = []
    for (const task of tasks) {
      const detail = await http.get(`/api/ocr/tasks/${task.id}/results`)
      const structured = detail.data?.structured || []
      structured.forEach((item: any) => {
        parsed.push({
          task_id: task.id,
          weekday: item.weekday,
          time_range: `${item.start_time || ''}-${item.end_time || ''}`,
          course: item.course,
          teacher: item.teacher,
          style: item.style
        })
      })
    }
    results.value = parsed
  } finally {
    loading.value = false
  }
}

onMounted(loadResults)
</script>

<template>
  <a-card title="解析结果查看">
    <a-table
      :loading="loading"
      :columns="columns"
      :data-source="results"
      row-key="task_id"
      :pagination="state.pagination"
      @change="onChange"
    />
  </a-card>
</template>
