// Relative import: vite.config.ts loads this file without the `@` alias.

import type { SkillLocale } from './types/i18n.ts'

export const skillPath = (locale: SkillLocale, slug: string): string => `/${locale}/skill/${slug}`
