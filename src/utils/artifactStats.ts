import { PERCENT_STAT_KEYS, type ArtifactStatKey, type ArtifactStats } from '@/lib/types/artifact'
import type { AppLocale } from '@/lib/types/i18n'
import { loadGameLocales } from '@/utils/dataLoader'

export interface FormattedStat {
  key: ArtifactStatKey
  label: string
  value: string
}

// Shared by the hover tooltip and the info modal so stat labels/values stay
// consistent. Locale is explicit (the modal toggles locale independently of
// the global one). Percent stats render with a trailing `%`.
export function formatArtifactStats(stats: ArtifactStats, locale: AppLocale): FormattedStat[] {
  const game = loadGameLocales()
  return Object.entries(stats).flatMap(([key, value]) => {
    if (value === undefined) return []
    const k = key as ArtifactStatKey
    return [
      {
        key: k,
        label: game[k]?.[locale] ?? k,
        value: PERCENT_STAT_KEYS.has(k) ? `${value}%` : `${value}`,
      },
    ]
  })
}
