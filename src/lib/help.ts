// Relative import: vite.config.ts loads this file without the `@` alias.

import type { AppLocale } from './types/i18n.ts'

// A Help section the app links to: a section id in every Help content file.
export type HelpSection = 'teams' | 'rosters' | 'maps'

export const helpPath = (locale: AppLocale, section?: HelpSection): string =>
  section ? `/${locale}/help#${section}` : `/${locale}/help`
