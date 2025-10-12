import { Team } from './team'

export interface CharacterType {
  id: number
  name: string
  level: string
  faction: string
  class: string
  damage: string
  range: number
  season: number
  sourceHexId?: number // Optional property for tracking drag source
  team?: Team // Team assignment for placement
}

export interface TagType {
  name: string
  characters: string[]
}
