// The roster's display variants. scripts/guideReports.ts resolves report
// placeholders from this module's imports alone, which keeps other variants of
// the same PNGs (dataLoader's matcher portraits) out of the reports. Its
// integration test copies this file on its own, so it takes no local imports.
const byName = (modules: Record<string, string>): Record<string, string> =>
  Object.fromEntries(
    Object.entries(modules).map(([file, url]) => [file.slice(file.lastIndexOf('/') + 1, -4), url]),
  )

export const characterImages = byName(
  import.meta.glob<string>('@/assets/images/character/*.png', {
    query: { format: 'webp', quality: 80, w: 100, h: 135, fit: 'cover', position: 'bottom' },
    eager: true,
    import: 'default',
  }),
)

export const artifactImages = byName(
  import.meta.glob<string>('@/assets/images/artifact/*.png', {
    query: { format: 'webp', quality: 80, w: 100 },
    eager: true,
    import: 'default',
  }),
)
