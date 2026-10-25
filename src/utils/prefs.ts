/* `stargazer.prefs`, the device preferences key. Each field has one owner
 * (Grid Info, the theme), and a write replaces only its own field. */

import { readStorage, writeStorage } from '@/utils/storage'

export const PREFS_KEY = 'stargazer.prefs'

// The stored object, or null when it is missing or unreadable.
export const readPrefs = (): Record<string, unknown> | null => {
  const raw = readStorage(PREFS_KEY)
  if (raw === null) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

export const writePref = (field: 'gridInfo' | 'theme', value: unknown): void => {
  writeStorage(PREFS_KEY, JSON.stringify({ ...readPrefs(), [field]: value }))
}
