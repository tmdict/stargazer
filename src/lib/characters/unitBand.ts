// The one place a hero-band id (base, synergy or Trial) is split into its band
// and its band-local id: the hero's base id, or N * 10000 + base for a
// companion. Bounded bands, not a bare modulo, so an id above every band comes
// back unstripped and never aliases into the companion range.
import { inSynergyBand } from './synergy'
import { inTrialBand, trialBandLocal } from './trial'
import { SYNERGY_ID_OFFSET } from './unitIds'

export function decomposeUnitId(id: number): { synergy: boolean; localId: number } {
  if (inSynergyBand(id)) return { synergy: true, localId: id - SYNERGY_ID_OFFSET }
  if (inTrialBand(id)) return { synergy: false, localId: trialBandLocal(id) }
  return { synergy: false, localId: id }
}
