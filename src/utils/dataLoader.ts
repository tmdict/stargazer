import type { ArtifactType } from '@/lib/types/artifact'
import type { CharacterType } from '@/lib/types/character'
import type { LocaleData, LocaleDictionary } from '@/lib/types/i18n'

export interface ArenaJson {
  name: string
  grid: {
    ally: number[]
    enemy: number[]
    blocked: number[]
    breakable: number[]
  }
}

export function extractFileName(path: string, removeExtension = true): string {
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
  const arenas = loadArenas()
  const characterImages = loadCharacterImages()
  const artifactImages = loadArtifactImages()
  const icons = loadIcons()
  const artifactEffects = loadArtifactEffects()

  return {
    characters,
    artifacts,
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

// Vite's import.meta.glob requires a string literal for the pattern, so the glob calls
// can't be parameterized — but the post-processing (filename → key) can.
function buildLocaleDict(
  modules: Record<string, LocaleData>,
  keyFn: (path: string) => string = extractFileName,
): Record<string, LocaleData> {
  const result: Record<string, LocaleData> = {}
  for (const [path, content] of Object.entries(modules)) {
    result[keyFn(path)] = content
  }
  return result
}

export function loadAppLocales(): Record<string, LocaleData> {
  if (appLocalesCache) return appLocalesCache
  appLocalesCache = buildLocaleDict(
    import.meta.glob<LocaleData>('@/locales/app/*.json', { eager: true, import: 'default' }),
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

export function clearCache() {
  charactersCache = null
  artifactsCache = null
  characterImagesCache = null
  artifactImagesCache = null
  iconsCache = null
  characterRangesCache = null
  arenasCache = null
  appLocalesCache = null
  characterLocalesCache = null
  artifactLocalesCache = null
  gameLocalesCache = null
  wandwarsLocalesCache = null
  artifactEffectsCache = null
}
