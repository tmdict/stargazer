// The game data files under src/data/: heroes, artifacts, phantimals and
// charms, each list built once. It imports neither Vue nor the data pack, so a
// worker, a build script or lib/ code that reads game data loads nothing else.

import { PLACEHOLDERS } from '@/lib/characters/placeholder'
import type { ArtifactType } from '@/lib/types/artifact'
import type { CharacterType } from '@/lib/types/character'
import type { PhantimalType } from '@/lib/types/phantimal'
import type { CharmData, TagAttachment } from '@/lib/types/skill'

let characters: CharacterType[] | null = null
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

/** The season's charms in id order; none once charms are retired, which
 * leaves the glob matching no file. */
export function loadCharms(): CharmData[] {
  charms ??= Object.values(
    import.meta.glob<CharmData>('@/data/seasonal/charm/*.json', {
      eager: true,
      import: 'default',
    }),
  ).sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }))
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
