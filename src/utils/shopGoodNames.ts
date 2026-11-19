/* The names of the Honor Duel shop's products in the site's languages. They
 * load apart from the mode's catalog, which the Arena page fetches on first
 * use, because the Trial list's card headings show with the page. */

import type { AppLocale, LocaleData } from '@/lib/types/i18n'
import { byStem } from './fileStem'
import { formatDisplayName } from './nameFormatting'

const names = byStem(
  import.meta.glob<LocaleData>('@/locales/hd/shop/*.json', { eager: true, import: 'default' }),
)

export const goodName = (name: string, locale: AppLocale): string =>
  names[name]?.[locale] || formatDisplayName(name)
