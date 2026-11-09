/* `stargazer.flags`, the one item holding every "has this happened" flag as a
 * date. A flag that is retired leaves FLAG_NAMES, and the next write drops its
 * entry from the browser. */

import { readStorage, writeStorage } from '@/utils/storage'

const FLAGS_KEY = 'stargazer.flags'

const FLAG_NAMES = ['whatsNew', 'skillLocaleHint', 'moved'] as const

export type FlagName = (typeof FLAG_NAMES)[number]

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

const readFlags = (): Partial<Record<FlagName, string>> => {
  const raw = readStorage(FLAGS_KEY)
  if (raw === null) return {}
  let stored: unknown
  try {
    stored = JSON.parse(raw)
  } catch {
    return {}
  }
  if (!stored || typeof stored !== 'object') return {}
  const flags: Partial<Record<FlagName, string>> = {}
  for (const name of FLAG_NAMES) {
    const value = (stored as Record<string, unknown>)[name]
    if (typeof value === 'string' && DATE_RE.test(value)) flags[name] = value
  }
  return flags
}

/** Today in the visitor's time zone, as a flag stores it. */
export function today(): string {
  const now = new Date()
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** A flag's date, or null while it is unset. */
export const readFlag = (name: FlagName): string | null => readFlags()[name] ?? null

export const writeFlag = (name: FlagName, date: string = today()): boolean =>
  writeStorage(FLAGS_KEY, JSON.stringify({ ...readFlags(), [name]: date }))
