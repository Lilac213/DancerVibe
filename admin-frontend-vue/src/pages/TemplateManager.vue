<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { http } from '../services/http'
import { useTableState } from '../composables/useTableState'
import DiffViewer from '../components/DiffViewer.vue'
import { message } from 'ant-design-vue'
import { 
  ReloadOutlined, 
  SearchOutlined,
  HistoryOutlined,
  DiffOutlined,
  EditOutlined
} from '@ant-design/icons-vue'

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
const searchQuery = ref('')

const columns = [
  { title: '编码', dataIndex: 'template_code', key: 'template_code', width: 150 },
  { title: '模板名称', dataIndex: 'template_name', key: 'template_name', width: 200 },
  { title: '关联工作室', dataIndex: 'studio', key: 'studio' },
  { title: '类型', dataIndex: 'layout_type', key: 'layout_type', width: 120 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 100 },
  { title: '操作', key: 'action', width: 200 }
]

const loadTemplates = async () => {
  loading.value = true
  try {
    const res = await http.get('/api/templates')
    templates.value = res.data || []
  } catch (error) {
    console.error('Failed to load templates:', error)
    message.error('加载模板失败')
  } finally {
    loading.value = false
  }
}

const openConfig = async (record: any) => {
  try {
    const res = await http.get(`/api/templates/${record.id}`)
    activeTemplate.value = res.data
    currentConfig.value = JSON.stringify(res.data?.latest_config || {}, null, 2)
    draftConfig.value = currentConfig.value
    configOpen.value = true
  } catch (error) {
    message.error('加载配置失败')
  }
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
  try {
    await http.put(`/api/templates/${activeTemplate.value.id}/config`, { config_json: payload })
    message.success('已发布配置')
    configOpen.value = false
    await loadTemplates()
  } catch (error) {
    message.error('发布失败')
  }
}

const refreshTemplates = () => {
  loadTemplates()
  message.success('刷新成功')
}

// Computed
const filteredTemplates = computed(() => {
  if (!searchQuery.value) return templates.value
  const q = searchQuery.value.toLowerCase()
  return templates.value.filter(t => 
    String(t.template_name || '').toLowerCase().includes(q) || 
    String(t.template_code || '').toLowerCase().includes(q) ||
    String(t.studio || '').toLowerCase().includes(q)
  )
})

onMounted(loadTemplates)
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <div class="header-title">
        <h1>爬虫模版管理</h1>
        <p class="header-subtitle">管理各个工作室的课表爬取规则和配置模版</p>
      </div>
      <div class="header-actions">
        <a-button @click="refreshTemplates">
          <template #icon><ReloadOutlined /></template>
          刷新
        </a-button>
      </div>
    </div>

    <div class="content-wrapper">
      <a-card :bordered="false" class="main-card">
        <div class="table-toolbar">
          <div class="filters">
            <a-input 
              v-model:value="searchQuery" 
              placeholder="搜索模板名称、编码或工作室..." 
              style="width: 300px"
              allow-clear
            >
              <template #prefix><SearchOutlined /></template>
            </a-input>
          </div>
        </div>

        <a-table
          :loading="loading"
          :columns="columns"
          :data-source="filteredTemplates"
          row-key="id"
          :pagination="state.pagination"
          @change="onChange"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'template_code'">
              <span class="code-text">{{ record.template_code }}</span>
            </template>
            
            <template v-if="column.key === 'layout_type'">
              <a-tag color="blue">{{ record.layout_type }}</a-tag>
            </template>

            <template v-if="column.key === 'status'">
              <a-badge 
                :status="record.status === 'active' ? 'success' : 'default'" 
                :text="record.status === 'active' ? '启用' : '禁用'" 
              />
            </template>

            <template v-if="column.key === 'action'">
              <a-space divider type="vertical">
                <a-tooltip title="编辑配置">
                  <a-button type="link" size="small" @click="openConfig(record)">
                    <template #icon><EditOutlined /></template>
                  </a-button>
                </a-tooltip>
                <a-tooltip title="配置对比">
                  <a-button type="link" size="small" @click="openDiffFor(record)">
                    <template #icon><DiffOutlined /></template>
                  </a-button>
                </a-tooltip>
                <a-tooltip title="历史版本">
                  <a-button type="link" size="small" @click="openHistory(record)">
                    <template #icon><HistoryOutlined /></template>
                  </a-button>
                </a-tooltip>
              </a-space>
            </template>
          </template>
        </a-table>
      </a-card>
    </div>

    <!-- Config Modal -->
    <a-modal
      v-model:open="configOpen"
      title="编辑配置"
      width="800px"
      @ok="publishConfig"
      okText="发布更新"
    >
      <div class="config-editor">
        <a-textarea
          v-model:value="draftConfig"
          :rows="20"
          style="font-family: monospace"
        />
      </div>
    </a-modal>

    <!-- Diff Modal -->
    <a-modal
      v-model:open="diffOpen"
      title="配置差异对比"
      width="1000px"
      :footer="null"
    >
      <DiffViewer
        :before-text="currentConfig"
        :after-text="draftConfig"
        language="json"
      />
    </a-modal>

    <!-- History Modal -->
    <a-modal
      v-model:open="historyOpen"
      title="历史版本对比"
      width="1000px"
      :footer="null"
    >
      <div class="history-controls">
        <a-space>
          <a-select v-model:value="leftVersion" style="width: 200px">
            <a-select-option v-for="v in versions" :key="v.id" :value="v.id">
              {{ v.label }}
            </a-select-option>
          </a-select>
          <span>VS</span>
          <a-select v-model:value="rightVersion" style="width: 200px">
            <a-select-option v-for="v in versions" :key="v.id" :value="v.id">
              {{ v.label }}
            </a-select-option>
          </a-select>
        </a-space>
      </div>
      <div class="diff-container">
        <DiffViewer
          :before-text="getVersionContent(leftVersion)"
          :after-text="getVersionContent(rightVersion)"
          language="json"
        />
      </div>
    </a-modal>
  </div>
</template>

<style scoped lang="less">
.page-container {
  padding: 24px;
  background-color: #f0f2f5;
  min-height: 100vh;

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;

    .header-title {
      h1 {
        font-size: 24px;
        font-weight: 600;
        color: #1a1a1a;
        margin-bottom: 8px;
      }
      .header-subtitle {
        color: #666;
        font-size: 14px;
      }
    }
  }

  .content-wrapper {
    .main-card {
      border-radius: 8px;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);

      .table-toolbar {
        margin-bottom: 16px;
      }
    }
  }
}

.code-text {
  font-family: monospace;
  color: #1890ff;
}

.history-controls {
  margin-bottom: 16px;
  padding: 12px;
  background: #f5f5f5;
  border-radius: 4px;
}

.diff-container {
  height: 500px;
  overflow: auto;
}
</style>