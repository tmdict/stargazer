// The app's pictures by name: the display variants (imageAssets.ts), the
// interface icons, and the screenshot import's references, which load on
// demand.

import { outfitOf } from '@/lib/characters/outfit'
import { fileStem } from './fileStem'
import { artifactImages, characterImages, outfitImages } from './imageAssets'

let icons: Record<string, string> | null = null

const byStem = <T>(modules: Record<string, T>): Record<string, T> =>
  Object.fromEntries(Object.entries(modules).map(([path, module]) => [fileStem(path), module]))

export function loadCharacterImages(): Record<string, string> {
  return characterImages
}

export function loadArtifactImages(): Record<string, string> {
  return artifactImages
}

// Each picture's first outfit at the portraits' display size, keyed by the
// picture (a hero's portrait under its slug). The glob lists names as text,
// where -skin10 comes before -skin2.
export function loadOutfitImages(): Record<string, string> {
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

export function loadIcons(): Record<string, string> {
  icons ??= byStem(
    import.meta.glob<string>('@/assets/images/icons/*.png', {
      query: { format: 'webp', quality: 80, w: 100 },
      eager: true,
      import: 'default',
    }),
  )
  return icons
}

// Portraits and phantimals at the art's own width for the screenshot import's
// matcher, loaded on demand: the 100 px picker thumbnails lose the face detail
// the matcher needs. Keyed by unit name.
export function loadMatcherPortraits(): Record<string, () => Promise<string>> {
  return byStem(
    import.meta.glob<string>(
      [
        '@/pack/images/character/*.png',
        '@/pack/images/seasonal/phantimal/*.png',
        '!@/pack/images/character/*-skin[0-9]*.png',
      ],
      { query: { format: 'webp', quality: 85, w: 180 }, import: 'default' },
    ),
  )
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
    Object.entries(modules).map(([path, load]) => [fileStem(path).slice('frame-'.length), load]),
  )
}

export function loadOutfitPortraits(): Record<string, (() => Promise<string>)[]> {
  const modules = import.meta.glob<string>('@/pack/images/character/*-skin[0-9]*.png', {
    query: { format: 'webp', quality: 90, effort: 6 },
    import: 'default',
  })
  const outfits: Record<string, (() => Promise<string>)[]> = {}
  for (const [path, load] of Object.entries(modules)) {
    const picture = outfitOf(fileStem(path))
    if (picture) (outfits[picture] ??= []).push(load)
  }
  return outfits
}
