import { reactive } from 'vue'

import type { ArtifactType } from '@/lib/types/artifact'
import type { CharacterType } from '@/lib/types/character'
import {
  isAppLocale,
  type AppLocale,
  type LocaleData,
  type LocaleDictionary,
  type SkillLocale,
} from '@/lib/types/i18n'
import type { PhantimalLocale, PhantimalType } from '@/lib/types/phantimal'
import type { CharmData, SkillCharms, SkillKeywords, SkillLocaleFile } from '@/lib/types/skill'

export interface ArenaJson {
  name: string
  grid: {
    ally: number[]
    enemy: number[]
    blocked: number[]
    breakable: number[]
  }
}

function extractFileName(path: string, removeExtension = true): string {
  const fileName = path.split('/').pop() || 'Unknown'
  return removeExtension ? fileName.replace(/\.\w+$/, '') : fileName
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
let characterImagesCache: Record<string, string> | null = null
let artifactImagesCache: Record<string, string> | null = null
let iconsCache: Record<string, string> | null = null
let characterRangesCache: Map<number, number> | null = null
let arenasCache: Record<string, ArenaJson> | null = null
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
  const characters = Object.values(characterModules)

  charactersCache = characters

  // Build character ranges map
  characterRangesCache = new Map<number, number>()
  characters.forEach((char) => {
    characterRangesCache!.set(char.id, char.range)
  })

  return characters
}

export function loadArtifacts(): ArtifactType[] {
  if (artifactsCache) {
    return artifactsCache
  }

  const artifactModules = import.meta.glob<ArtifactType>('@/data/artifact/*.json', {
    eager: true,
    import: 'default',
  })
  const artifacts = Object.values(artifactModules).sort((a, b) => a.name.localeCompare(b.name))

  artifactsCache = artifacts
  return artifacts
}

export function loadCharacterImages(): Record<string, string> {
  if (characterImagesCache) {
    return characterImagesCache
  }

  const imageModules = import.meta.glob<string>('@/assets/images/character/*.png', {
    query: { format: 'webp', quality: 80, w: 100, h: 135, fit: 'cover', position: 'bottom' },
    eager: true,
    import: 'default',
  })
  const images = loadAssetsDict(imageModules)

  characterImagesCache = images
  return images
}

