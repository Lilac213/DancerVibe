<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { http } from '../services/http'
import { useTableState } from '../composables/useTableState'
import DiffViewer from '../components/DiffViewer.vue'
import { message } from 'ant-design-vue'

const loading = ref(false)
const templates = ref<any[]>([])
const { state, onChange } = useTableState('table:templates')
const configOpen = ref(false)
const diffOpen = ref(false)
const historyOpen = ref(false)
const activeTemplate = ref<any | null>(null)
const currentConfig = ref('')
const draftConfig = ref('')
const versions = ref<{ id: string; label: string; content: string }[]>([])
const leftVersion = ref('')
const rightVersion = ref('')

const columns = [
  { title: 'ID', dataIndex: 'template_code', key: 'template_code' },
  { title: 'Name', dataIndex: 'template_name', key: 'template_name' },
  { title: 'Studio', dataIndex: 'studio', key: 'studio' },
  { title: 'Type', dataIndex: 'layout_type', key: 'layout_type' },
  { title: 'Status', dataIndex: 'status', key: 'status' },
  { title: 'Action', key: 'action' }
]

const loadTemplates = async () => {
  loading.value = true
  try {
    const res = await http.get('/api/templates')
    templates.value = res.data || []
  } finally {
    loading.value = false
  }
}

onMounted(loadTemplates)

const openConfig = async (record: any) => {
  const res = await http.get(`/api/templates/${record.id}`)
  activeTemplate.value = res.data
  currentConfig.value = JSON.stringify(res.data?.latest_config || {}, null, 2)
  draftConfig.value = currentConfig.value
  configOpen.value = true
}

const openDiff = () => {
  diffOpen.value = true
}

const openDiffFor = async (record: any) => {
  await openConfig(record)
  diffOpen.value = true
}

const openHistory = async (record: any) => {
  await openConfig(record)
  versions.value = [
    { id: 'current', label: '当前版本', content: currentConfig.value },
    { id: 'draft', label: '草稿版本', content: draftConfig.value }
  ]
  leftVersion.value = 'current'
  rightVersion.value = 'draft'
  historyOpen.value = true
}

const getVersionContent = (id: string) => {
  return versions.value.find((item) => item.id === id)?.content || ''
}

const publishConfig = async () => {
  if (!activeTemplate.value) return
  let payload = {}
  try {
    payload = JSON.parse(draftConfig.value || '{}')
  } catch {
    message.error('JSON 格式不正确')
    return
  }
  await http.put(`/api/templates/${activeTemplate.value.id}/config`, { config_json: payload })
  message.success('已发布配置')
  configOpen.value = false
  await loadTemplates()
}
</script>

<template>
  <a-card title="爬虫模版管理">
    <a-table
      :loading="loading"
      :columns="columns"
      :data-source="templates"
      row-key="id"
      :pagination="state.pagination"
      @change="onChange"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'action'">
          <a-space>
            <a-button v-permission="'template:view'" size="small" type="link" @click="openConfig(record)">查看配置</a-button>
            <a-button v-permission="'template:diff'" size="small" type="link" @click="openDiffFor(record)">版本对比</a-button>
            <a-button v-permission="'template:history'" size="small" type="link" @click="openHistory(record)">历史版本</a-button>
            <a-button v-permission="'template:publish'" size="small" type="link" @click="openConfig(record)">一键下发</a-button>
          </a-space>
        </template>
      </template>
    </a-table>
  </a-card>

  <a-modal v-model:open="configOpen" title="模版配置" width="900px" @ok="publishConfig">
    <a-row gutter="12">
      <a-col :span="12">
        <div style="margin-bottom: 8px">当前配置</div>
        <a-textarea v-model:value="currentConfig" :rows="16" readonly />
      </a-col>
      <a-col :span="12">
        <div style="margin-bottom: 8px">待发布配置</div>
        <a-textarea v-model:value="draftConfig" :rows="16" />
      </a-col>
    </a-row>
    <template #footer>
      <a-space>
        <a-button @click="openDiff">对比</a-button>
        <a-button type="primary" @click="publishConfig">发布</a-button>
      </a-space>
    </template>
  </a-modal>

  <a-modal v-model:open="diffOpen" title="模版配置差异" width="900px" :footer="null">
    <DiffViewer :before-text="currentConfig" :after-text="draftConfig" />
  </a-modal>

  <a-modal v-model:open="historyOpen" title="模版历史版本" width="900px" :footer="null">
    <a-space style="margin-bottom: 12px">
      <a-select v-model:value="leftVersion" style="width: 160px">
        <a-select-option v-for="item in versions" :key="item.id" :value="item.id">
          {{ item.label }}
        </a-select-option>
      </a-select>
      <a-select v-model:value="rightVersion" style="width: 160px">
        <a-select-option v-for="item in versions" :key="item.id" :value="item.id">
          {{ item.label }}
        </a-select-option>
      </a-select>
    </a-space>
    <DiffViewer :before-text="getVersionContent(leftVersion)" :after-text="getVersionContent(rightVersion)" />
  </a-modal>
</template>
