import { shallowReactive } from 'vue'

import { outfitOf } from '@/lib/characters/outfit'
import { PLACEHOLDERS } from '@/lib/characters/placeholder'
import type { ArtifactType } from '@/lib/types/artifact'
import type { CharacterType } from '@/lib/types/character'
import type { LocaleData, LocaleDictionary, SkillLocale } from '@/lib/types/i18n'
import type { PhantimalType } from '@/lib/types/phantimal'
import type {
  CharmData,
  SkillArtifacts,
  SkillCharms,
  SkillKeywords,
  SkillLanguage,
  SkillLocaleFile,
  SkillNumbers,
  SkillPhantimals,
  SkillTerms,
  TagAttachment,
} from '@/lib/types/skill'
import skillNumbers from '@/pack/text/skill/numbers.json'
import { artifactImages, characterImages, outfitImages } from './imageAssets'

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
let phantimalsCache: PhantimalType[] | null = null

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

// Each picture's first outfit at the portraits' display size, keyed by the
// picture (a hero's portrait under its slug). The glob lists names as text,
// where -skin10 comes before -skin2.
function loadOutfitImages(): Record<string, string> {
  const outfits: Record<string, string> = {}
  const byNumber = Object.entries(outfitImages).sort(([a], [b]) =>
    a.localeCompare(b, 'en', { numeric: true }),
  )
  for (const [name, url] of byNumber) {
    const picture = outfitOf(name)
    if (picture) outfits[picture] ??= url
  }
  return outfits
}

// Portraits and phantimals at the art's own width for the screenshot import's
// matcher, loaded on demand: the 100 px picker thumbnails lose the face detail
// the matcher needs. Keyed by unit name.
export function loadMatcherPortraits(): Record<string, () => Promise<string>> {
  const modules = import.meta.glob<string>(
    [
      '@/pack/images/character/*.png',
      '@/pack/images/seasonal/phantimal/*.png',
      '!@/pack/images/character/*-skin[0-9]*.png',
    ],
    { query: { format: 'webp', quality: 85, w: 180 }, import: 'default' },
  )
  return loadAssetsDict(modules)
}

// The paragon frames by name (p0 … p4-crown) and each picture's outfits, for
// the screenshot import. Both are encoded at the settings the import's matching
// was tuned on.
export function loadImportFrames(): Record<string, () => Promise<string>> {
  const modules = import.meta.glob<string>('@/pack/screenshot-import/frame-*.png', {
    query: { format: 'webp', quality: 90, effort: 6 },
    import: 'default',
  })
  return Object.fromEntries(
    Object.entries(modules).map(([path, load]) => [
      extractFileName(path).slice('frame-'.length),
      load,
    ]),
  )
}

export function loadOutfitPortraits(): Record<string, (() => Promise<string>)[]> {
  const modules = import.meta.glob<string>('@/pack/images/character/*-skin[0-9]*.png', {
    query: { format: 'webp', quality: 90, effort: 6 },
    import: 'default',
  })
  const outfits: Record<string, (() => Promise<string>)[]> = {}
  for (const [path, load] of Object.entries(modules)) {
    const picture = outfitOf(extractFileName(path))
    if (picture) (outfits[picture] ??= []).push(load)
  }
  return outfits
}

function loadArtifactImages(): Record<string, string> {
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

let heroCharmCache: Map<string, CharmData> | null = null

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

/** The charm a hero shares, with the full sharer list; null when the hero has
 * none (or charms are retired, which leaves the glob matching no file). */
export function getCharmForHero(slug: string): CharmData | null {
  if (!heroCharmCache) {
    heroCharmCache = new Map()
    const modules = import.meta.glob<CharmData>('@/data/seasonal/charm/*.json', {
      eager: true,
      import: 'default',
    })
    for (const charm of Object.values(modules)) {
      for (const hero of charm.heroes) heroCharmCache.set(hero, charm)
    }
  }
  return heroCharmCache.get(slug) ?? null
}

function loadIcons(): Record<string, string> {
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

function getCharacterRanges(): Map<number, number> {
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
  const outfitImages = loadOutfitImages()
  const artifactImages = loadArtifactImages()
  const icons = loadIcons()

  return {
    characters,
    artifacts,
    phantimals,
    characterImages,
    outfitImages,
    artifactImages,
    icons,
    characterRanges: getCharacterRanges(),
  }
}

// Module-level cache for locales
let appLocalesCache: Record<string, LocaleData> | null = null
let characterLocalesCache: Record<string, LocaleData> | null = null
let artifactLocalesCache: Record<string, LocaleData> | null = null
let phantimalLocalesCache: Record<string, LocaleData> | null = null
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

export function loadPhantimalLocales(): Record<string, LocaleData> {
  if (phantimalLocalesCache) return phantimalLocalesCache
  phantimalLocalesCache = buildLocaleDict(
    import.meta.glob<LocaleData>('@/locales/seasonal/phantimal/*.json', {
      eager: true,
      import: 'default',
    }),
  )
  return phantimalLocalesCache
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
    _artifacts?: SkillArtifacts
    _phantimals?: SkillPhantimals
  }
  return {
    heroes: Object.fromEntries(Object.entries(dict).filter(([key]) => !key.startsWith('_'))),
    terms: reserved._terms,
    keywords: reserved._keywords ?? {},
    charms: reserved._charms ?? null,
    artifacts: reserved._artifacts ?? {},
    phantimals: reserved._phantimals ?? {},
  }
}

// Skill text ships as one lazy chunk per language, so no page downloads a
// language it does not show: each language folder holds an index.ts, written
// by npm run data, whose eager same-folder glob inlines that folder's JSON
// into a single chunk. Loading is promise-cached per locale; the route warm-up
// guard, the skill modal, the search index and the app's background fetch of
// the reader's language all share it.
const skillLocaleChunks = import.meta.glob<Record<string, SkillLocaleFile>>(
  '@/pack/text/skill/*/index.ts',
  { import: 'default' },
)
// Reactive so whatever was computed before a language arrived re-renders when
// it lands. Shallow: the text itself never changes.
const warmedSkillLocales = shallowReactive(new Map<SkillLocale, SkillLanguage>())
const skillLocalePromises = new Map<SkillLocale, Promise<SkillLanguage>>()

export function loadSkillLocale(lang: SkillLocale): Promise<SkillLanguage> {
  const pending = skillLocalePromises.get(lang)
  if (pending) return pending
  const loader = skillLocaleChunks[`/src/pack/text/skill/${lang}/index.ts`]
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

const SKILL_HEROES: ReadonlySet<string> = new Set(
  Object.keys(
    import.meta.glob(['@/pack/text/skill/en/*.json', '!@/pack/text/skill/en/_*.json']),
  ).map(extractFileName),
)

/** True iff the pack holds skill text for `slug`, from the English file names
 * so the answer needs no language loaded. Gates the surfaces where a missing
 * locale would surface a dead link (the info button, the modal, the reader's
 * visibleSlug) so a character JSON without a matching locale file degrades
 * gracefully. A build stops unless every language holds the same heroes as
 * English, so one list answers for all 16 locales. */
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
