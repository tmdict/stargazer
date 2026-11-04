import type { PvpSeasonSummary } from '@/lib/types/pvp'

export const PVP_SEASONS: readonly PvpSeasonSummary[] = Object.values(
  import.meta.glob<PvpSeasonSummary>('@/pack/pvp/s*/summary.json', {
    eager: true,
    import: 'default',
  }),
).sort((a, b) => b.season - a.season)
