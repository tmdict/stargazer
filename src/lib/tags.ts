/* Hero tags: which heroes a pick matches, which skill levels it tints, which
 * chips a hero shows, and the tag link format. Pure and free of the data
 * loader, so every surface shares one copy of each rule. */

import {
  SLOT_ORDER,
  type CharacterTags,
  type TagAttachment,
  type TagPick,
  type TagPin,
} from '@/lib/types/skill'

const PINS: readonly TagPin[] = [...SLOT_ORDER, 'charm']

/** The slot or charm tier an attachment pins; null when it pins none. */
export function entryPin(entry: TagAttachment): { pin: TagPin; level: number } | null {
  for (const pin of PINS) {
    const level = entry[pin]
    if (level !== undefined) return { pin, level }
  }
  return null
}

const hasAll = (have: readonly string[] | undefined, mods: readonly string[]): boolean =>
  mods.every((mod) => have?.includes(mod))

/** The attachments of the pick's tag that carry every modifier in the pick. */
function matchingEntries(tags: CharacterTags, pick: TagPick): readonly TagAttachment[] {
  return (tags[pick.tag] ?? []).filter((entry) => hasAll(entry.mods, pick.mods))
}

/** A character-level tag has no attachment to carry a modifier, so it matches
 * only a pick without any. */
export function matchesPick(tags: CharacterTags, pick: TagPick): boolean {
  if (!Object.hasOwn(tags, pick.tag)) return false
  return pick.mods.length === 0 || matchingEntries(tags, pick).length > 0
}

/** Levels of a slot, or tiers of the charm, that any of the picks tints. */
export function pinnedLevels(
  tags: CharacterTags,
  picks: readonly TagPick[],
  pin: TagPin,
): number[] {
  const levels = new Set<number>()
  for (const pick of picks) {
    for (const entry of matchingEntries(tags, pick)) {
      const level = entry[pin]
      if (level !== undefined) levels.add(level)
    }
  }
  return [...levels].sort((a, b) => a - b)
}

/** The picks a hero has skill text for. A pick the hero does not satisfy, or
 * one on a character-level tag, would filter its skills down to nothing. */
export function usablePicks(tags: CharacterTags, picks: readonly TagPick[]): TagPick[] {
  return picks.filter((pick) => matchingEntries(tags, pick).some((entry) => entryPin(entry)))
}

/** The picks a hero's skills open on from the Mechanics guide: those of
 * `picks` it has text for. A hero the picks dim may have none, and then opens
 * on the tag it was clicked under, without modifiers. */
export function openingPicks(
  tags: CharacterTags,
  picks: readonly TagPick[],
  under?: string,
): TagPick[] {
  const shown = usablePicks(tags, picks)
  if (shown.length > 0 || under === undefined) return shown
  return usablePicks(tags, [{ tag: under, mods: [] }])
}

interface TagModifiers {
  /** Modifiers in use under the tag, sorted. */
  readonly mods: readonly string[]
  /** The tag's one modifier when every attachment carries it. Such a tag has
   * no second layer to choose from and reads as one entry, "Ult (Opening)". */
  readonly solo: string | null
}

/** Every tag in use, in key order. */
export type TagVocabulary = ReadonlyMap<string, TagModifiers>

export function tagVocabulary(heroes: readonly { readonly tags: CharacterTags }[]): TagVocabulary {
  const seen = new Map<string, { mods: Set<string>; bare: boolean }>()
  for (const { tags } of heroes) {
    for (const [tag, entries] of Object.entries(tags)) {
      const info = seen.get(tag) ?? { mods: new Set<string>(), bare: false }
      seen.set(tag, info)
      if (entries.length === 0) info.bare = true
      for (const entry of entries) {
        if (!entry.mods?.length) info.bare = true
        for (const mod of entry.mods ?? []) info.mods.add(mod)
      }
    }
  }
  return new Map(
    [...seen.keys()].sort().map((tag) => {
      const { mods, bare } = seen.get(tag)!
      const sorted = [...mods].sort()
      return [tag, { mods: sorted, solo: sorted.length === 1 && !bare ? sorted[0]! : null }]
    }),
  )
}

/** A tag as one menu entry or card: with its modifier when it is solo. */
export function tagPick(tag: string, vocabulary: TagVocabulary): TagPick {
  const solo = vocabulary.get(tag)?.solo
  return { tag, mods: solo ? [solo] : [] }
}

/** A hero's chips: one per tag, plus one per modifier it carries under a tag
 * with a second layer. With `pin`, only that slot's attachments count, which
 * gives the chips of one skill heading. */
export function heroChips(tags: CharacterTags, vocabulary: TagVocabulary, pin?: TagPin): TagPick[] {
  const chips: TagPick[] = []
  for (const [tag, { mods, solo }] of vocabulary) {
    const all = tags[tag]
    if (!all) continue
    const entries = pin ? all.filter((entry) => entry[pin] !== undefined) : all
    if (pin && entries.length === 0) continue
    chips.push(tagPick(tag, vocabulary))
    if (solo) continue
    for (const mod of mods) {
      if (entries.some((entry) => entry.mods?.includes(mod))) chips.push({ tag, mods: [mod] })
    }
  }
  return chips
}

/** Whether the picks light a chip. A chip without modifiers is the plain tag,
 * lit only by a pick that is also plain. */
export function chipActive(picks: readonly TagPick[], chip: TagPick): boolean {
  return picks.some(
    (pick) =>
      pick.tag === chip.tag &&
      (chip.mods.length === 0 ? pick.mods.length === 0 : hasAll(pick.mods, chip.mods)),
  )
}

/** The picks after a chip is clicked. A chip switched on is its own pick, so
 * chips combine as "any of". Switching one off takes it out of every pick
 * that carries it, which keeps a pick that arrived with several modifiers
 * whole until then. */
export function toggleChip(picks: readonly TagPick[], chip: TagPick): TagPick[] {
  if (!chipActive(picks, chip)) return [...picks, chip]
  return picks.flatMap((pick) => {
    if (pick.tag !== chip.tag) return [pick]
    if (chip.mods.length === 0) return pick.mods.length === 0 ? [] : [pick]
    const mods = pick.mods.filter((mod) => !chip.mods.includes(mod))
    if (mods.length === pick.mods.length) return [pick]
    return mods.length > 0 ? [{ tag: pick.tag, mods }] : []
  })
}

/** Query of a tag link: `?tag=debuff&mods=eryndor,global`. */
export function toTagQuery(pick: TagPick): { tag: string; mods?: string } {
  return pick.mods.length > 0
    ? { tag: pick.tag, mods: [...pick.mods].sort().join(',') }
    : { tag: pick.tag }
}

/** The pick a tag link names, or null. An unknown tag, a modifier not in use
 * under it, or a repeated parameter is no filter at all: a narrower or wider
 * one would not be what the link's author saw. */
export function fromTagQuery(
  query: { tag?: unknown; mods?: unknown },
  vocabulary: TagVocabulary,
): TagPick | null {
  const { tag, mods } = query
  if (typeof tag !== 'string') return null
  const info = vocabulary.get(tag)
  if (!info) return null
  if (mods === undefined || mods === '') return tagPick(tag, vocabulary)
  if (typeof mods !== 'string') return null
  const list = [...new Set(mods.split(','))].sort()
  return list.every((mod) => info.mods.includes(mod)) ? { tag, mods: list } : null
}
