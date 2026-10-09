import { shallowReactive } from 'vue'

import skillHeroes from '@/data/skill/heroes.json'
import skillNumbers from '@/data/skill/numbers.json'
import { PLACEHOLDERS } from '@/lib/characters/placeholder'
import type { ArtifactType } from '@/lib/types/artifact'
import type { CharacterType } from '@/lib/types/character'
import type { LocaleData, LocaleDictionary, SkillLocale } from '@/lib/types/i18n'
import type { PhantimalLocale, PhantimalType } from '@/lib/types/phantimal'
import type {
  CharmData,
  CharmTags,
  SkillCharms,
  SkillKeywords,
  SkillLanguage,
  SkillLocaleFile,
  SkillNumbers,
  SkillTerms,
  TagAttachment,
} from '@/lib/types/skill'
import { artifactImages, characterImages } from './imageAssets'

function extractFileName(path: string): string {
  const fileName = path.split('/').pop() || 'Unknown'
  return fileName.replace(/\.\w+$/, '')
}

function loadAssetsDict<T>(assets: Record<string, T>): Record<string, T> {
  return Object.fromEntries(
    Object.entries(assets).map(([path, asset]) => {
      const fileName = extractFileName(path)
      return [fileName, asset]
    }),
  )
}

// Module-level cache for data
let charactersCache: CharacterType[] | null = null
let artifactsCache: ArtifactType[] | null = null
let iconsCache: Record<string, string> | null = null
let characterRangesCache: Map<number, number> | null = null
let artifactEffectsCache: Record<string, LocaleData[]> | null = null
let phantimalsCache: PhantimalType[] | null = null
let phantimalLocalesCache: Record<string, PhantimalLocale> | null = null

export function loadCharacters(): CharacterType[] {
  if (charactersCache) {
    return charactersCache
  }

  const characterModules = import.meta.glob<CharacterType>('@/data/character/*.json', {
    eager: true,
    import: 'default',
  })
  // Placeholder stand-ins join the hero list here so selection, placement,
  // serialization, and lookups all see them as ordinary characters.
  const characters = [...Object.values(characterModules).map(withCharmTags), ...PLACEHOLDERS]

  charactersCache = characters

  // Build character ranges map
  characterRangesCache = new Map<number, number>()
  characters.forEach((char) => {
    characterRangesCache!.set(char.id, char.range)
  })

  return characters
}

// Artifacts split by rotation semantics: the permanent pre-season set lives
// in data/artifact/, the current season's set in data/seasonal/artifact/
// (deleted wholesale at rollover; an unmatched glob is an empty map).
export function loadArtifacts(): ArtifactType[] {
  if (artifactsCache) {
    return artifactsCache
  }

  const artifactModules = {
    ...import.meta.glob<ArtifactType>('@/data/artifact/*.json', {
      eager: true,
      import: 'default',
    }),
    ...import.meta.glob<ArtifactType>('@/data/seasonal/artifact/*.json', {
      eager: true,
      import: 'default',
    }),
  }
  const artifacts = Object.values(artifactModules).sort((a, b) => a.name.localeCompare(b.name))

  artifactsCache = artifacts
  return artifacts
}

export function loadCharacterImages(): Record<string, string> {
  return characterImages
}

// Portraits at the art's own width for the match-import matcher, loaded on
// demand: the 100 px picker thumbnails lose the face detail the matcher needs.
// Keyed by hero name; each value is a lazy import of the image URL.
export function loadMatcherPortraits(): Record<string, () => Promise<string>> {
  const modules = import.meta.glob<string>('@/assets/images/character/*.png', {
    query: { format: 'webp', quality: 85, w: 180 },
    import: 'default',
  })
  return loadAssetsDict(modules)
}

export function loadArtifactImages(): Record<string, string> {
  return artifactImages
}

