<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { http } from '../services/http'
import { useTableState } from '../composables/useTableState'
import DiffViewer from '../components/DiffViewer.vue'
import RuleDesigner from '../components/RuleDesigner.vue'
import RuleSandbox from '../components/RuleSandbox.vue'
import StatusBadge from '../components/StatusBadge.vue'
import { message } from 'ant-design-vue'

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

const columns = [
  { title: 'Name', dataIndex: 'name', key: 'name' },
  { title: 'Version', dataIndex: 'version', key: 'version' },
  { title: 'Studio', dataIndex: 'studio', key: 'studio' },
  { title: 'Branch', dataIndex: 'branch', key: 'branch' },
  { title: '发布状态', dataIndex: 'publish_status', key: 'publish_status' },
  { title: '灰度比例', dataIndex: 'gray_percent', key: 'gray_percent' },
  { title: 'Current', dataIndex: 'is_current', key: 'is_current' },
  { title: 'Updated', dataIndex: 'created_at', key: 'created_at' },
  { title: 'Action', key: 'action' }
]

const loadRules = async () => {
  loading.value = true
  try {
    const res = await http.get('/api/admin/rules')
    rules.value = res.data || []
  } finally {
    loading.value = false
  }
}

onMounted(loadRules)

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
  await http.post(`/api/admin/rules/${record.id}/set-current`)
  await loadRules()
}

const openGray = (record: any) => {
  activeRule.value = record
  grayPercent.value = 10
  grayOpen.value = true
}

const confirmGray = async () => {
  if (!activeRule.value) return
  await http.post(`/api/admin/rules/${activeRule.value.id}/gray-release`, {
    percent: grayPercent.value
  })
  grayOpen.value = false
  message.success('灰度发布已提交')
}
</script>

<template>
  <a-tabs>
    <a-tab-pane key="list" tab="规则列表">
      <a-card title="映射规则管理">
        <a-space style="margin-bottom: 12px">
          <a-button v-permission="'mapping:diff'" @click="openDiff">版本对比</a-button>
        </a-space>
        <a-table
          :loading="loading"
          :columns="columns"
          :data-source="rules"
          row-key="id"
          :pagination="state.pagination"
          @change="onChange"
          :row-selection="{ selectedRowKeys, onChange: onSelectChange }"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'is_current'">
              <a-tag v-if="record.is_current" color="green">Current</a-tag>
              <a-tag v-else>History</a-tag>
            </template>
            <template v-else-if="column.key === 'publish_status'">
              <StatusBadge :status="record.publish_status || 'history'" />
            </template>
            <template v-else-if="column.key === 'gray_percent'">
              <span>{{ record.gray_percent || 0 }}%</span>
            </template>
            <template v-else-if="column.key === 'action'">
              <a-space>
                <a-button v-permission="'mapping:publish'" size="small" type="link" @click="setCurrent(record)">发布</a-button>
                <a-button v-permission="'mapping:gray'" size="small" type="link" @click="openGray(record)">灰度</a-button>
              </a-space>
            </template>
          </template>
        </a-table>
      </a-card>
    </a-tab-pane>
    <a-tab-pane key="designer" tab="可视化设计器">
      <RuleDesigner />
    </a-tab-pane>
    <a-tab-pane key="sandbox" tab="规则测试沙箱">
      <RuleSandbox :rules="rules" />
    </a-tab-pane>
  </a-tabs>

  <a-modal v-model:open="diffOpen" title="规则版本对比" width="900px" :footer="null">
    <a-row gutter="12">
      <a-col :span="12">
        <DiffViewer :before-text="diffBefore" :after-text="diffAfter" />
      </a-col>
      <a-col :span="12">
        <DiffViewer :before-text="diffAfter" :after-text="diffBefore" />
      </a-col>
    </a-row>
  </a-modal>

  <a-modal v-model:open="grayOpen" title="灰度发布" @ok="confirmGray">
    <a-space direction="vertical" style="width: 100%">
      <div>灰度比例 (%)</div>
      <a-input-number v-model:value="grayPercent" :min="1" :max="100" style="width: 100%" />
    </a-space>
  </a-modal>
</template>
