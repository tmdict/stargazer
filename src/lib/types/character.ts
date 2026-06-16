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
  sourceGridId?: number // Board the drag started on (for cross-board moves/swaps)
  team?: Team // Team assignment for placement
}
