export const EQUIPMENT_TIERS = ['rare', 'elite', 'epic', 'legendary'] as const

export type EquipmentTier = (typeof EQUIPMENT_TIERS)[number]

export interface DuelEquipment {
  id: number
  name: string
  tier: EquipmentTier
  /** Whether the Honor Duel shop sells it. */
  shop?: boolean
}

export interface DuelArtifact {
  id: number
  name: string
}

/** A creature's data file. Its id is in the creatures' band of the hero ids. */
export interface DuelCreature {
  id: number
  name: string
  faction: string
}

export type HonorDuelItem =
  { kind: 'equipment'; item: DuelEquipment } | { kind: 'artifact'; item: DuelArtifact }

export interface DuelEquipmentText {
  name: string
  description: string
}

export interface DuelArtifactText {
  name: string
  levels: string[]
}

/** One language's Honor Duel text, each list keyed by the entry's file name. */
export interface HonorDuelText {
  equipment: Record<string, DuelEquipmentText>
  artifacts: Record<string, DuelArtifactText>
}