export function loadPhantimals(): PhantimalType[] {
  if (phantimalsCache) {
    return phantimalsCache
  }

  const modules = import.meta.glob<PhantimalType>('@/data/seasonal/phantimal/*.json', {
    eager: true,
    import: 'default',
  })
  phantimalsCache = Object.values(modules).sort((a, b) => a.id - b.id)
  return phantimalsCache
}

let charmsCache: CharmData | null = null
let heroCharmCache: Map<string, string> | null = null

/** Seasonal charm registry: charm slug → the heroes sharing it. After
 * seasonal removal the unmatched glob compiles to an empty module map, so this
 * degrades to {}. */
export function loadCharms(): CharmData {
  if (charmsCache) return charmsCache
  const modules = import.meta.glob<CharmData>('@/data/seasonal/charm/charms.json', {
    eager: true,
    import: 'default',
  })
  charmsCache = Object.values(modules)[0] ?? {}
  return charmsCache
}

/** Hand-written charm tags; {} when the season's charms are untagged or
 * retired. */
export function loadCharmTags(): CharmTags {
  const modules = import.meta.glob<CharmTags>('@/data/seasonal/charm/tags.json', {
    eager: true,
    import: 'default',
  })
  return Object.values(modules)[0] ?? {}
}

// A charm's tags join each sharing hero's own, pinned to the tiers that carry
// them, so every tag consumer (filters, guide, skill chips) sees them as
// ordinary hero tags.
function withCharmTags(character: CharacterType): CharacterType {
  const charm = getCharmForHero(character.name)
  const charmTags = charm ? loadCharmTags()[charm.slug] : undefined
  if (!charmTags) return character
  const tags: Record<string, readonly TagAttachment[]> = { ...character.tags }
  for (const [tag, tiers] of Object.entries(charmTags)) {
    tags[tag] = [...(tags[tag] ?? []), ...tiers.map((tier) => ({ charm: tier }))]
  }
  return { ...character, tags }
}

/** The charm a hero shares, with the full sharer list; null when the hero has
 * none (or charms are retired). */
export function getCharmForHero(slug: string): { slug: string; heroes: string[] } | null {
  if (!heroCharmCache) {
    heroCharmCache = new Map()
    for (const [charmSlug, { heroes }] of Object.entries(loadCharms())) {
      for (const hero of heroes) heroCharmCache.set(hero, charmSlug)
    }
  }
  const charmSlug = heroCharmCache.get(slug)
  if (!charmSlug) return null
  return { slug: charmSlug, heroes: loadCharms()[charmSlug]!.heroes }
}

// Full localized phantimal content (name + per-skill names/levels), keyed by
// phantimal name (matches the JSON filename).
export function loadPhantimalLocales(): Record<string, PhantimalLocale> {
  if (phantimalLocalesCache) {
    return phantimalLocalesCache
  }

  const modules = import.meta.glob<PhantimalLocale>('@/locales/seasonal/phantimal/*.json', {
    eager: true,
    import: 'default',
  })
  const result: Record<string, PhantimalLocale> = {}
  Object.entries(modules).forEach(([path, content]) => {
    result[extractFileName(path)] = content
  })

  phantimalLocalesCache = result
  return result
}

// Per-artifact effect descriptions, keyed by artifact name (matches the JSON filename).
// Each entry is an ordered list of localized effect strings.
export function loadArtifactEffects(): Record<string, LocaleData[]> {
  if (artifactEffectsCache) {
    return artifactEffectsCache
  }

  const effectModules = {
    ...import.meta.glob<LocaleData[]>('@/locales/artifact/effects/*.json', {
      eager: true,
      import: 'default',
    }),
    ...import.meta.glob<LocaleData[]>('@/locales/seasonal/artifact/effects/*.json', {
      eager: true,
      import: 'default',
    }),
  }
  const result: Record<string, LocaleData[]> = {}

  Object.entries(effectModules).forEach(([path, content]) => {
    const fileName = extractFileName(path)
    result[fileName] = content
  })

  artifactEffectsCache = result
  return result
}

