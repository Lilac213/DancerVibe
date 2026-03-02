<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { http } from '../services/http'
import { useTableState } from '../composables/useTableState'

const loading = ref(false)
const items = ref<any[]>([])
const category = ref('course')
const { state, onChange } = useTableState('table:dictionary')

const columns = [
  { title: 'Category', dataIndex: 'category', key: 'category' },
  { title: 'Key', dataIndex: 'key', key: 'key' },
  { title: 'Value', dataIndex: 'value', key: 'value' }
]

const loadDictionary = async () => {
  loading.value = true
  try {
    const res = await http.get(`/api/dict/${category.value}`)
    items.value = res.data || []
  } finally {
    loading.value = false
  }
}

onMounted(loadDictionary)
</script>

<template>
  <a-card title="码值表管理">
    <a-space style="margin-bottom: 12px">
      <a-select v-model:value="category" style="width: 200px" @change="loadDictionary">
        <a-select-option value="course">课程</a-select-option>
        <a-select-option value="teacher">老师</a-select-option>
        <a-select-option value="style">风格</a-select-option>
      </a-select>
    </a-space>
    <a-table
      :loading="loading"
      :columns="columns"
      :data-source="items"
      row-key="id"
      :pagination="state.pagination"
      @change="onChange"
    />
  </a-card>
</template>
