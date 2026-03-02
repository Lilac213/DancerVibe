<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  status: string
}>()

const color = computed(() => {
  if (props.status === 'active') return 'green'
  if (props.status === 'failed') return 'red'
  if (props.status === 'pending') return 'orange'
  if (props.status === 'current') return 'green'
  if (props.status === 'gray') return 'orange'
  if (props.status === 'history') return 'default'
  return 'default'
})
</script>

<template>
  <a-tag :color="color">{{ status }}</a-tag>
</template>