export function loadIcons(): Record<string, string> {
  if (iconsCache) {
    return iconsCache
  }

  const iconModules = import.meta.glob<string>('@/assets/images/icons/*.png', {
    query: { format: 'webp', quality: 80, w: 100 },
    eager: true,
    import: 'default',
  })
  const icons = loadAssetsDict(iconModules)

  iconsCache = icons
  return icons
}

export function getCharacterRanges(): Map<number, number> {
  if (!characterRangesCache) {
    // Ensure characters are loaded first
    loadCharacters()
  }
  return characterRangesCache!
}

export function loadAllData() {
  const characters = loadCharacters()
  const artifacts = loadArtifacts()
  const phantimals = loadPhantimals()
  const characterImages = loadCharacterImages()
  const artifactImages = loadArtifactImages()
  const icons = loadIcons()
  const artifactEffects = loadArtifactEffects()

  return {
    characters,
    artifacts,
    phantimals,
    characterImages,
    artifactImages,
    icons,
    artifactEffects,
    characterRanges: getCharacterRanges(),
  }
}

// Module-level cache for locales
let appLocalesCache: Record<string, LocaleData> | null = null
let characterLocalesCache: Record<string, LocaleData> | null = null
let artifactLocalesCache: Record<string, LocaleData> | null = null
let gameLocalesCache: Record<string, LocaleData> | null = null

// import.meta.glob needs a literal pattern, so each loader globs its own directory
// and passes the modules in rather than this helper globbing them.
function buildLocaleDict(modules: Record<string, LocaleData>): Record<string, LocaleData> {
  const result: Record<string, LocaleData> = {}
  for (const [path, content] of Object.entries(modules)) {
    const key = extractFileName(path)
    if (key in result) {
      console.warn(`Duplicate locale key "${key}" (from ${path}); overwriting earlier entry.`)
    }
    result[key] = content
  }
  return result
}

export function loadAppLocales(): Record<string, LocaleData> {
  if (appLocalesCache) return appLocalesCache
  // `**` includes subfolders, but `app` keys stay flat (filename only): it's the
  // global namespace, with some keys resolved dynamically as `app.<key>`, so
  // folders are organization only.
  appLocalesCache = buildLocaleDict(
    import.meta.glob<LocaleData>('@/locales/app/**/*.json', { eager: true, import: 'default' }),
  )
  return appLocalesCache
}

export function loadCharacterLocales(): Record<string, LocaleData> {
  if (characterLocalesCache) return characterLocalesCache
  characterLocalesCache = buildLocaleDict(
    import.meta.glob<LocaleData>('@/locales/character/*.json', {
      eager: true,
      import: 'default',
    }),
  )
  return characterLocalesCache
}

export function loadArtifactLocales(): Record<string, LocaleData> {
  if (artifactLocalesCache) return artifactLocalesCache
  artifactLocalesCache = buildLocaleDict({
    ...import.meta.glob<LocaleData>('@/locales/artifact/*.json', {
      eager: true,
      import: 'default',
    }),
    ...import.meta.glob<LocaleData>('@/locales/seasonal/artifact/*.json', {
      eager: true,
      import: 'default',
    }),
  })
  return artifactLocalesCache
}

// The locale dirs carry reserved underscore-prefixed files beside the hero
// files. They ride the same globs and chunks, but are split out at load time
// so dict consumers (the search index, slug walks) only ever see hero entries.
// The glob types every module as SkillLocaleFile, hence the cast.
function splitSkillDict(dict: Record<string, SkillLocaleFile>): SkillLanguage {
  const reserved = dict as unknown as {
    _terms: SkillTerms
    _keywords?: SkillKeywords
    _charms?: SkillCharms
  }
  return {
    heroes: Object.fromEntries(Object.entries(dict).filter(([key]) => !key.startsWith('_'))),
    terms: reserved._terms,
    keywords: reserved._keywords ?? {},
    charms: reserved._charms ?? null,
  }
}

