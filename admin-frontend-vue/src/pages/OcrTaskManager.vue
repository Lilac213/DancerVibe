<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { http } from '../services/http'
import { useTableState } from '../composables/useTableState'

const loading = ref(false)
const tasks = ref<any[]>([])
const templates = ref<any[]>([])
const createOpen = ref(false)
const fileList = ref<any[]>([])
const templateId = ref<string | undefined>()
const { state, onChange } = useTableState('table:ocr-tasks')

const columns = [
  { title: 'ID', dataIndex: 'id', key: 'id' },
  { title: 'Status', dataIndex: 'status', key: 'status' },
  { title: 'Template', dataIndex: 'template_id', key: 'template_id' },
  { title: 'Confidence', dataIndex: 'confidence_score', key: 'confidence_score' },
  { title: 'Created', dataIndex: 'created_at', key: 'created_at' }
]

const loadTasks = async () => {
  loading.value = true
  try {
    const res = await http.get('/api/ocr/tasks')
    tasks.value = res.data || []
  } finally {
    loading.value = false
  }
}

const loadTemplates = async () => {
  const res = await http.get('/api/templates')
  templates.value = res.data || []
}

const onCreate = async () => {
  if (!fileList.value.length) return
  const formData = new FormData()
  formData.append('file', fileList.value[0].originFileObj)
  if (templateId.value) formData.append('template_id', templateId.value)
  await http.post('/api/ocr/tasks', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
  createOpen.value = false
  fileList.value = []
  templateId.value = undefined
  await loadTasks()
}

onMounted(() => {
  loadTasks()
  loadTemplates()
})
</script>

<template>
  <a-card title="OCR任务管理">
    <template #extra>
      <a-button v-permission="'ocr:create'" type="primary" @click="createOpen = true">新建任务</a-button>
    </template>
    <a-table
      :loading="loading"
      :columns="columns"
      :data-source="tasks"
      row-key="id"
      :pagination="state.pagination"
      @change="onChange"
    />
  </a-card>

  <a-modal v-model:open="createOpen" title="创建OCR任务" @ok="onCreate">
    <a-upload
      v-model:file-list="fileList"
      :before-upload="() => false"
      :max-count="1"
    >
      <a-button>选择图片</a-button>
    </a-upload>
    <a-select v-model:value="templateId" style="width: 100%; margin-top: 16px" allow-clear placeholder="选择模板（可选）">
      <a-select-option v-for="item in templates" :key="item.id" :value="item.id">
        {{ item.template_name }}
      </a-select-option>
    </a-select>
  </a-modal>
</template>
