/* The names of the Honor Duel shop's products in the site's languages. They
 * load apart from the mode's catalog, which the Arena page fetches on first
 * use, because the Trial list's card headings show with the page. */

import type { AppLocale, LocaleData } from '@/lib/types/i18n'
import { fileStem } from './fileStem'
import { formatDisplayName } from './nameFormatting'

const names: Record<string, LocaleData> = Object.fromEntries(
  Object.entries(
    import.meta.glob<LocaleData>('@/locales/hd/shop/*.json', { eager: true, import: 'default' }),
  ).map(([path, value]) => [fileStem(path), value]),
)

export const goodName = (name: string, locale: AppLocale): string =>
  names[name]?.[locale] || formatDisplayName(name)
