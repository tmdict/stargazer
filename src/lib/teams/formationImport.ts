/* Formation shots in the match import: the map a shot's lit tiles name, who
 * stands on each tile it shows, and the side that makes. A board's heroes and
 * their upgrades come from its result shot when there is one, else from the
 * formation's own card row; with neither, from the portraits alone. The units
 * are matched against that lineup with the companions and phantimal it can
 * bring, so a portrait only has to tell a handful of units apart. Pure data
 * mapping, joined to the result shots by teamImport. */

import { isBaseHeroId } from '@/lib/characters/character'
import { companionIdsOf } from '@/lib/characters/companion'
import { inPhantimalBand, isPhantimalId, phantimalOwnerId } from '@/lib/characters/phantimal'
import { BASE_TEAM_SIZE } from '@/lib/grid'
import type { FormationReading, UnitReading } from '@/lib/import/types'
import { deploymentTiles, MAPS } from '@/lib/maps'
import { getCharacterSkill } from '@/lib/skills/registry'
import type { SideLoadBoard, SideLoadCompanion } from './sideLoad'
import type { LineupEntry } from './teamImport'

// ---------- the map ----------

/* The map a formation shot shows: the first candidate whose deployment tiles
 * for the shown side are exactly the lit tiles, where a tile a portrait
 * hides counts either way and every unit stands on one of them. Null when
 * none fits. */
export function identifyMap(
  reading: FormationReading,
  candidates: readonly string[],
): string | null {
  if (reading.side === null) return null
  const lit = new Set(reading.tiles)
  const open = new Set(reading.unclear)
  for (const key of candidates) {
    if (!MAPS[key]) continue
    const tiles = deploymentTiles(key, reading.side)
    const fits =
      reading.tiles.every((id) => tiles.has(id)) &&
      reading.units.every((unit) => tiles.has(unit.hexId)) &&
      [...tiles].every(
        (id) => lit.has(id) || open.has(id) || reading.units.some((u) => u.hexId === id),
      )
    if (fits) return key
  }
  return null
}

// ---------- the units ----------

// A unit a side can field, and the reference its portrait ranks under: its
// own art (a hero, a phantimal, a companion with an image of its own), else
// its owner's (Lailah, Phraesto's shadow).
interface Slot {
  unitId: number
  art: number
  owner: number | null
}

const slotsOf = (ownerId: number): Slot[] => {
  const companions = companionIdsOf(ownerId)
  const ownArt = getCharacterSkill(ownerId)?.companionImageModifier !== undefined
  return [
    { unitId: ownerId, art: ownerId, owner: null },
    ...companions.map((unitId) => ({
      unitId,
      art: ownArt ? companions[0]! : ownerId,
      owner: ownerId,
    })),
  ]
}

const scoreOf = (unit: UnitReading, art: number): number =>
  unit.candidates.reduce(
    (best, c) => (c.characterId === art && c.score > best ? c.score : best),
    -Infinity,
  )

// A portrait goes to a unit only at this score or above; the lineup leaves
// few units to choose from, so even a weak match is usually the right one.
const ASSIGN_FLOOR = 0.2
// A phantimal stands on the board when some portrait matches its art better
// than any hero's, and this well: on every capture measured the phantimal's
// own portrait does (0.81 to 0.94), while a hero's can resemble phantimal art
// more than the floor yet still matches a hero better.
const PHANTIMAL_FLOOR = 0.6
// A match is sure when it scores this well and leads every unit of other art
// by this much; else it waits for review.
export const SURE_SCORE = 0.6
const SURE_MARGIN = 0.08

export type UnitState = 'sure' | 'review' | 'none'

export interface UnitAssignment {
  // The unit the portrait is taken for; null when it is none of the side's.
  unitId: number | null
  state: UnitState
}

/* Each portrait's unit among the lineup's heroes, their companions and the
 * phantimal the portraits show, when the heroes qualify for it, best matches
 * first; a review pick (a unit id, or null for none) stands as made.
 * Companions of one owner that share an image cannot be told apart, so they
 * take their ids in tile order. */
