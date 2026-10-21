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
function entryPin(entry: TagAttachment): { pin: TagPin; level: number } | null {
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

export function matchesPick(tags: CharacterTags, pick: TagPick): boolean {
  return Object.hasOwn(tags, pick.tag) && matchingEntries(tags, pick).length > 0
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

/** The picks a hero has skill text for. A pick the hero does not satisfy
 * would filter its skills down to nothing. */
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
  /** Modifiers in use under the tag: those that describe the effect in
   * `MODIFIER_ORDER`, then the synergies in key order. */
  readonly mods: readonly string[]
  /** The modifiers of `mods` that mark a synergy with a hero. */
  readonly synergies: readonly string[]
  /** The tag's one modifier when every attachment carries it. Such a tag has
   * no second layer to choose from and reads as one entry, "Ult (Opening)".
   * A synergy is never solo, so its tag keeps its own name ("DoT"). */
  readonly solo: string | null
}

/** The order a tag lists the modifiers that describe its effect: when it
 * happens, who it is for, then how far it reaches, narrowest first. A modifier
 * missing here follows these, in key order. */
const MODIFIER_ORDER: readonly string[] = ['opening', 'self', 'ally', 'single', 'aoe', 'global']

const modifierRank = (mod: string): number => {
  const at = MODIFIER_ORDER.indexOf(mod)
  return at === -1 ? MODIFIER_ORDER.length : at
}

/** Every tag in use, in key order. */
export type TagVocabulary = ReadonlyMap<string, TagModifiers>

/** `isSynergy` is passed in because the hero list sits behind the data loader. */
export function tagVocabulary(
  heroes: readonly { readonly tags: CharacterTags }[],
  isSynergy: (mod: string) => boolean = () => false,
): TagVocabulary {
  const seen = new Map<string, { mods: Set<string>; bare: boolean }>()
  for (const { tags } of heroes) {
    for (const [tag, entries] of Object.entries(tags)) {
      const info = seen.get(tag) ?? { mods: new Set<string>(), bare: false }
      seen.set(tag, info)
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
      const synergies = sorted.filter((mod) => isSynergy(mod))
      const others = sorted
        .filter((mod) => !isSynergy(mod))
        .sort((a, b) => modifierRank(a) - modifierRank(b))
      const solo = sorted.length === 1 && !bare && synergies.length === 0 ? sorted[0]! : null
      return [tag, { mods: [...others, ...synergies], synergies, solo }]
    }),
  )
}

/** The pick with a modifier switched on, minus the picked modifiers no hero
 * has on one effect with it. */
export function addModifier(
  pick: TagPick,
  mod: string,
  heroes: readonly { readonly tags: CharacterTags }[],
): TagPick {
  const mods = [mod]
  for (const other of pick.mods) {
    const candidate = { tag: pick.tag, mods: [...mods, other] }
    if (heroes.some((hero) => matchesPick(hero.tags, candidate))) mods.push(other)
  }
  return { tag: pick.tag, mods: mods.sort() }
}

/** A tag as one menu entry or card: with its modifier when it is solo. */
export function tagPick(tag: string, vocabulary: TagVocabulary): TagPick {
  const solo = vocabulary.get(tag)?.solo
  return { tag, mods: solo ? [solo] : [] }
}

/** A chip: a tag with every modifier that by itself matches the same
 * attachments of a hero, which the chip as a pick matches too. */
export interface TagChip extends TagPick {
  /** The tag by itself matches them as well. */
  readonly whole: boolean
}

/** A hero's chips: under each tag, one for the tag and one per modifier it
 * carries, those that match the same attachments merged into one ("Temp Buff
 * (Opening, Single Target)"). A synergy has no chip. */
export function heroChips(tags: CharacterTags, vocabulary: TagVocabulary): TagChip[] {
  const chips: TagChip[] = []
  for (const [tag, { mods, synergies }] of vocabulary) {
    const entries = tags[tag] ?? []
    if (entries.length === 0) continue
    // Keyed by the attachments matched; the tag alone matches them all.
    const every = entries.map((_, at) => at).join()
    const groups = new Map<string, string[]>([[every, []]])
    for (const mod of mods) {
      if (synergies.includes(mod)) continue
      const key = entries.flatMap((entry, at) => (entry.mods?.includes(mod) ? [at] : [])).join()
      if (key) groups.set(key, [...(groups.get(key) ?? []), mod])
    }
    for (const [key, group] of groups) chips.push({ tag, mods: group, whole: key === every })
  }
  return chips
}

/** A skill heading's tags: each tag once, with every modifier its attachments
 * in that slot carry, synergies aside ("Debuff (Single Target, Global)"). The
 * modifiers may come from separate effects, so these are labels, never picks. */
export function headingTags(
  tags: CharacterTags,
  vocabulary: TagVocabulary,
  pin: TagPin,
): TagPick[] {
  const labels: TagPick[] = []
  for (const [tag, { mods, synergies }] of vocabulary) {
    const entries = (tags[tag] ?? []).filter((entry) => entry[pin] !== undefined)
    if (entries.length === 0) continue
    const carried = mods.filter(
      (mod) => !synergies.includes(mod) && entries.some((entry) => entry.mods?.includes(mod)),
    )
    labels.push({ tag, mods: carried })
  }
  return labels
}

/** A filter's pick as a hero's chips read it: without its synergies, which
 * have no chip. */
export function chipPick(pick: TagPick, vocabulary: TagVocabulary): TagPick {
  const synergies = vocabulary.get(pick.tag)?.synergies ?? []
  return { tag: pick.tag, mods: pick.mods.filter((mod) => !synergies.includes(mod)) }
}

/** Whether a pick lights a chip: it names a modifier of the chip, or is the
 * tag by itself when the chip stands for that. */
const lights = (pick: TagPick, chip: TagChip): boolean =>
  pick.tag === chip.tag &&
  (pick.mods.length === 0 ? chip.whole : pick.mods.some((mod) => chip.mods.includes(mod)))

export function chipActive(picks: readonly TagPick[], chip: TagChip): boolean {
  return picks.some((pick) => lights(pick, chip))
}

/** The picks after a chip is clicked. A chip switched on is its own pick, so
 * chips combine as "any of". Switching one off takes its modifiers out of
 * every pick that lights it, which keeps a pick that arrived with several
 * modifiers whole until then. */
export function toggleChip(picks: readonly TagPick[], chip: TagChip): TagPick[] {
  if (!chipActive(picks, chip)) return [...picks, chip]
  return picks.flatMap((pick) => {
    if (!lights(pick, chip)) return [pick]
    const mods = pick.mods.filter((mod) => !chip.mods.includes(mod))
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
