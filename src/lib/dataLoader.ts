// The game data files under src/data/: heroes, artifacts, phantimals and
// charms, each list built once. It imports no Vue, and of the data pack only
// the list of each hero's charms, so a worker, a build script or lib/ code that
// reads game data loads nothing else.

import { PLACEHOLDER_NONE, PLACEHOLDERS } from '@/lib/characters/placeholder'
import type { ArtifactType } from '@/lib/types/artifact'
import type { CharacterType } from '@/lib/types/character'
import type { DuelCreature } from '@/lib/types/honorDuel'
import type { PhantimalType } from '@/lib/types/phantimal'
import type { CharmData, CharmFile, HeroCharm, HeroCharms, TagAttachment } from '@/lib/types/skill'

let characters: CharacterType[] | null = null
let creatures: CharacterType[] | null = null
let artifacts: ArtifactType[] | null = null
let phantimals: PhantimalType[] | null = null
let charms: CharmData[] | null = null
let heroCharms: Map<string, CharmData> | null = null

// Placeholder stand-ins join the hero list here so selection, placement,
// serialization, and lookups all see them as ordinary characters.
export function loadCharacters(): CharacterType[] {
  characters ??= [
    ...Object.values(
      import.meta.glob<CharacterType>('@/data/character/*.json', {
        eager: true,
        import: 'default',
      }),
    ).map(withCharmTags),
    ...PLACEHOLDERS,
  ]
  return characters
}

// Honor Duel's creatures in id order, in the shape of a hero. They stay out of
// the hero list, so no picker, roster, skill page or import lists one, and a
// lookup by id finds them (unitData, the game data store).
export function loadCreatures(): CharacterType[] {
  creatures ??= Object.values(
    import.meta.glob<DuelCreature>('@/data/hd/creature/*.json', {
      eager: true,
      import: 'default',
    }),
  )
    .sort((a, b) => a.id - b.id)
    .map(({ id, name, faction }) => ({
      id,
      name,
      faction,
      class: PLACEHOLDER_NONE,
      damage: PLACEHOLDER_NONE,
      level: 'rare',
      energy: [0],
      range: 1,
      season: 0,
      tags: {},
      creature: true,
    }))
  return creatures
}

// Artifacts split by rotation semantics: the permanent pre-season set lives
// in data/artifact/, the current season's set in data/seasonal/artifact/
// (deleted wholesale at rollover; an unmatched glob is an empty map).
export function loadArtifacts(): ArtifactType[] {
  artifacts ??= Object.values({
    ...import.meta.glob<ArtifactType>('@/data/artifact/*.json', {
      eager: true,
      import: 'default',
    }),
    ...import.meta.glob<ArtifactType>('@/data/seasonal/artifact/*.json', {
      eager: true,
      import: 'default',
    }),
  }).sort((a, b) => a.name.localeCompare(b.name))
  return artifacts
}

export function loadPhantimals(): PhantimalType[] {
  phantimals ??= Object.values(
    import.meta.glob<PhantimalType>('@/data/seasonal/phantimal/*.json', {
      eager: true,
      import: 'default',
    }),
  ).sort((a, b) => a.id - b.id)
  return phantimals
}

// A charm's tags join each sharing hero's own, pinned to the tiers that carry
// them, so every tag consumer (filters, guide, skill chips) sees them as
// ordinary hero tags.
function withCharmTags(character: CharacterType): CharacterType {
  const charmTags = getCharmForHero(character.name)?.tags
  if (!charmTags) return character
  const tags: Record<string, readonly TagAttachment[]> = { ...character.tags }
  for (const [tag, { tiers, mods }] of Object.entries(charmTags)) {
    const pins = tiers.map((tier) => (mods ? { charm: tier, mods } : { charm: tier }))
    tags[tag] = [...(tags[tag] ?? []), ...pins]
  }
  return { ...character, tags }
}

/** Each hero's charm, charm types and recommended type, by hero. Empty without
 * the data pack's list, which leaves the glob matching no file: a copy with no
 * pack, or a season whose charms are retired. */
export function loadHeroCharms(): Readonly<Record<string, HeroCharm>> {
  const [list] = Object.values(
    import.meta.glob<HeroCharms>('@/pack/text/skill/hero-charms.json', {
      eager: true,
      import: 'default',
    }),
  )
  return list?.heroes ?? {}
}

/** The season's charms in id order, each with the heroes the data pack lists
 * for it and the tags and rules of its own file. */
export function loadCharms(): CharmData[] {
  if (charms) return charms
  const files = new Map(
    Object.values(
      import.meta.glob<CharmFile>('@/data/seasonal/charm/*.json', {
        eager: true,
        import: 'default',
      }),
    ).map((file) => [file.id, file]),
  )
  const byId = new Map<string, CharmData>()
  for (const [hero, { charm }] of Object.entries(loadHeroCharms())) {
    if (!byId.has(charm)) byId.set(charm, { ...files.get(charm), id: charm, heroes: [] })
    byId.get(charm)!.heroes.push(hero)
  }
  charms = [...byId.values()].sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }))
  for (const charm of charms) charm.heroes.sort()
  return charms
}

/** The charm a hero shares, with the full sharer list; null when the hero has none. */
export function getCharmForHero(slug: string): CharmData | null {
  if (!heroCharms) {
    heroCharms = new Map()
    for (const charm of loadCharms()) {
      for (const hero of charm.heroes) heroCharms.set(hero, charm)
    }
  }
  return heroCharms.get(slug) ?? null
}