export function assignUnits(
  units: readonly UnitReading[],
  heroIds: readonly number[],
  overrides: Readonly<Record<number, number | null>>,
  phantimalFits: (phantimalId: number) => boolean,
): UnitAssignment[] {
  const pool = heroIds.flatMap(slotsOf)
  let phantimal: { id: number; score: number } | null = null
  for (const unit of units) {
    const top = unit.candidates[0]
    if (
      top &&
      isPhantimalId(top.characterId) &&
      phantimalFits(top.characterId) &&
      top.score >= (phantimal?.score ?? PHANTIMAL_FLOOR)
    ) {
      phantimal = { id: top.characterId, score: top.score }
    }
  }
  if (phantimal) pool.push(...slotsOf(phantimal.id))

  const taken = new Set<number>()
  const out: UnitAssignment[] = units.map((_, i) => {
    const pick = overrides[i]
    if (pick === undefined) return { unitId: null, state: 'none' }
    if (pick !== null) taken.add(pick)
    return { unitId: pick, state: 'sure' }
  })
  const pairs: { i: number; slot: Slot; score: number }[] = []
  units.forEach((unit, i) => {
    if (overrides[i] !== undefined) return
    for (const slot of pool) {
      const score = scoreOf(unit, slot.art)
      if (score >= ASSIGN_FLOOR) pairs.push({ i, slot, score })
    }
  })
  pairs.sort((a, b) => b.score - a.score)
  const done = new Set<number>()
  for (const { i, slot, score } of pairs) {
    if (done.has(i) || taken.has(slot.unitId)) continue
    done.add(i)
    taken.add(slot.unitId)
    const rival = Math.max(
      ...pool.filter((s) => s.art !== slot.art).map((s) => scoreOf(units[i]!, s.art)),
    )
    const sure = score >= SURE_SCORE && score - rival >= SURE_MARGIN
    out[i] = { unitId: slot.unitId, state: sure ? 'sure' : 'review' }
  }
  // A portrait left over is still one of the side's units, and one with no
  // likeness to its own art (Lailah, drawn on her own in game but beside
  // Elijah in the app's art) is matched last by elimination, for review.
  const leftover = units.flatMap((unit, i) =>
    out[i]!.state === 'none' && overrides[i] === undefined
      ? pool
          .filter((slot) => !taken.has(slot.unitId))
          .map((slot) => ({ i, slot, score: Math.max(-1, scoreOf(unit, slot.art)) }))
      : [],
  )
  leftover.sort((a, b) => b.score - a.score)
  for (const { i, slot } of leftover) {
    if (done.has(i) || taken.has(slot.unitId)) continue
    done.add(i)
    taken.add(slot.unitId)
    out[i] = { unitId: slot.unitId, state: 'review' }
  }

  // Interchangeable companions in tile order.
  const siblings = new Map<string, number[]>()
  out.forEach((a, i) => {
    const slot = pool.find((s) => s.unitId === a.unitId)
    if (!slot || slot.owner === null) return
    const key = `${slot.owner}:${slot.art}`
    siblings.set(key, [...(siblings.get(key) ?? []), i])
  })
  for (const indices of siblings.values()) {
    const ids = indices.map((i) => out[i]!.unitId!).sort((a, b) => a - b)
    const byTile = [...indices].sort((a, b) => units[a]!.hexId - units[b]!.hexId)
    byTile.forEach((i, k) => {
      out[i] = { ...out[i]!, unitId: ids[k]! }
    })
  }
  return out
}

/* A lineup from the portraits alone, for a board with neither a result shot
 * nor a card row: each portrait's best hero, surest portraits first. A
 * portrait whose best hero is already taken and spawns companions is taken
 * for one of them rather than for another hero. */
export function heroesFromUnits(units: readonly UnitReading[]): number[] {
  const heroes: number[] = []
  const ranked = units
    .map((unit) => unit.candidates.filter((c) => isBaseHeroId(c.characterId)))
    .sort((a, b) => (b[0]?.score ?? 0) - (a[0]?.score ?? 0))
  for (const candidates of ranked) {
    if (heroes.length === BASE_TEAM_SIZE) break
    const top = candidates[0]
    if (!top || (heroes.includes(top.characterId) && companionIdsOf(top.characterId).length > 0))
      continue
    const pick = candidates.find((c) => c.score >= SURE_SCORE && !heroes.includes(c.characterId))
    if (pick) heroes.push(pick.characterId)
  }
  return heroes
}

// ---------- the side ----------

// A unit seen on a tile: a formation shot's portrait as assigned, or a pick
// made in a review. A null unit is none of the side's.
export interface PlacedUnit {
  unitId: number | null
  hexId: number
}

// The phantimal a side fields from the units seen on its tiles: one seen
// itself, else the owner of a companion seen, which exists only with it.
function fieldedPhantimal(unitIds: readonly (number | null)[]): number | null {
  const band = unitIds.filter((id): id is number => id !== null && inPhantimalBand(id))
  const id = band.find(isPhantimalId) ?? band[0]
  return id === undefined ? null : phantimalOwnerId(id)
}

