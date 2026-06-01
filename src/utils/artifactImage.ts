// Remote seasonal icons hosted by afkj-data-viewer (we don't bundle these
// locally). Pre-season artifact icons ARE bundled and go through the local
// image pipeline (see gameData.getArtifactImage).
const REMOTE_BASE = 'https://afkj-data-viewer.pages.dev/img'

export interface ArtifactImageSources {
  avif: string
  webp: string
  png: string
}

const sources = (base: string): ArtifactImageSources => ({
  avif: `${base}.avif`,
  webp: `${base}.webp`,
  png: `${base}.png`,
})

// Pre-season uses local bundled images; every other season uses remote assets.
export const isRemoteArtifact = (season: number): boolean => season !== 0

// AVIF → WebP → PNG sources for a seasonal artifact, by artifact name (slug).
export const seasonArtifactImageSources = (name: string): ArtifactImageSources =>
  sources(`${REMOTE_BASE}/artifacts/season/${name}`)

// AVIF → WebP → PNG sources for a seasonal phantimal, by phantimal name (slug).
export const phantimalImageSources = (name: string): ArtifactImageSources =>
  sources(`${REMOTE_BASE}/seasonal/phantimal/${name}`)
