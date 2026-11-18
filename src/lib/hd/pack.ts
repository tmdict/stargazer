// Whether the data pack holds Honor Duel content, read from one file's presence
// so the answer fetches nothing. The pack is pinned apart from this repo, and a
// pack from before that content would leave the tab a list of names alone, so
// the tab is shown only with it.
export const HONOR_DUEL_IN_PACK =
  Object.keys(import.meta.glob('@/pack/text/hd/en/equipment.json')).length > 0

// The creatures' skill text is a file of its own, which a pack may hold the
// mode's other text without; a creature then has nothing to open.
export const DUEL_CREATURE_TEXT_IN_PACK =
  Object.keys(import.meta.glob('@/pack/text/hd/en/creatures.json')).length > 0
