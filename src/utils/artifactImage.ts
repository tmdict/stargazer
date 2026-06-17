// Remote seasonal icons hosted by afkj-data-viewer (we don't bundle these
// locally). Pre-season artifact icons ARE bundled and go through the local
// image pipeline (see gameData.getArtifactImage).
//
// Served as WebP and consumed via a plain <img crossorigin="anonymous">: the
// crossorigin keeps the icon CORS-clean so the canvas-based image export can read
// it, and a single <img> (not <picture>) is what html-to-image reliably inlines.
const REMOTE_BASE = 'https://afkj-data-viewer.pages.dev/img'

// Pre-season uses local bundled images; every other season uses remote assets.
export const isRemoteArtifact = (season: number): boolean => season !== 0

// WebP icon URL for a seasonal artifact, by artifact name (slug).
export const seasonArtifactImageUrl = (name: string): string =>
  `${REMOTE_BASE}/artifacts/season/${name}.webp`

// WebP icon URL for a seasonal phantimal, by phantimal name (slug).
export const phantimalImageUrl = (name: string): string =>
  `${REMOTE_BASE}/seasonal/phantimal/${name}.webp`
