import { Team } from './team'

export type ArtifactStatKey =
  | 'atk'
  | 'hp'
  | 'phys-def'
  | 'magic-def'
  | 'haste'
  | 'vitality'
  | 'atk-spd'
  | 'def-penetration'
  | 'def'
  | 'ranged-def'
  | 'life-drain'

export type ArtifactStats = Partial<Record<ArtifactStatKey, number>>

// Stats whose values render as percentages rather than flat numbers.
// `def` parallels phys-def/magic-def (% bonus); ranged-def and life-drain are
// point-based stats (each point ≈ 1% effect) shown as flat numbers.
export const PERCENT_STAT_KEYS: ReadonlySet<ArtifactStatKey> = new Set([
  'atk',
  'hp',
  'phys-def',
  'magic-def',
  'def',
])

export interface ArtifactType {
  id: number
  name: string
  season: number
  stats: ArtifactStats
  team?: Team // Team assignment for placement
}
