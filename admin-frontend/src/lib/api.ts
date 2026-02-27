const base = (import.meta as any).env?.VITE_API_BASE_URL || '';
export const apiUrl = (path: string) => {
  if (base) return `${base}${path}`;
  return path;
};

