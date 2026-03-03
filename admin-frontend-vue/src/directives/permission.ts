import type { Directive } from 'vue'
import { hasPermission } from '../services/permissions'

export const permissionDirective: Directive = {
  mounted(el, binding) {
    const { value: permission } = binding
    if (permission && !hasPermission(permission)) {
      el.style.display = 'none'
    }
  },
  updated(el, binding) {
    const { value: permission } = binding
    if (permission && !hasPermission(permission)) {
      el.style.display = 'none'
    } else {
      el.style.display = ''
    }
  }
}