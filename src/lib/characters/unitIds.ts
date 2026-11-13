// The id bands of the grid's one unit slot. A leaf module, so the grid, the
// serializer and each band's helpers can all import it.
//
// A base hero is its own id. A companion is N * COMPANION_ID_OFFSET + its
// owner's id (N >= 1). The phantimal and synergy bands repeat that layout
// above their offsets, so companion arithmetic is the same in every band.
export const COMPANION_ID_OFFSET = 10000
export const PHANTIMAL_ID_OFFSET = 100000
export const SYNERGY_ID_OFFSET = 200000
