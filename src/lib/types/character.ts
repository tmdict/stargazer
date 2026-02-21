import { Team } from './team'

export interface CharacterType {
  id: number
  name: string
  level: string
  faction: string
  class: string
  damage: string
  energy: number
  range: number
  season: number
  tags: readonly string[]
  sourceHexId?: number // Optional property for tracking drag source
  team?: Team // Team assignment for placement
}
