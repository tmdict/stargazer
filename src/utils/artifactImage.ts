// Remote seasonal icons hosted at chaldea.tmdict.com (we don't bundle these
// locally). Pre-season artifact icons ARE bundled and go through the local
// image pipeline (see gameData.getArtifactImage).
//
// Served as WebP and consumed via a plain <img crossorigin="anonymous">: the
// crossorigin keeps the icon CORS-clean so the canvas-based image export can read
// it (the host must send Access-Control-Allow-Origin, see chaldea's _headers),
// and a single <img> (not <picture>) is what html-to-image reliably inlines.
const REMOTE_ROOT = 'https://chaldea.tmdict.com/img'
const REMOTE_BASE = `${REMOTE_ROOT}/seasonal`

// Pre-season uses local bundled images; every other season uses remote assets.
export const isRemoteArtifact = (season: number): boolean => season !== 0

// WebP icon URL for a seasonal artifact, by artifact name (slug).
export const seasonArtifactImageUrl = (name: string): string =>
  `${REMOTE_BASE}/artifact/${name}.webp`

// WebP icon URL for a seasonal phantimal, by phantimal name (slug).
export const phantimalImageUrl = (name: string): string => `${REMOTE_BASE}/phantimal/${name}.webp`

// Reference images for the match-screenshot import, by path under img/import:
// the paragon frames (`frame-p0` … `frame-p4-crown`) and the costume captures
// (`skin/<file>`). Hosted like the seasonal icons.
export const importReferenceUrl = (name: string): string => `${REMOTE_ROOT}/import/${name}.webp`

// Costume references: `{ "<hero slug>": ["<file>", …] }`, each file at skin/<file>.webp.
export const importSkinsManifestUrl = (): string => `${REMOTE_ROOT}/import/skins.json`
