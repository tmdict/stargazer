import type { CharacterType } from '../lib/types/character'
import type { ArtifactType } from '../lib/types/artifact'
import type { LocaleData, LocaleDictionary } from '../lib/types/i18n'

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

export function loadCharacters(): CharacterType[] {
  if (charactersCache) {
    return charactersCache
  }

  const characters = Object.values(
    import.meta.glob('../data/character/*.json', { eager: true, import: 'default' }),
  ) as CharacterType[]

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

  const artifacts = (
    Object.values(
      import.meta.glob('../data/artifact/*.json', { eager: true, import: 'default' }),
    ) as ArtifactType[]
  ).sort((a, b) => a.name.localeCompare(b.name))

  artifactsCache = artifacts
  return artifacts
}

export function loadCharacterImages(): Record<string, string> {
  if (characterImagesCache) {
    return characterImagesCache
  }

  const images = loadAssetsDict(
    import.meta.glob('../assets/images/character/*.png', {
      query: { format: 'webp', quality: 80, w: 100 },
      eager: true,
      import: 'default',
    }) as Record<string, string>,
  )

  characterImagesCache = images
  return images
}

export function loadArtifactImages(): Record<string, string> {
  if (artifactImagesCache) {
    return artifactImagesCache
  }

  const images = loadAssetsDict(
    import.meta.glob('../assets/images/artifact/*.png', {
      query: { format: 'webp', quality: 80, w: 100 },
      eager: true,
      import: 'default',
    }) as Record<string, string>,
  )

  artifactImagesCache = images
  return images
}

export function loadIcons(): Record<string, string> {
  if (iconsCache) {
    return iconsCache
  }

  const icons = loadAssetsDict(
    import.meta.glob('../assets/images/icons/*.png', {
      query: { format: 'webp', quality: 80, w: 100 },
      eager: true,
      import: 'default',
    }) as Record<string, string>,
  )

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
  const characterImages = loadCharacterImages()
  const artifactImages = loadArtifactImages()
  const icons = loadIcons()

  return {
    characters,
    artifacts,
    characterImages,
    artifactImages,
    icons,
    characterRanges: getCharacterRanges(),
  }
}

// Module-level cache for locales
let appLocalesCache: Record<string, LocaleData> | null = null
let characterLocalesCache: Record<string, LocaleData> | null = null
let artifactLocalesCache: Record<string, LocaleData> | null = null
let gameLocalesCache: Record<string, LocaleData> | null = null

export function loadAppLocales(): Record<string, LocaleData> {
  if (appLocalesCache) {
    return appLocalesCache
  }

  const locales = import.meta.glob('../locales/app/*.json', { eager: true, import: 'default' })
  const result: Record<string, LocaleData> = {}

  Object.entries(locales).forEach(([path, content]) => {
    const fileName = extractFileName(path)
    result[fileName] = content as LocaleData
  })

  appLocalesCache = result
  return result
}

export function loadCharacterLocales(): Record<string, LocaleData> {
  if (characterLocalesCache) {
    return characterLocalesCache
  }

  const locales = import.meta.glob('../locales/character/*.json', {
    eager: true,
    import: 'default',
  })
  const result: Record<string, LocaleData> = {}

  Object.entries(locales).forEach(([path, content]) => {
    const fileName = extractFileName(path)
    result[fileName] = content as LocaleData
  })

  characterLocalesCache = result
  return result
}

export function loadArtifactLocales(): Record<string, LocaleData> {
  if (artifactLocalesCache) {
    return artifactLocalesCache
  }

  const locales = import.meta.glob('../locales/artifact/*.json', { eager: true, import: 'default' })
  const result: Record<string, LocaleData> = {}

  Object.entries(locales).forEach(([path, content]) => {
    const fileName = extractFileName(path)
    result[fileName] = content as LocaleData
  })

  artifactLocalesCache = result
  return result
}

export function loadGameLocales(): Record<string, LocaleData> {
  if (gameLocalesCache) {
    return gameLocalesCache
  }

  const locales = import.meta.glob('../locales/game/*.json', { eager: true, import: 'default' })
  const result: Record<string, LocaleData> = {}

  Object.entries(locales).forEach(([path, content]) => {
    const fileName = extractFileName(path)
    result[fileName] = content as LocaleData
  })

  gameLocalesCache = result
  return result
}

export function loadAllLocales(): LocaleDictionary {
  return {
    app: loadAppLocales(),
    character: loadCharacterLocales(),
    artifact: loadArtifactLocales(),
    game: loadGameLocales(),
  }
}

export function clearCache() {
  charactersCache = null
  artifactsCache = null
  characterImagesCache = null
  artifactImagesCache = null
  iconsCache = null
  characterRangesCache = null
  appLocalesCache = null
  characterLocalesCache = null
  artifactLocalesCache = null
  gameLocalesCache = null
}
