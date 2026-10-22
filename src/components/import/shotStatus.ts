import type { ShotError } from '@/composables/useImportEngine'

// What a screenshot's card says about its reading: `done` once nothing is left
// to look at.
export interface ShotStatusView {
  text: string
  tone: 'plain' | 'warn' | 'error' | 'done'
}

// What a screenshot's card says when it could not be read.
export const SHOT_ERROR_TEXT: Record<ShotError, string> = {
  'too-small': 'app.import-failed-small',
  unsupported: 'app.import-failed-unsupported',
  references: 'app.import-failed-references',
  worker: 'app.import-failed-references',
  read: 'app.import-failed-unsupported',
}
