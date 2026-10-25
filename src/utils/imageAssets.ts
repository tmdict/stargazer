// The hero portraits' display variants. scripts/guideReports.ts resolves report
// placeholders from this module's imports alone, which keeps other variants of
// the same PNGs (dataLoader's matcher portraits) out of the reports. Its
// integration test copies this file on its own, so it takes no local imports.
const byName = (modules: Record<string, string>): Record<string, string> =>
  Object.fromEntries(
    Object.entries(modules).map(([file, url]) => [file.slice(file.lastIndexOf('/') + 1, -4), url]),
  )

// The 100px width sets the grid image export's resolution (FULL_DETAIL_RATIO).
// Phantimals have the portraits' shape and take the same variant. Outfits
// share the portraits' folder under lib/characters/outfit.ts's naming rule, and
// a glob takes only literal patterns, so the rule is repeated in the negative one.
export const characterImages = byName(
  import.meta.glob<string>(
    [
      '@/pack/images/character/*.png',
      '@/pack/images/seasonal/phantimal/*.png',
      '!@/pack/images/character/*-skin*.png',
    ],
    {
      query: { format: 'webp', quality: 80, w: 100, h: 135, fit: 'cover', position: 'bottom' },
      eager: true,
      import: 'default',
    },
  ),
)

export const artifactImages = byName(
  import.meta.glob<string>(
    ['@/pack/images/artifact/*.png', '@/pack/images/seasonal/artifact/*.png'],
    {
      query: { format: 'webp', quality: 80, w: 100 },
      eager: true,
      import: 'default',
    },
  ),
)
