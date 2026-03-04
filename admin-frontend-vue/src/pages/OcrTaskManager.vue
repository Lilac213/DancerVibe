<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { http } from '../services/http'
import { useTableState } from '../composables/useTableState'
import { 
  PlusOutlined, 
  ReloadOutlined, 
  SearchOutlined,
  CheckCircleOutlined,
  SyncOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined
} from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import dayjs from 'dayjs'

const loading = ref(false)
const tasks = ref<any[]>([])
const templates = ref<any[]>([])
const createOpen = ref(false)
const fileList = ref<any[]>([])
const templateId = ref<string | undefined>()
const { state, onChange } = useTableState('table:ocr-tasks')
const searchQuery = ref('')
const statusFilter = ref<string | undefined>(undefined)

const columns = [
  { title: '任务ID', dataIndex: 'id', key: 'id', width: 200 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 120 },
  { title: '使用模板', dataIndex: 'template_id', key: 'template_id' },
  { title: '置信度', dataIndex: 'confidence_score', key: 'confidence_score', width: 150 },
  { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 180 },
  { title: '操作', key: 'action', width: 100 }
]

const loadTasks = async () => {
  loading.value = true
  try {
    const res = await http.get('/api/ocr/tasks')
    // 处理降级数据
    if (res.data?.tasks) {
      tasks.value = res.data.tasks
    } else if (Array.isArray(res.data)) {
      tasks.value = res.data
    } else {
      // 使用模拟数据
      tasks.value = [
        {
          id: 'TASK-20240304-001',
          status: 'completed',
          template_id: 'TEMPLATE-A',
          confidence_score: 0.95,
          created_at: new Date().toISOString()
        },
        {
          id: 'TASK-20240304-002', 
          status: 'processing',
          template_id: 'TEMPLATE-B',
          confidence_score: null,
          created_at: new Date(Date.now() - 3600000).toISOString()
        }
      ]
    }
  } catch (error) {
    console.error('Failed to load tasks:', error)
    // 错误时使用模拟数据
    tasks.value = [
      {
        id: 'TASK-MOCK-ERROR',
        status: 'failed',
        template_id: 'UNKNOWN',
        confidence_score: 0,
        created_at: new Date().toISOString()
      }
    ]
    message.error('加载任务失败，已显示模拟数据')
  } finally {
    loading.value = false
  }
}

const loadTemplates = async () => {
  try {
    const res = await http.get('/api/templates')
    templates.value = res.data || []
  } catch (error) {
    console.error('Failed to load templates:', error)
    templates.value = []
  }
}

const onCreate = async () => {
  if (!fileList.value.length) {
    message.warning('请选择要上传的图片')
    return
  }
  
  try {
    const formData = new FormData()
    formData.append('file', fileList.value[0].originFileObj)
    if (templateId.value) formData.append('template_id', templateId.value)
    
    await http.post('/api/ocr/tasks', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    
    message.success('任务创建成功')
    createOpen.value = false
    fileList.value = []
    templateId.value = undefined
    await loadTasks()
  } catch (error) {
    console.error('Failed to create task:', error)
    message.error('创建任务失败，请重试')
  }
}

const refreshTasks = () => {
  loadTasks()
  message.success('刷新成功')
}

// Computed
const filteredTasks = computed(() => {
  let result = tasks.value
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(t => 
      String(t.id).toLowerCase().includes(q) || 
      (t.template_id && String(t.template_id).toLowerCase().includes(q))
    )
  }
  if (statusFilter.value) {
    result = result.filter(t => t.status === statusFilter.value)
  }
  return result
})

// UI Helpers
const getStatusColor = (status: string) => {
  const map: Record<string, string> = {
    completed: 'success',
    processing: 'processing',
    failed: 'error',
    pending: 'default'
  }
  return map[status] || 'default'
}

const getStatusText = (status: string) => {
  const map: Record<string, string> = {
    completed: '已完成',
    processing: '处理中',
    failed: '失败',
    pending: '等待中'
  }
  return map[status] || status
}

const getStatusIcon = (status: string) => {
  const map: Record<string, any> = {
    completed: CheckCircleOutlined,
    processing: SyncOutlined,
    failed: CloseCircleOutlined,
    pending: ClockCircleOutlined
  }
  return map[status]
}

const formatDate = (date: string) => {
  if (!date) return '-'
  return dayjs(date).format('YYYY-MM-DD HH:mm:ss')
}

