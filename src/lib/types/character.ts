import type { CharacterTags } from './skill'
import { Team } from './team'

export interface CharacterType {
  id: number
  name: string
  level: string
  faction: string
  class: string
  damage: string
  energy: readonly number[]
  range: number
  season: number
  tags: CharacterTags
  sourceHexId?: number // Optional property for tracking drag source
  team?: Team // Team assignment for placement
}