// Skill text ships as one lazy chunk per language, so no page downloads a
// language it does not show: each locale dir holds an importer-emitted
// index.ts whose eager same-dir glob inlines that dir's JSON into a single
// chunk. Loading is promise-cached per locale; the route warm-up guard, the
// skill modal, the search index and the app's background fetch of the
// reader's language all share it.
const skillLocaleChunks = import.meta.glob<Record<string, SkillLocaleFile>>(
  '@/locales/skill/*/index.ts',
  { import: 'default' },
)
// Reactive so whatever was computed before a language arrived re-renders when
// it lands. Shallow: the text itself never changes.
const warmedSkillLocales = shallowReactive(new Map<SkillLocale, SkillLanguage>())
const skillLocalePromises = new Map<SkillLocale, Promise<SkillLanguage>>()

export function loadSkillLocale(lang: SkillLocale): Promise<SkillLanguage> {
  const pending = skillLocalePromises.get(lang)
  if (pending) return pending
  const loader = skillLocaleChunks[`/src/locales/skill/${lang}/index.ts`]
  if (!loader) return Promise.reject(new Error(`No skill locale chunk for "${lang}"`))
  const promise = loader().then((dict) => {
    const language = splitSkillDict(dict)
    warmedSkillLocales.set(lang, language)
    return language
  })
  // A failed load is dropped so the next call asks again. Chrome remembers a
  // failed import and repeats the failure until the page is reloaded.
  promise.catch(() => skillLocalePromises.delete(lang))
  skillLocalePromises.set(lang, promise)
  return promise
}

/** Sync read of a language; null until loadSkillLocale has resolved. Page
 * loads are warmed by the skill route's guard; the modal and search await
 * loadSkillLocale explicitly. */
export function getSkillLanguage(lang: SkillLocale): SkillLanguage | null {
  return warmedSkillLocales.get(lang) ?? null
}

/** Sync read of a language's hero dict; null until the locale is warmed. */
export function getSkillLocaleDict(lang: SkillLocale): Record<string, SkillLocaleFile> | null {
  return getSkillLanguage(lang)?.heroes ?? null
}

/** Sync read of one hero's file; null until the locale is warmed. */
export function getSkillFile(lang: SkillLocale, slug: string): SkillLocaleFile | null {
  return getSkillLanguage(lang)?.heroes[slug] ?? null
}

/** A hero's per-slot cooldowns and ranges; language-independent, so one eager
 * file serves every skill language. */
export function getSkillNumbers(slug: string): SkillNumbers[string] {
  return (skillNumbers as SkillNumbers)[slug] ?? {}
}

/** Sync read of a language's seasonal charm text (`_charms.json`); null until
 * the locale is warmed, and always null once charms are retired. */
export function getSkillCharms(lang: SkillLocale): SkillCharms | null {
  return getSkillLanguage(lang)?.charms ?? null
}

const SKILL_HEROES: ReadonlySet<string> = new Set(skillHeroes)

/** True iff the importer wrote skill text for `slug`, read from its hero list
 * so the answer needs no language loaded. Gates the surfaces where a missing
 * locale would surface a dead link (the info button, the modal, the reader's
 * visibleSlug) so a character JSON without a matching locale file degrades
 * gracefully. Coverage across languages is asserted at import time (every
 * locale's slug set equals en's), so one list answers for all 16 locales. */
export function hasSkillLocale(slug: string): boolean {
  return SKILL_HEROES.has(slug)
}

export function loadGameLocales(): Record<string, LocaleData> {
  if (gameLocalesCache) return gameLocalesCache
  gameLocalesCache = buildLocaleDict(
    import.meta.glob<LocaleData>('@/locales/game/*.json', { eager: true, import: 'default' }),
  )
  return gameLocalesCache
}

export function loadAllLocales(): LocaleDictionary {
  return {
    app: loadAppLocales(),
    character: loadCharacterLocales(),
    artifact: loadArtifactLocales(),
    game: loadGameLocales(),
  }
}
