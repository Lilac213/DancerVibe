<script setup lang="ts">
import { computed, ref } from 'vue'
import { message } from 'ant-design-vue'
import { http } from '../services/http'

const props = defineProps<{
  rules: any[]
}>()

const inputJson = ref('{\n  "course": "HipHop"\n}')
const output = ref('')
const result = ref<any | null>(null)
const running = ref(false)
const selectedRuleId = ref('')

const ruleOptions = computed(() =>
  (props.rules || []).map((rule) => ({
    value: rule.id,
    label: `${rule.name || 'rule'} v${rule.version || ''}`
  }))
)

const runTest = async () => {
  running.value = true
  try {
    if (!selectedRuleId.value) {
      message.warning('请选择规则')
      return
    }
    try {
      JSON.parse(inputJson.value)
    } catch {
      message.error('输入 JSON 无效')
      output.value = ''
      return
    }
    const res = await http.post('/api/admin/rules/test', {
      ruleId: selectedRuleId.value,
      input: inputJson.value
    })
    result.value = res.data || null
    output.value = JSON.stringify(res.data || {}, null, 2)
    message.success('测试已完成')
  } catch (err: any) {
    const msg = err?.response?.data?.error || err?.message || '测试失败'
    result.value = null
    message.error(msg)
  } finally {
    running.value = false
  }
}
</script>

<template>
  <a-card title="规则测试沙箱">
    <a-space style="margin-bottom: 12px">
      <a-select v-model:value="selectedRuleId" style="width: 260px" placeholder="选择规则">
        <a-select-option v-for="item in ruleOptions" :key="item.value" :value="item.value">
          {{ item.label }}
        </a-select-option>
      </a-select>
    </a-space>
    <a-row gutter="12">
      <a-col :span="12">
        <div style="margin-bottom: 8px">输入样例</div>
        <a-textarea v-model:value="inputJson" :rows="12" />
      </a-col>
      <a-col :span="12">
        <div style="margin-bottom: 8px">输出结果</div>
        <a-space direction="vertical" style="width: 100%">
          <a-textarea :rows="6" :value="output" readonly />
          <div v-if="result" style="padding-top: 4px">
            <a-descriptions size="small" bordered :column="2">
              <a-descriptions-item label="状态">{{ result.status }}</a-descriptions-item>
              <a-descriptions-item label="来源">{{ result.source || 'local' }}</a-descriptions-item>
              <a-descriptions-item label="匹配">{{ result.matched ? '通过' : '失败' }}</a-descriptions-item>
              <a-descriptions-item label="缺失字段">{{ (result.missing || []).join(', ') || '-' }}</a-descriptions-item>
            </a-descriptions>
          </div>
        </a-space>
      </a-col>
    </a-row>
    <a-table
      v-if="result?.checks?.length"
      style="margin-top: 12px"
      :data-source="result.checks"
      :pagination="false"
      row-key="field"
      :columns="[
        { title: '字段', dataIndex: 'field', key: 'field' },
        { title: '操作符', dataIndex: 'op', key: 'op' },
        { title: '期望值', dataIndex: 'expected', key: 'expected' },
        { title: '实际值', dataIndex: 'actual', key: 'actual' },
        { title: '结果', dataIndex: 'passed', key: 'passed' }
      ]"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'passed'">
          <a-tag :color="record.passed ? 'green' : 'red'">{{ record.passed ? '通过' : '失败' }}</a-tag>
        </template>
      </template>
    </a-table>
    <a-button type="primary" style="margin-top: 12px" :loading="running" @click="runTest">运行测试</a-button>
  </a-card>
</template>
