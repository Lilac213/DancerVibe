<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { http } from '../services/http'
import { useTableState } from '../composables/useTableState'
import DiffViewer from '../components/DiffViewer.vue'
import RuleDesigner from '../components/RuleDesigner.vue'
import RuleSandbox from '../components/RuleSandbox.vue'
import StatusBadge from '../components/StatusBadge.vue'
import { message } from 'ant-design-vue'
import { 
  ReloadOutlined, 
  SearchOutlined,
  DiffOutlined,
  CheckOutlined,
  BranchesOutlined,
  RocketOutlined,
  AppstoreOutlined,
  CodeOutlined,
  PlayCircleOutlined
} from '@ant-design/icons-vue'
import dayjs from 'dayjs'

const loading = ref(false)
const rules = ref<any[]>([])
const { state, onChange } = useTableState('table:mapping')
const selectedRowKeys = ref<string[]>([])
const selectedRows = ref<any[]>([])
const diffOpen = ref(false)
const diffBefore = ref('')
const diffAfter = ref('')
const grayOpen = ref(false)
const grayPercent = ref(10)
const activeRule = ref<any | null>(null)
const searchQuery = ref('')
const activeTab = ref('list')

const columns = [
  { title: '规则名称', dataIndex: 'name', key: 'name', width: 200 },
  { title: '版本', dataIndex: 'version', key: 'version', width: 100 },
  { title: '适用工作室', dataIndex: 'studio', key: 'studio' },
  { title: '分支', dataIndex: 'branch', key: 'branch', width: 120 },
  { title: '发布状态', dataIndex: 'publish_status', key: 'publish_status', width: 120 },
  { title: '灰度比例', dataIndex: 'gray_percent', key: 'gray_percent', width: 100 },
  { title: '当前版本', dataIndex: 'is_current', key: 'is_current', width: 100 },
  { title: '更新时间', dataIndex: 'created_at', key: 'created_at', width: 180 },
  { title: '操作', key: 'action', width: 180 }
]

const loadRules = async () => {
  loading.value = true
  try {
    const res = await http.get('/api/admin/rules')
    rules.value = res.data || []
  } catch (error) {
    console.error('Failed to load rules:', error)
    message.error('加载规则列表失败')
  } finally {
    loading.value = false
  }
}

const refreshRules = () => {
  loadRules()
  message.success('刷新成功')
}

const onSelectChange = (keys: string[], rows: any[]) => {
  selectedRowKeys.value = keys
  selectedRows.value = rows
}

const openDiff = () => {
  if (selectedRows.value.length !== 2) {
    message.warning('请选择两条规则进行对比')
    return
  }
  const [a, b] = selectedRows.value
  diffBefore.value = JSON.stringify(a.field_mapping || {}, null, 2)
  diffAfter.value = JSON.stringify(b.field_mapping || {}, null, 2)
  diffOpen.value = true
}

const setCurrent = async (record: any) => {
  try {
    await http.post(`/api/admin/rules/${record.id}/set-current`)
    message.success('已设为当前版本')
    await loadRules()
  } catch (error) {
    message.error('操作失败')
  }
}

const openGray = (record: any) => {
  activeRule.value = record
  grayPercent.value = 10
  grayOpen.value = true
}

const confirmGray = async () => {
  if (!activeRule.value) return
  try {
    await http.post(`/api/admin/rules/${activeRule.value.id}/gray-release`, {
      percent: grayPercent.value
    })
    grayOpen.value = false
    message.success('灰度发布已提交')
    await loadRules()
  } catch (error) {
    message.error('灰度发布失败')
  }
}

const filteredRules = computed(() => {
  if (!searchQuery.value) return rules.value
  const q = searchQuery.value.toLowerCase()
  return rules.value.filter(r => 
    String(r.name || '').toLowerCase().includes(q) || 
    String(r.studio || '').toLowerCase().includes(q)
  )
})

const formatDate = (date: string) => {
  if (!date) return '-'
  return dayjs(date).format('YYYY-MM-DD HH:mm')
}

