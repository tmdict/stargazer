import type { ArtifactType } from '../lib/types/artifact'
import type { CharacterType, TagType } from '../lib/types/character'
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
let tagsCache: TagType[] | null = null
let characterImagesCache: Record<string, string> | null = null
let artifactImagesCache: Record<string, string> | null = null
let iconsCache: Record<string, string> | null = null
let characterRangesCache: Map<number, number> | null = null

export function loadCharacters(): CharacterType[] {
  if (charactersCache) {
    return charactersCache
  }

  const characterModules = import.meta.glob<CharacterType>('../data/character/*.json', {
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

  const artifactModules = import.meta.glob<ArtifactType>('../data/artifact/*.json', {
    eager: true,
    import: 'default',
  })
  const artifacts = Object.values(artifactModules).sort((a, b) => a.name.localeCompare(b.name))

  artifactsCache = artifacts
  return artifacts
}

export function loadTags(): TagType[] {
  if (tagsCache) {
    return tagsCache
  }

  const tagModules = import.meta.glob<TagType>('../data/tags/*.json', {
    eager: true,
    import: 'default',
  })
  const tags = Object.values(tagModules).sort((a, b) => a.name.localeCompare(b.name))

  tagsCache = tags
  return tags
}

export function loadCharacterImages(): Record<string, string> {
  if (characterImagesCache) {
    return characterImagesCache
  }

  const imageModules = import.meta.glob<string>('../assets/images/character/*.png', {
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

  const imageModules = import.meta.glob<string>('../assets/images/artifact/*.png', {
    query: { format: 'webp', quality: 80, w: 100 },
    eager: true,
    import: 'default',
  })
  const images = loadAssetsDict(imageModules)

  artifactImagesCache = images
  return images
}

export function loadIcons(): Record<string, string> {
  if (iconsCache) {
    return iconsCache
  }

  const iconModules = import.meta.glob<string>('../assets/images/icons/*.png', {
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

  const localeModules = import.meta.glob<LocaleData>('../locales/app/*.json', {
    eager: true,
    import: 'default',
  })
  const result: Record<string, LocaleData> = {}

  Object.entries(localeModules).forEach(([path, content]) => {
    const fileName = extractFileName(path)
    result[fileName] = content
  })

  appLocalesCache = result
  return result
}

export function loadCharacterLocales(): Record<string, LocaleData> {
  if (characterLocalesCache) {
    return characterLocalesCache
  }

  const localeModules = import.meta.glob<LocaleData>('../locales/character/*.json', {
    eager: true,
    import: 'default',
  })
  const result: Record<string, LocaleData> = {}

  Object.entries(localeModules).forEach(([path, content]) => {
    const fileName = extractFileName(path)
    result[fileName] = content
  })

  characterLocalesCache = result
  return result
}

export function loadArtifactLocales(): Record<string, LocaleData> {
  if (artifactLocalesCache) {
    return artifactLocalesCache
  }

  const localeModules = import.meta.glob<LocaleData>('../locales/artifact/*.json', {
    eager: true,
    import: 'default',
  })
  const result: Record<string, LocaleData> = {}

  Object.entries(localeModules).forEach(([path, content]) => {
    const fileName = extractFileName(path)
    result[fileName] = content
  })

  artifactLocalesCache = result
  return result
}

export function loadGameLocales(): Record<string, LocaleData> {
  if (gameLocalesCache) {
    return gameLocalesCache
  }

  const localeModules = import.meta.glob<LocaleData>('../locales/game/*.json', {
    eager: true,
    import: 'default',
  })
  const result: Record<string, LocaleData> = {}

  Object.entries(localeModules).forEach(([path, content]) => {
    const fileName = extractFileName(path)
    result[fileName] = content
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
  tagsCache = null
  characterImagesCache = null
  artifactImagesCache = null
  iconsCache = null
  characterRangesCache = null
  appLocalesCache = null
  characterLocalesCache = null
  artifactLocalesCache = null
  gameLocalesCache = null
}
