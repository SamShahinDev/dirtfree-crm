/**
 * JSON diff utilities for audit logs
 * Provides before/after comparison without external dependencies
 */

export type DiffKind = 'added' | 'removed' | 'changed'

export interface DiffEntry {
  path: string
  before: any
  after: any
  kind: DiffKind
}

/**
 * Compare two JSON objects and return differences
 */
export function jsonDiff(before: any, after: any, basePath: string = ''): DiffEntry[] {
  const diffs: DiffEntry[] = []

  // Handle null/undefined cases
  if (before === null && after === null) return diffs
  if (before === undefined && after === undefined) return diffs

  if (before === null || before === undefined) {
    diffs.push({
      path: basePath || 'root',
      before,
      after,
      kind: 'added'
    })
    return diffs
  }

  if (after === null || after === undefined) {
    diffs.push({
      path: basePath || 'root',
      before,
      after,
      kind: 'removed'
    })
    return diffs
  }

  // Handle primitive types
  if (typeof before !== 'object' || typeof after !== 'object') {
    if (before !== after) {
      diffs.push({
        path: basePath || 'root',
        before,
        after,
        kind: 'changed'
      })
    }
    return diffs
  }

  // Handle arrays
  if (Array.isArray(before) && Array.isArray(after)) {
    return diffArrays(before, after, basePath)
  }

  if (Array.isArray(before) && !Array.isArray(after)) {
    diffs.push({
      path: basePath || 'root',
      before,
      after,
      kind: 'changed'
    })
    return diffs
  }

  if (!Array.isArray(before) && Array.isArray(after)) {
    diffs.push({
      path: basePath || 'root',
      before,
      after,
      kind: 'changed'
    })
    return diffs
  }

  // Handle objects
  return diffObjects(before, after, basePath)
}

/**
 * Compare two objects
 */
function diffObjects(before: Record<string, any>, after: Record<string, any>, basePath: string): DiffEntry[] {
  const diffs: DiffEntry[] = []
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)])

  for (const key of allKeys) {
    const currentPath = basePath ? `${basePath}.${key}` : key
    const beforeValue = before[key]
    const afterValue = after[key]

    if (!(key in before)) {
      // Key was added
      diffs.push({
        path: currentPath,
        before: undefined,
        after: afterValue,
        kind: 'added'
      })
    } else if (!(key in after)) {
      // Key was removed
      diffs.push({
        path: currentPath,
        before: beforeValue,
        after: undefined,
        kind: 'removed'
      })
    } else {
      // Key exists in both, check for changes
      diffs.push(...jsonDiff(beforeValue, afterValue, currentPath))
    }
  }

  return diffs
}

/**
 * Compare two arrays
 */
function diffArrays(before: any[], after: any[], basePath: string): DiffEntry[] {
  const diffs: DiffEntry[] = []

  // Simple array comparison - treats arrays as ordered lists
  const maxLength = Math.max(before.length, after.length)

  for (let i = 0; i < maxLength; i++) {
    const currentPath = `${basePath}[${i}]`
    const beforeValue = i < before.length ? before[i] : undefined
    const afterValue = i < after.length ? after[i] : undefined

    if (beforeValue === undefined) {
      // Item was added
      diffs.push({
        path: currentPath,
        before: undefined,
        after: afterValue,
        kind: 'added'
      })
    } else if (afterValue === undefined) {
      // Item was removed
      diffs.push({
        path: currentPath,
        before: beforeValue,
        after: undefined,
        kind: 'removed'
      })
    } else {
      // Compare items
      diffs.push(...jsonDiff(beforeValue, afterValue, currentPath))
    }
  }

  return diffs
}

/**
 * Format a diff entry for display
 */
export function formatDiffEntry(entry: DiffEntry): string {
  const { path, before, after, kind } = entry

  const formatValue = (value: any): string => {
    if (value === undefined) return 'undefined'
    if (value === null) return 'null'
    if (typeof value === 'string') return `"${value}"`
    if (typeof value === 'object') return JSON.stringify(value, null, 2)
    return String(value)
  }

  switch (kind) {
    case 'added':
      return `+ ${path}: ${formatValue(after)}`
    case 'removed':
      return `- ${path}: ${formatValue(before)}`
    case 'changed':
      return `~ ${path}: ${formatValue(before)} → ${formatValue(after)}`
    default:
      return `? ${path}: ${formatValue(before)} | ${formatValue(after)}`
  }
}

/**
 * Group diffs by kind for better display
 */
export function groupDiffs(diffs: DiffEntry[]): Record<DiffKind, DiffEntry[]> {
  return diffs.reduce((groups, diff) => {
    if (!groups[diff.kind]) {
      groups[diff.kind] = []
    }
    groups[diff.kind].push(diff)
    return groups
  }, {} as Record<DiffKind, DiffEntry[]>)
}

/**
 * Get summary statistics for diffs
 */
export function getDiffStats(diffs: DiffEntry[]): Record<DiffKind, number> {
  const grouped = groupDiffs(diffs)
  return {
    added: grouped.added?.length || 0,
    removed: grouped.removed?.length || 0,
    changed: grouped.changed?.length || 0
  }
}

/**
 * Check if two values are deeply equal (for optimization)
 */
export function deepEqual(a: any, b: any): boolean {
  if (a === b) return true
  if (a === null || b === null) return a === b
  if (a === undefined || b === undefined) return a === b
  if (typeof a !== typeof b) return false

  if (typeof a !== 'object') return a === b

  if (Array.isArray(a) !== Array.isArray(b)) return false

  if (Array.isArray(a)) {
    if (a.length !== b.length) return false
    return a.every((item, index) => deepEqual(item, b[index]))
  }

  const keysA = Object.keys(a)
  const keysB = Object.keys(b)
  if (keysA.length !== keysB.length) return false

  return keysA.every(key => keysB.includes(key) && deepEqual(a[key], b[key]))
}

/**
 * Simplified diff for cases where we just need to know if there are changes
 */
export function hasChanges(before: any, after: any): boolean {
  return !deepEqual(before, after)
}

/**
 * Get a text summary of changes
 */
export function getDiffSummary(diffs: DiffEntry[]): string {
  const stats = getDiffStats(diffs)
  const parts: string[] = []

  if (stats.added > 0) parts.push(`${stats.added} added`)
  if (stats.changed > 0) parts.push(`${stats.changed} changed`)
  if (stats.removed > 0) parts.push(`${stats.removed} removed`)

  if (parts.length === 0) return 'No changes'
  return parts.join(', ')
}