onMounted(loadRules)
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <div class="header-title">
        <h1>映射规则管理</h1>
        <p class="header-subtitle">配置和管理不同工作室课表字段的映射转换规则</p>
      </div>
      <div class="header-actions">
        <a-button @click="refreshRules">
          <template #icon><ReloadOutlined /></template>
          刷新
        </a-button>
      </div>
    </div>

    <div class="content-wrapper">
      <a-card :bordered="false" class="main-card">
        <a-tabs v-model:activeKey="activeTab">
          <a-tab-pane key="list">
            <template #tab>
              <span><AppstoreOutlined />规则列表</span>
            </template>
            
            <div class="tab-content">
              <div class="table-toolbar">
                <div class="filters">
                  <a-input 
                    v-model:value="searchQuery" 
                    placeholder="搜索规则名称或工作室..." 
                    style="width: 300px"
                    allow-clear
                  >
                    <template #prefix><SearchOutlined /></template>
                  </a-input>
                </div>
                <div class="actions">
                  <a-button v-permission="'mapping:diff'" @click="openDiff" :disabled="selectedRowKeys.length !== 2">
                    <template #icon><DiffOutlined /></template>
                    版本对比
                  </a-button>
                </div>
              </div>

              <a-table
                :loading="loading"
                :columns="columns"
                :data-source="filteredRules"
                row-key="id"
                :pagination="state.pagination"
                @change="onChange"
                :row-selection="{ selectedRowKeys, onChange: onSelectChange }"
              >
                <template #bodyCell="{ column, record }">
                  <template v-if="column.key === 'studio'">
                    <a-tag color="blue">{{ record.studio }}</a-tag>
                  </template>

                  <template v-if="column.key === 'branch'">
                    <a-tag v-if="record.branch" :color="record.branch === 'main' ? 'green' : 'orange'">
                      <template #icon><BranchesOutlined /></template>
                      {{ record.branch }}
                    </a-tag>
                    <span v-else>-</span>
                  </template>

                  <template v-if="column.key === 'publish_status'">
                    <StatusBadge :status="record.publish_status" />
                  </template>

                  <template v-if="column.key === 'gray_percent'">
                    <span v-if="record.gray_percent">{{ record.gray_percent }}%</span>
                    <span v-else class="text-gray">-</span>
                  </template>

                  <template v-if="column.key === 'is_current'">
                    <a-tag v-if="record.is_current" color="green">
                      <template #icon><CheckOutlined /></template>
                      当前
                    </a-tag>
                  </template>

                  <template v-if="column.key === 'created_at'">
                    {{ formatDate(record.created_at) }}
                  </template>

                  <template v-if="column.key === 'action'">
                    <a-space divider type="vertical">
                      <a-tooltip title="设为当前版本" v-if="!record.is_current">
                        <a-popconfirm title="确定要将此版本设为当前版本吗？" @confirm="setCurrent(record)">
                          <a-button type="link" size="small">
                            <template #icon><CheckOutlined /></template>
                          </a-button>
                        </a-popconfirm>
                      </a-tooltip>
                      <a-tooltip title="灰度发布" v-if="record.publish_status !== 'published'">
                        <a-button type="link" size="small" @click="openGray(record)">
                          <template #icon><RocketOutlined /></template>
                        </a-button>
                      </a-tooltip>
                    </a-space>
                  </template>
                </template>
              </a-table>
            </div>
          </a-tab-pane>

          <a-tab-pane key="designer">
            <template #tab>
              <span><CodeOutlined />规则设计器</span>
            </template>
            <RuleDesigner />
          </a-tab-pane>

          <a-tab-pane key="sandbox">
            <template #tab>
              <span><PlayCircleOutlined />规则沙箱</span>
            </template>
            <RuleSandbox :rules="rules" />
          </a-tab-pane>
        </a-tabs>
      </a-card>
    </div>

    <!-- Diff Modal -->
    <a-modal
      v-model:open="diffOpen"
      title="规则差异对比"
      width="1000px"
      :footer="null"
    >
      <DiffViewer
        :before-text="diffBefore"
        :after-text="diffAfter"
      />
    </a-modal>

    <!-- Gray Release Modal -->
    <a-modal
      v-model:open="grayOpen"
      title="灰度发布配置"
      @ok="confirmGray"
    >
      <div style="padding: 24px">
        <p>设置灰度发布的流量比例：</p>
        <a-slider v-model:value="grayPercent" :min="0" :max="100" />
        <div style="text-align: center; margin-top: 8px">
          当前比例: {{ grayPercent }}%
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
  }

  .content-wrapper {
    .main-card {
      border-radius: 8px;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
      
      :deep(.ant-tabs-nav) {
        margin-bottom: 24px;
      }
    }
  }
}

.tab-content {
  .table-toolbar {
    margin-bottom: 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
}

.text-gray {
  color: #ccc;
}
</style>