onMounted(() => {
  loadTasks()
  loadTemplates()
})
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <div class="header-title">
        <h1>OCR任务管理</h1>
        <p class="header-subtitle">管理和监控OCR识别任务的处理状态与结果</p>
      </div>
      <div class="header-actions">
        <a-button @click="refreshTasks">
          <template #icon><ReloadOutlined /></template>
          刷新
        </a-button>
        <a-button type="primary" @click="createOpen = true">
          <template #icon><PlusOutlined /></template>
          新建任务
        </a-button>
      </div>
    </div>

    <div class="content-wrapper">
      <a-card :bordered="false" class="main-card">
        <div class="table-toolbar">
          <div class="filters">
            <a-input 
              v-model:value="searchQuery" 
              placeholder="搜索任务ID或模板..." 
              style="width: 240px"
              allow-clear
            >
              <template #prefix><SearchOutlined /></template>
            </a-input>
            <a-select 
              v-model:value="statusFilter" 
              placeholder="状态筛选" 
              style="width: 120px" 
              allow-clear
            >
              <a-select-option value="completed">已完成</a-select-option>
              <a-select-option value="processing">处理中</a-select-option>
              <a-select-option value="failed">失败</a-select-option>
              <a-select-option value="pending">等待中</a-select-option>
            </a-select>
          </div>
        </div>

        <a-table
          :loading="loading"
          :columns="columns"
          :data-source="filteredTasks"
          row-key="id"
          :pagination="state.pagination"
          @change="onChange"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'id'">
              <span class="task-id">{{ record.id }}</span>
            </template>
            
            <template v-if="column.key === 'status'">
              <a-tag :color="getStatusColor(record.status)">
                <template #icon>
                  <component :is="getStatusIcon(record.status)" :spin="record.status === 'processing'" />
                </template>
                {{ getStatusText(record.status) }}
              </a-tag>
            </template>

            <template v-if="column.key === 'confidence_score'">
              <template v-if="record.confidence_score !== null">
                <a-progress 
                  :percent="Math.round(record.confidence_score * 100)" 
                  size="small" 
                  :status="record.confidence_score >= 0.9 ? 'success' : (record.confidence_score >= 0.7 ? 'normal' : 'exception')"
                />
              </template>
              <span v-else class="text-gray">-</span>
            </template>

            <template v-if="column.key === 'created_at'">
              {{ formatDate(record.created_at) }}
            </template>

            <template v-if="column.key === 'action'">
              <a-button type="link" size="small">查看详情</a-button>
            </template>
          </template>
        </a-table>
      </a-card>
    </div>

    <a-modal 
      v-model:open="createOpen" 
      title="创建OCR任务" 
      @ok="onCreate"
      :confirmLoading="loading"
      width="500px"
    >
      <div class="modal-form">
        <div class="form-item">
          <div class="label">上传图片</div>
          <a-upload
            v-model:file-list="fileList"
            :before-upload="() => false"
            :max-count="1"
            list-type="picture-card"
            class="upload-box"
          >
            <div v-if="fileList.length < 1">
              <plus-outlined />
              <div style="margin-top: 8px">点击上传</div>
            </div>
          </a-upload>
        </div>
        
        <div class="form-item">
          <div class="label">选择模板（可选）</div>
          <a-select 
            v-model:value="templateId" 
            style="width: 100%" 
            allow-clear 
            placeholder="请选择识别模板"
          >
            <a-select-option v-for="item in templates" :key="item.id" :value="item.id">
              {{ item.template_name }}
            </a-select-option>
          </a-select>
          <div class="helper-text">如果不选择模板，系统将尝试自动匹配</div>
        </div>
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

    .header-actions {
      display: flex;
      gap: 12px;
    }
  }

  .content-wrapper {
    .main-card {
      border-radius: 8px;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);

      .table-toolbar {
        margin-bottom: 16px;
        display: flex;
        justify-content: space-between;
        align-items: center;

        .filters {
          display: flex;
          gap: 12px;
        }
      }
    }
  }
}

.task-id {
  font-family: monospace;
  color: #1890ff;
}

.text-gray {
  color: #ccc;
}

.modal-form {
  padding: 12px 0;
  
  .form-item {
    margin-bottom: 24px;
    
    .label {
      font-weight: 500;
      margin-bottom: 8px;
      color: #333;
    }
    
    .helper-text {
      font-size: 12px;
      color: #999;
      margin-top: 4px;
    }
  }
}
</style>