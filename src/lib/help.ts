// Relative import: vite.config.ts loads this file without the `@` alias.

import type { AppLocale } from './types/i18n.ts'

export const helpPath = (locale: AppLocale): string => `/${locale}/help`
