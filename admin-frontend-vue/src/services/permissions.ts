const PERMISSIONS_KEY = 'permissions'

const parsePermissions = (value: string | null) => {
  if (!value) return []
  return value.split(',').map((v) => v.trim()).filter(Boolean)
}

export const getPermissions = () => {
  const envValue = import.meta.env.VITE_PERMISSIONS
  const localValue = localStorage.getItem(PERMISSIONS_KEY)
  return envValue ? parsePermissions(envValue) : parsePermissions(localValue)
}

export const setPermissions = (list: string[]) => {
  localStorage.setItem(PERMISSIONS_KEY, list.join(','))
}

export const hasPermission = (code: string) => {
  const perms = getPermissions()
  if (!code) return true
  if (!perms.length) return true
  return perms.includes(code)
}
