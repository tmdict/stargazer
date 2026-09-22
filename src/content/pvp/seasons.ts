import type { PvpSeasonSummary } from '@/lib/types/pvp'

import { S7 } from './s7/summary'

/* Finished seasons, newest first. The guide index lists every entry's report
 * and draws the counter ladder of the first. A new season is a new
 * `s<N>/summary.ts` beside its report template, added at the front. */
export const PVP_SEASONS: readonly PvpSeasonSummary[] = [S7]
