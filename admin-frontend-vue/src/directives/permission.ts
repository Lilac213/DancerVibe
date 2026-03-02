import type { Directive } from 'vue'
import { hasPermission } from '../services/permissions'

export const permissionDirective: Directive = {
  mounted(el, binding) {
    const code = binding.value as string
    if (!hasPermission(code)) {
      el.parentNode?.removeChild(el)
    }
  }
}