export function loadArtifactImages(): Record<string, string> {
  if (artifactImagesCache) {
    return artifactImagesCache
  }

  const imageModules = import.meta.glob<string>('@/assets/images/artifact/*.png', {
    query: { format: 'webp', quality: 80, w: 100 },
    eager: true,
    import: 'default',
  })
  const images = loadAssetsDict(imageModules)

  artifactImagesCache = images
  return images
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

/** Seasonal charm registry: charm slug → the roster heroes sharing it. The
 * dir holds one generated file; after seasonal removal the unmatched glob
 * compiles to an empty module map, so this degrades to {}. */
export function loadCharms(): CharmData {
  if (charmsCache) return charmsCache
  const modules = import.meta.glob<CharmData>('@/data/seasonal/charm/*.json', {
    eager: true,
    import: 'default',
  })
  charmsCache = Object.values(modules).reduce<CharmData>((acc, m) => ({ ...acc, ...m }), {})
  return charmsCache
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

export function loadArenas(): Record<string, ArenaJson> {
  if (arenasCache) {
    return arenasCache
  }

  const arenaModules = import.meta.glob<ArenaJson>('@/data/arena/*.json', {
    eager: true,
    import: 'default',
  })
  const result: Record<string, ArenaJson> = {}

  Object.entries(arenaModules)
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .forEach(([path, content]) => {
      const fileName = extractFileName(path)
      result[fileName] = content
    })

  arenasCache = result
  return result
}

// Per-artifact effect descriptions, keyed by artifact name (matches the JSON filename).
// Each entry is an ordered list of localized effect strings.
export function loadArtifactEffects(): Record<string, LocaleData[]> {
  if (artifactEffectsCache) {
    return artifactEffectsCache
  }

  const effectModules = import.meta.glob<LocaleData[]>('@/locales/artifact/effects/*.json', {
    eager: true,
    import: 'default',
  })
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
  const arenas = loadArenas()
  const characterImages = loadCharacterImages()
  const artifactImages = loadArtifactImages()
  const icons = loadIcons()
  const artifactEffects = loadArtifactEffects()

  return {
    characters,
    artifacts,
    phantimals,
    arenas,
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
let wandwarsLocalesCache: Record<string, LocaleData> | null = null
let skillLocalesCache: Record<AppLocale, Record<string, SkillLocaleFile>> | null = null

// Vite's import.meta.glob requires a string literal for the pattern, so the glob calls
// can't be parameterized, but the post-processing (filename → key) can.
function buildLocaleDict<T = LocaleData>(
  modules: Record<string, T>,
  keyFn: (path: string) => string = extractFileName,
): Record<string, T> {
  const result: Record<string, T> = {}
  for (const [path, content] of Object.entries(modules)) {
    const key = keyFn(path)
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
  // folders are organization only. (WandWars instead prefixes keys by folder, in
  // loadWandWarsLocales, to avoid collisions across its messages/ subfolder.)
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
  artifactLocalesCache = buildLocaleDict(
    import.meta.glob<LocaleData>('@/locales/artifact/*.json', {
      eager: true,
      import: 'default',
    }),
  )
  return artifactLocalesCache
}

// The locale dirs carry reserved underscore-prefixed files beside the hero
// files (the `_keywords` glossary, the `_charms` seasonal charm text). They
// ride the same globs and chunks, but are split out at load time so dict
// consumers (the search index, slug walks) only ever see hero entries. The
// glob types every module as SkillLocaleFile, hence the casts here.
function splitSkillDict(dict: Record<string, SkillLocaleFile>): {
  heroes: Record<string, SkillLocaleFile>
  keywords: SkillKeywords
  charms: SkillCharms | null
} {
  const heroes: Record<string, SkillLocaleFile> = {}
  let keywords: SkillKeywords = {}
  let charms: SkillCharms | null = null
  for (const [key, value] of Object.entries(dict)) {
    if (key === '_keywords') keywords = value as unknown as SkillKeywords
    else if (key === '_charms') charms = value as unknown as SkillCharms
    else if (!key.startsWith('_')) heroes[key] = value
  }
  return { heroes, keywords, charms }
}

let skillKeywordsCache: Record<AppLocale, SkillKeywords> | null = null
let skillCharmsCache: Record<AppLocale, SkillCharms | null> | null = null

/** Per-language skill text for the app locales (en/zh), keyed by character
 * slug (filename basename). Eager: the search index, the guide panels, and
 * the en fallback all read it synchronously. */
export function loadSkillLocales(): Record<AppLocale, Record<string, SkillLocaleFile>> {
  if (skillLocalesCache) return skillLocalesCache
  const en = splitSkillDict(
    buildLocaleDict<SkillLocaleFile>(
      import.meta.glob<SkillLocaleFile>('@/locales/skill/en/*.json', {
        eager: true,
        import: 'default',
      }),
    ),
  )
  const zh = splitSkillDict(
    buildLocaleDict<SkillLocaleFile>(
      import.meta.glob<SkillLocaleFile>('@/locales/skill/zh/*.json', {
        eager: true,
        import: 'default',
      }),
    ),
  )
  skillLocalesCache = { en: en.heroes, zh: zh.heroes }
  skillKeywordsCache = { en: en.keywords, zh: zh.keywords }
  skillCharmsCache = { en: en.charms, zh: zh.charms }
  return skillLocalesCache
}

// Non-app skill locales ship as one lazy chunk per language: each locale dir
// holds an importer-emitted index.ts whose eager same-dir glob inlines that
// dir's JSON into a single chunk. Loading is promise-cached per locale; the
// route warm-up guard, the skill modal, and the search index all share it.
const skillLocaleChunks = import.meta.glob<Record<string, SkillLocaleFile>>(
  '@/locales/skill/*/index.ts',
  { import: 'default' },
)
// Reactive so a chunk that arrives after a failed warm-up (offline first
// load, later retried by search) re-renders anything computed from it.
const warmedSkillLocales = reactive(new Map<SkillLocale, Record<string, SkillLocaleFile>>())
const warmedSkillKeywords = reactive(new Map<SkillLocale, SkillKeywords>())
const warmedSkillCharms = reactive(new Map<SkillLocale, SkillCharms>())
const skillLocalePromises = new Map<SkillLocale, Promise<Record<string, SkillLocaleFile>>>()

export function loadSkillLocale(lang: SkillLocale): Promise<Record<string, SkillLocaleFile>> {
  if (isAppLocale(lang)) return Promise.resolve(loadSkillLocales()[lang])
  const pending = skillLocalePromises.get(lang)
  if (pending) return pending
  const loader = skillLocaleChunks[`/src/locales/skill/${lang}/index.ts`]
  if (!loader) return Promise.reject(new Error(`No skill locale chunk for "${lang}"`))
  const promise = loader().then((dict) => {
    const { heroes, keywords, charms } = splitSkillDict(dict)
    warmedSkillLocales.set(lang, heroes)
    warmedSkillKeywords.set(lang, keywords)
    if (charms) warmedSkillCharms.set(lang, charms)
    return heroes
  })
  // A failed fetch must not poison the cache; the next call retries.
  promise.catch(() => skillLocalePromises.delete(lang))
  skillLocalePromises.set(lang, promise)
  return promise
}

/** Sync read of a language's hero dict; null until loadSkillLocale has
 * resolved. en/zh are always warm (eager). */
export function getSkillLocaleDict(lang: SkillLocale): Record<string, SkillLocaleFile> | null {
  if (isAppLocale(lang)) return loadSkillLocales()[lang]
  return warmedSkillLocales.get(lang) ?? null
}

/** Sync read of one hero's file; null until the locale is warmed. Page loads
 * are warmed by the skill route's guard; the modal and search await
 * loadSkillLocale explicitly. */
export function getSkillFile(lang: SkillLocale, slug: string): SkillLocaleFile | null {
  return getSkillLocaleDict(lang)?.[slug] ?? null
}

/** Sync read of a language's keyword glossary (tooltip text for the
 * `[[label|key]]` tokens in skill text); null until the locale is warmed.
 * en/zh are always warm (eager). */
export function getSkillKeywords(lang: SkillLocale): SkillKeywords | null {
  if (isAppLocale(lang)) {
    loadSkillLocales()
    return skillKeywordsCache![lang]
  }
  return warmedSkillKeywords.get(lang) ?? null
}

/** Sync read of a language's seasonal charm text (`_charms.json`); null until
 * the locale is warmed, and always null once charms are retired. en/zh are
 * always warm (eager). */
export function getSkillCharms(lang: SkillLocale): SkillCharms | null {
  if (isAppLocale(lang)) {
    loadSkillLocales()
    return skillCharmsCache![lang]
  }
  return warmedSkillCharms.get(lang) ?? null
}

/** True iff the importer has produced an `en` locale file for `slug`. Gates
 * the surfaces where a missing locale would surface a dead link (the info
 * button, the modal, the reader's visibleSlug) so a character JSON without a
 * matching locale file degrades gracefully. Coverage across languages is
 * asserted at import time (every locale's slug set equals en's), so en
 * presence answers for all 16 locales. */
export function hasSkillLocale(slug: string): boolean {
  return !!loadSkillLocales().en[slug]
}

export function loadGameLocales(): Record<string, LocaleData> {
  if (gameLocalesCache) return gameLocalesCache
  gameLocalesCache = buildLocaleDict(
    import.meta.glob<LocaleData>('@/locales/game/*.json', { eager: true, import: 'default' }),
  )
  return gameLocalesCache
}

export function loadWandWarsLocales(): Record<string, LocaleData> {
  if (wandwarsLocalesCache) return wandwarsLocalesCache
  wandwarsLocalesCache = buildLocaleDict(
    import.meta.glob<LocaleData>('@/locales/wandwars/**/*.json', {
      eager: true,
      import: 'default',
    }),
    // Files in subfolders (e.g., messages/) are prefixed with the folder name.
    (path) => {
      const parts = path.split('/')
      const folder = parts[parts.length - 2]
      const fileName = extractFileName(path)
      return folder === 'wandwars' ? fileName : `${folder}/${fileName}`
    },
  )
  return wandwarsLocalesCache
}

export function loadAllLocales(): LocaleDictionary {
  return {
    app: loadAppLocales(),
    character: loadCharacterLocales(),
    artifact: loadArtifactLocales(),
    game: loadGameLocales(),
    wandwars: loadWandWarsLocales(),
  }
}
