<script setup lang="ts">
import { computed, ref } from 'vue'

type RuleNode = {
  id: string
  field: string
  op: string
  value: string
}

const rules = ref<RuleNode[]>([
  { id: crypto.randomUUID(), field: 'course', op: 'contains', value: '' }
])

const addRule = () => {
  rules.value.push({ id: crypto.randomUUID(), field: '', op: 'equals', value: '' })
}

const removeRule = (id: string) => {
  rules.value = rules.value.filter((item) => item.id !== id)
}

const moveUp = (index: number) => {
  if (index === 0) return
  const list = [...rules.value]
  const [item] = list.splice(index, 1)
  if (item) list.splice(index - 1, 0, item)
  rules.value = list
}

const moveDown = (index: number) => {
  if (index === rules.value.length - 1) return
  const list = [...rules.value]
  const [item] = list.splice(index, 1)
  if (item) list.splice(index + 1, 0, item)
  rules.value = list
}

const preview = computed(() => JSON.stringify({ nodes: rules.value }, null, 2))
</script>

<template>
  <a-card title="规则设计器">
    <a-space direction="vertical" style="width: 100%">
      <a-table
        :data-source="rules"
        row-key="id"
        :pagination="false"
        :columns="[
          { title: '字段', dataIndex: 'field', key: 'field' },
          { title: '操作符', dataIndex: 'op', key: 'op' },
          { title: '值', dataIndex: 'value', key: 'value' },
          { title: '动作', key: 'action' }
        ]"
      >
        <template #bodyCell="{ column, record, index }">
          <template v-if="column.key === 'field'">
            <a-input v-model:value="record.field" placeholder="字段名" />
          </template>
          <template v-else-if="column.key === 'op'">
            <a-select v-model:value="record.op" style="width: 120px">
              <a-select-option value="equals">equals</a-select-option>
              <a-select-option value="contains">contains</a-select-option>
              <a-select-option value="regex">regex</a-select-option>
            </a-select>
          </template>
          <template v-else-if="column.key === 'value'">
            <a-input v-model:value="record.value" placeholder="值" />
          </template>
          <template v-else-if="column.key === 'action'">
            <a-space>
              <a-button size="small" @click="moveUp(index)">上移</a-button>
              <a-button size="small" @click="moveDown(index)">下移</a-button>
              <a-button size="small" danger @click="removeRule(record.id)">删除</a-button>
            </a-space>
          </template>
        </template>
      </a-table>
      <a-button type="dashed" @click="addRule">新增规则</a-button>
      <a-card title="规则预览">
        <a-textarea :rows="10" :value="preview" readonly />
      </a-card>
    </a-space>
  </a-card>
</template>
