// The site's dictionaries under src/locales/, one per namespace and each built
// once, keyed by file name.

import type { LocaleData, LocaleDictionary } from '@/lib/types/i18n'
import { fileStem } from './fileStem'

let appLocales: Record<string, LocaleData> | null = null
let characterLocales: Record<string, LocaleData> | null = null
let artifactLocales: Record<string, LocaleData> | null = null
let phantimalLocales: Record<string, LocaleData> | null = null
let gameLocales: Record<string, LocaleData> | null = null
let buffLocales: Record<string, LocaleData> | null = null

// import.meta.glob needs a literal pattern, so each loader globs its own directory
// and passes the modules in rather than this helper globbing them.
function buildLocaleDict(modules: Record<string, LocaleData>): Record<string, LocaleData> {
  const result: Record<string, LocaleData> = {}
  for (const [path, content] of Object.entries(modules)) {
    const key = fileStem(path)
    if (key in result) {
      console.warn(`Duplicate locale key "${key}" (from ${path}); overwriting earlier entry.`)
    }
    result[key] = content
  }
  return result
}

// `**` includes subfolders, but `app` keys stay flat (filename only): it's the
// global namespace, with some keys resolved dynamically as `app.<key>`, so
// folders are organization only.
export function loadAppLocales(): Record<string, LocaleData> {
  appLocales ??= buildLocaleDict(
    import.meta.glob<LocaleData>('@/locales/app/**/*.json', { eager: true, import: 'default' }),
  )
  return appLocales
}

export function loadCharacterLocales(): Record<string, LocaleData> {
  characterLocales ??= buildLocaleDict(
    import.meta.glob<LocaleData>('@/locales/character/*.json', {
      eager: true,
      import: 'default',
    }),
  )
  return characterLocales
}

export function loadArtifactLocales(): Record<string, LocaleData> {
  artifactLocales ??= buildLocaleDict({
    ...import.meta.glob<LocaleData>('@/locales/artifact/*.json', {
      eager: true,
      import: 'default',
    }),
    ...import.meta.glob<LocaleData>('@/locales/seasonal/artifact/*.json', {
      eager: true,
      import: 'default',
    }),
  })
  return artifactLocales
}

export function loadPhantimalLocales(): Record<string, LocaleData> {
  phantimalLocales ??= buildLocaleDict(
    import.meta.glob<LocaleData>('@/locales/seasonal/phantimal/*.json', {
      eager: true,
      import: 'default',
    }),
  )
  return phantimalLocales
}

export function loadGameLocales(): Record<string, LocaleData> {
  gameLocales ??= buildLocaleDict(
    import.meta.glob<LocaleData>('@/locales/game/*.json', { eager: true, import: 'default' }),
  )
  return gameLocales
}

// A buff's sentence, in the skill text's markup, by the id the mode map lists give it.
function loadBuffLocales(): Record<string, LocaleData> {
  buffLocales ??= buildLocaleDict(
    import.meta.glob<LocaleData>('@/locales/buff/*.json', { eager: true, import: 'default' }),
  )
  return buffLocales
}

export function loadAllLocales(): LocaleDictionary {
  return {
    app: loadAppLocales(),
    character: loadCharacterLocales(),
    artifact: loadArtifactLocales(),
    game: loadGameLocales(),
    buff: loadBuffLocales(),
  }
}
