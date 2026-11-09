/* What the placement engine is tuned with, for the Formation engine rules page
 * and the Hero lists page, taken from the PvP data file once per build
 * (scripts/packModule.ts) so neither page loads the file or its decoder. */

import { decodeSlData } from './codec'
import type { SlData } from './types'

export type FormationRulesData = SlData['placement']

export async function formationRulesData(
  bytes: Uint8Array<ArrayBuffer>,
): Promise<FormationRulesData> {
  return (await decodeSlData(bytes)).placement
}
