// Phantimals share the grid's single unit slot with characters, tagged by an ID
// namespace (the same trick as companionIdOffset). A tile whose characterId is
// >= PHANTIMAL_ID_OFFSET holds a phantimal, so occupancy, swap/move, targeting
// and pathfinding treat it like any other unit for free. The differences are
// enforced elsewhere and are deliberately small: phantimals are exempt from the
// team-size limit (canPlaceCharacterOnTeam) and capped at one per team by the
// character store's placement helpers. Keeping these as pure id-math (no Grid
// dependency) makes this a leaf module the serializer and grid can both import.
export const PHANTIMAL_ID_OFFSET = 20000

export function isPhantimalId(id: number): boolean {
  return id >= PHANTIMAL_ID_OFFSET
}

export function toPhantimalId(localId: number): number {
  return PHANTIMAL_ID_OFFSET + localId
}

export function toLocalPhantimalId(id: number): number {
  return id % PHANTIMAL_ID_OFFSET
}
