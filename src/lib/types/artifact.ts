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

export type ArtifactStats = Partial<Record<ArtifactStatKey, number>>

// Stats whose values render as percentages rather than flat numbers.
export const PERCENT_STAT_KEYS: ReadonlySet<ArtifactStatKey> = new Set([
  'atk',
  'hp',
  'phys-def',
  'magic-def',
])

export interface ArtifactType {
  id: number
  name: string
  season: number
  stats: ArtifactStats
  team?: Team // Team assignment for placement
}
