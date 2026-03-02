import { reactive } from 'vue'

type TableState = {
  pagination: {
    current: number
    pageSize: number
    total?: number
    showSizeChanger: boolean
    pageSizeOptions: string[]
  }
  filters?: Record<string, any>
  sorter?: any
}

const readState = (key: string) => {
  const raw = localStorage.getItem(key)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

const writeState = (key: string, value: any) => {
  localStorage.setItem(key, JSON.stringify(value))
}

export const useTableState = (key: string) => {
  const cache = readState(key)
  const state = reactive<TableState>({
    pagination: {
      current: cache?.pagination?.current || 1,
      pageSize: cache?.pagination?.pageSize || 20,
      total: cache?.pagination?.total,
      showSizeChanger: true,
      pageSizeOptions: ['20', '50', '100']
    },
    filters: cache?.filters || {},
    sorter: cache?.sorter || {}
  })

  const onChange = (pagination: any, filters: any, sorter: any) => {
    state.pagination.current = pagination.current
    state.pagination.pageSize = pagination.pageSize
    state.filters = filters
    state.sorter = sorter
    writeState(key, {
      pagination: state.pagination,
      filters: state.filters,
      sorter: state.sorter
    })
  }

  return { state, onChange }
}
