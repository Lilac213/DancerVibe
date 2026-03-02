export type DiffLine = {
  type: 'added' | 'removed' | 'unchanged'
  text: string
}

export const buildDiff = (beforeText: string, afterText: string): DiffLine[] => {
  const beforeLines = beforeText.split('\n')
  const afterLines = afterText.split('\n')
  const beforeSet = new Set(beforeLines)
  const afterSet = new Set(afterLines)
  const lines: DiffLine[] = []

  for (const line of beforeLines) {
    if (!afterSet.has(line)) {
      lines.push({ type: 'removed', text: line })
    } else {
      lines.push({ type: 'unchanged', text: line })
    }
  }

  for (const line of afterLines) {
    if (!beforeSet.has(line)) {
      lines.push({ type: 'added', text: line })
    }
  }

  return lines
}
