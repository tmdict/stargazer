/* Relative "updated" stamp for saved-team cards, in the chrome locale
 * (coarsest unit: weeks). The formatter is cached per locale: the label runs
 * for every card on each re-render, and construction is the expensive part. */

import { computed } from 'vue'

import { useI18nStore } from '@/stores/i18n'

const UPDATED_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['minute', 60],
  ['hour', 3600],
  ['day', 86400],
  ['week', 604800],
]

export function useUpdatedLabel(): (updatedAt: number) => string {
  const i18n = useI18nStore()

  const formatter = computed(
    () => new Intl.RelativeTimeFormat(i18n.currentLocale, { numeric: 'auto' }),
  )

  return (updatedAt: number): string => {
    // 0 = record predates timestamps (validation's fallback); no stamp beats
    // "52 weeks ago".
    if (updatedAt === 0) return ''
    const seconds = Math.round((updatedAt - Date.now()) / 1000)
    const rtf = formatter.value
    if (-seconds < 60) return i18n.t('app.updated', { time: rtf.format(0, 'minute') })
    for (let i = UPDATED_UNITS.length - 1; i >= 0; i--) {
      const [unit, size] = UPDATED_UNITS[i]!
      if (-seconds >= size || i === 0) {
        return i18n.t('app.updated', { time: rtf.format(Math.ceil(seconds / size), unit) })
      }
    }
    return ''
  }
}
