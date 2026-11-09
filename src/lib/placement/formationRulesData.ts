/* What the placement engine is tuned with, for the Formation engine rules page,
 * taken from the PvP data file once per build (scripts/packModule.ts) so the
 * page loads neither the file nor its decoder. */

import { decodeSlData } from '../pvp/data/codec'
import type { SlData } from '../pvp/data/types'

export type FormationRulesData = SlData['placement']

export async function formationRulesData(
  bytes: Uint8Array<ArrayBuffer>,
): Promise<FormationRulesData> {
  return (await decodeSlData(bytes)).placement
}
