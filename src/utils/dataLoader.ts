import type { ArtifactType } from '@/lib/types/artifact'
import type { CharacterType } from '@/lib/types/character'
import type { Locale, LocaleData, LocaleDictionary } from '@/lib/types/i18n'
import type { PhantimalLocale, PhantimalType } from '@/lib/types/phantimal'
import type { SkillLocaleFile } from '@/lib/types/skill'

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
let skillLocalesCache: Record<Locale, Record<string, SkillLocaleFile>> | null = null

// Vite's import.meta.glob requires a string literal for the pattern, so the glob calls
// can't be parameterized — but the post-processing (filename → key) can.
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
  // folders are organization only. (WandWars instead prefixes keys by folder — see
  // loadWandWarsLocales — to avoid collisions across its messages/ and insights/.)
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

/** Per-language skill text, keyed by character slug (filename basename). */
export function loadSkillLocales(): Record<Locale, Record<string, SkillLocaleFile>> {
  if (skillLocalesCache) return skillLocalesCache
  skillLocalesCache = {
    en: buildLocaleDict<SkillLocaleFile>(
      import.meta.glob<SkillLocaleFile>('@/locales/skill/en/*.json', {
        eager: true,
        import: 'default',
      }),
    ),
    zh: buildLocaleDict<SkillLocaleFile>(
      import.meta.glob<SkillLocaleFile>('@/locales/skill/zh/*.json', {
        eager: true,
        import: 'default',
      }),
    ),
  }
  return skillLocalesCache
}

/** True iff the importer has produced an `en` locale file for `slug`. Used as
 * a UI gate (info button / route validator) so a character JSON without a
 * matching locale file doesn't surface a dead modal or route. */
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
    // Files in subfolders (e.g., messages/, insights/) are prefixed with the folder name.
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