// The units a side places in turn on a screenshot's tiles: each hero, then
// its companions, and last the phantimal the units seen field, with that
// phantimal's companions.
export function placingOrder(heroes: readonly number[], picked: readonly number[]): number[] {
  const phantimal = fieldedPhantimal(picked)
  return [...heroes, ...(phantimal === null ? [] : [phantimal])].flatMap((unitId) => [
    unitId,
    ...companionIdsOf(unitId),
  ])
}

/* A replay frame side's picks that count, those of units the side fields (a
 * swap that gives the side the other team's heroes hides the rest until
 * swapped back), and its placing order from them. Shared by the replay
 * review and its card's count. */
export function replayPlacing(
  heroes: readonly number[],
  options: readonly number[],
  picks: Readonly<Record<number, number>>,
): { order: number[]; picks: Map<number, number> } {
  const counted = new Map(
    Object.entries(picks)
      .filter(([, unitId]) => options.includes(unitId))
      .map(([hexId, unitId]) => [Number(hexId), unitId] as const),
  )
  return { order: placingOrder(heroes, [...counted.values()]), picks: counted }
}

/* Whether a formation shot's review may pick a unit for a tile: one no
 * portrait is taken for, and while the portraits field a phantimal, none of
 * another phantimal's, which would take the place of the one shown. */
export function pickableUnit(unitId: number, shown: readonly (number | null)[]): boolean {
  if (shown.includes(unitId)) return false
  const phantimal = fieldedPhantimal(shown)
  return phantimal === null || !inPhantimalBand(unitId) || phantimalOwnerId(unitId) === phantimal
}

/* A formation shot's review picks that place a unit: one the review may pick,
 * on a tile no portrait stands on. Shared by the plan and the review, so the
 * review shows what Save as New places. */
export function placedPicks(
  picks: Readonly<Record<number, number>>,
  portraits: readonly PlacedUnit[],
): { unitId: number; hexId: number }[] {
  const shown = portraits.map((u) => u.unitId)
  return Object.entries(picks).flatMap(([hex, unitId]) => {
    const hexId = Number(hex)
    return pickableUnit(unitId, shown) && !portraits.some((u) => u.hexId === hexId)
      ? [{ unitId, hexId }]
      : []
  })
}

/* The units a formation shot's review places on free tiles: the side's
 * placing order less the units portraits are taken for, the units it may
 * pick, and the picks that place one. A unit the side cannot field, such as
 * a phantimal its heroes stopped qualifying for, fields nothing. Shared by
 * the review and its card's count. */
export function missingUnits(
  lineup: readonly number[],
  portraits: readonly PlacedUnit[],
  options: readonly number[],
  picks: Readonly<Record<number, number>>,
): { order: number[]; options: number[]; picks: Map<number, number> } {
  const shown = portraits.map((u) => u.unitId)
  const pickable = options.filter((unitId) => pickableUnit(unitId, shown))
  const placed = new Map(
    placedPicks(picks, portraits)
      .filter(({ unitId }) => pickable.includes(unitId))
      .map(({ hexId, unitId }) => [hexId, unitId] as const),
  )
  const order = placingOrder(
    lineup,
    [...shown, ...placed.values()].filter(
      (id): id is number => id !== null && options.includes(id),
    ),
  ).filter((unitId) => !shown.includes(unitId))
  return { order, options: pickable, picks: placed }
}

/* One side of a board as the side-load places it: each hero with its
 * upgrades on the tile it was seen on, or on a random free tile when it was
 * not; the companions and phantimal seen, the phantimal on a random free tile
 * when only its companion was; and the artifact. */
export function formationSide(
  seen: readonly PlacedUnit[],
  heroes: readonly LineupEntry[],
  artifact: number | null,
): SideLoadBoard {
  const tileOf = (unitId: number): number | undefined =>
    seen.find((u) => u.unitId === unitId)?.hexId
  const mains = heroes.map(({ characterId, attrs }) => ({
    unitId: characterId,
    hexId: tileOf(characterId),
    attrs,
  }))
  const owners = heroes.map((h) => h.characterId)
  const phantimalId = fieldedPhantimal(seen.map((u) => u.unitId))
  if (phantimalId !== null) owners.push(phantimalId)
  const companions: SideLoadCompanion[] = owners.flatMap((owner) =>
    companionIdsOf(owner).flatMap((unitId) => {
      const hexId = tileOf(unitId)
      return hexId === undefined ? [] : [{ unitId, hexId, mainUnitId: owner }]
    }),
  )
  return {
    mains,
    companions,
    phantimal: phantimalId === null ? null : { unitId: phantimalId, hexId: tileOf(phantimalId) },
    artifact,
  }
}
