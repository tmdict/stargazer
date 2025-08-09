import { Team } from './team'

export interface ArtifactType {
  id: number
  name: string
  season: number
  team?: Team // Team assignment for placement
}
