/**
 * Hero portrait signatures used for pool-screenshot matching.
 *
 * The default set is pre-computed and shipped via `heroPortraitSignatures.ts`
 * (base64-encoded Float32Arrays committed to the repo). The user can
 * temporarily replace it at runtime via the "Override Reference" flow in the
 * pool import UI — helpful when the game art has changed and you haven't
 * regenerated the committed signatures yet.
 */

import { HERO_PORTRAIT_SIGNATURES } from './heroPortraitSignatures'
import { base64ToFloat32 } from './signatureCodec'

let cache: Record<string, Float32Array> | null = null
let override: Record<string, Float32Array> | null = null

export function loadBundledReferenceSignatures(): Promise<Record<string, Float32Array>> {
  if (cache) return Promise.resolve(cache)
  if (override) {
    cache = override
  } else {
    const decoded: Record<string, Float32Array> = {}
    for (const [hero, b64] of Object.entries(HERO_PORTRAIT_SIGNATURES)) {
      decoded[hero] = base64ToFloat32(b64)
    }
    cache = decoded
  }
  return Promise.resolve(cache)
}

export function getBundledReferenceCount(): number {
  if (override) return Object.keys(override).length
  return Object.keys(HERO_PORTRAIT_SIGNATURES).length
}

/**
 * Replace the active reference set with a runtime-computed one. Pass null
 * to revert to the bundled signatures. Invalidates the decoded cache.
 */
export function setOverrideReference(sigs: Record<string, Float32Array> | null): void {
  override = sigs
  cache = null
}

export function hasOverrideReference(): boolean {
  return override !== null
}

export function invalidateBundledCache(): void {
  cache = null
}
