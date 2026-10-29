import type { EngineShot, ShotError } from '@/composables/useImportEngine'

// What a screenshot's card says about its reading: `busy` while a reading
// worker has it, `done` once it is read and its card asks nothing more.
export interface ShotStatusView {
  text: string
  tone: 'plain' | 'busy' | 'warn' | 'error' | 'done'
}

type Translate = (key: string, vars?: Record<string, string | number>) => string

const SHOT_ERROR_TEXT: Record<ShotError, string> = {
  'too-small': 'app.import-failed-small',
  unsupported: 'app.import-failed-unsupported',
  references: 'app.import-failed-references',
  worker: 'app.import-failed-references',
  read: 'app.import-failed-unsupported',
}

// A card's line until its shot is read, or why it could not be; null once read.
export const unreadStatus = (shot: EngineShot, t: Translate): ShotStatusView | null => {
  if (shot.status === 'waiting') return { text: t('app.import-waiting'), tone: 'plain' }
  if (shot.status === 'reading') return { text: t('app.import-reading'), tone: 'busy' }
  if (shot.status === 'failed') {
    return { text: t(SHOT_ERROR_TEXT[shot.error ?? 'unsupported']), tone: 'error' }
  }
  return null
}

// A read card's line: what its screenshot gave, then how many things on it the
// review still asks about, in amber until there are none.
export const readStatus = (parts: string[], toCheck: number, t: Translate): ShotStatusView =>
  toCheck
    ? { text: [...parts, t('app.import-to-review', { count: toCheck })].join(' · '), tone: 'warn' }
    : { text: parts.join(' · '), tone: 'done' }
