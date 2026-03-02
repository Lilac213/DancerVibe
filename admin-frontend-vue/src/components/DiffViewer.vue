<script setup lang="ts">
import { computed } from 'vue'
import { buildDiff } from '../utils/diff'

const props = defineProps<{
  beforeText: string
  afterText: string
}>()

const lines = computed(() => buildDiff(props.beforeText, props.afterText))
</script>

<template>
  <div class="diff-container">
    <pre class="diff-line" v-for="(line, index) in lines" :key="index" :class="line.type">
{{ line.text }}
    </pre>
  </div>
</template>

<style scoped>
.diff-container {
  background: #0b0f14;
  color: #c7d2da;
  padding: 12px;
  border-radius: 6px;
  max-height: 420px;
  overflow: auto;
}
.diff-line {
  margin: 0;
  white-space: pre-wrap;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: 12px;
}
.added {
  background: rgba(52, 211, 153, 0.2);
}
.removed {
  background: rgba(248, 113, 113, 0.2);
}
</style>
