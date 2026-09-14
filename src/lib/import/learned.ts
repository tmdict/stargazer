/* The descriptor format shared by browser learning, correction exports and
 * curated references. Geometry checks prevent matching stale face crops;
 * changes to normalisation or quantisation must also bump the version. */

import { decodeLearned, DESCRIPTOR_SIZE, encodeLearned } from './heroes'
import { ART_BOX } from './layout'
import type { LearnedIcon } from './types'

export const LEARNED_ICONS_CAP = 100

interface LearnedEnvelope {
  v: 1
  spec: { descriptor: [number, number]; box: [number, number, number] }
  icons: LearnedIcon[]
}

const SPEC: LearnedEnvelope['spec'] = {
  descriptor: [DESCRIPTOR_SIZE.width, DESCRIPTOR_SIZE.height],
  box: [ART_BOX.x, ART_BOX.y, ART_BOX.w],
}

const specMatches = (spec: unknown): boolean =>
  typeof spec === 'object' &&
  spec !== null &&
  JSON.stringify((spec as LearnedEnvelope['spec']).descriptor) ===
    JSON.stringify(SPEC.descriptor) &&
  JSON.stringify((spec as LearnedEnvelope['spec']).box) === JSON.stringify(SPEC.box)

const isIcon = (value: unknown): value is LearnedIcon => {
  if (typeof value !== 'object' || value === null) return false
  const icon = value as LearnedIcon
  return (
    Number.isInteger(icon.characterId) &&
    typeof icon.descriptor === 'string' &&
    decodeLearned(icon.descriptor) !== null &&
    Number.isFinite(icon.learnedAt)
  )
}

export function readLearnedIcons(value: unknown): LearnedIcon[] {
  if (typeof value !== 'object' || value === null) return []
  const env = value as Partial<LearnedEnvelope>
  if (env.v !== 1 || !specMatches(env.spec) || !Array.isArray(env.icons)) return []
  return env.icons.filter(isIcon)
}

export function parseLearnedIcons(raw: string | null): LearnedIcon[] {
  if (!raw) return []
  try {
    return readLearnedIcons(JSON.parse(raw))
  } catch {
    return []
  }
}

export const learnedIconEnvelope = (icons: readonly LearnedIcon[]): LearnedEnvelope => ({
  v: 1,
  spec: SPEC,
  icons: [...icons],
})

export const serializeLearnedIcons = (icons: readonly LearnedIcon[]): string =>
  JSON.stringify(learnedIconEnvelope(icons))

/* Teach a face as a hero. The same face taught again replaces its earlier
 * lesson, so a mis-click never outlives its correction; oldest out over the
 * cap. */
export function addLearnedIcon(
  icons: readonly LearnedIcon[],
  characterId: number,
  descriptor: Float32Array,
  now: number,
): LearnedIcon[] {
  const encoded = encodeLearned(descriptor)
  const next = [
    ...icons.filter((icon) => icon.descriptor !== encoded),
    { characterId, descriptor: encoded, learnedAt: now },
  ]
  next.sort((a, b) => a.learnedAt - b.learnedAt)
  return next.slice(Math.max(0, next.length - LEARNED_ICONS_CAP))
}

/* Unlearn a face: the correction that taught it was taken back. */
export function dropLearnedIcon(
  icons: readonly LearnedIcon[],
  descriptor: Float32Array,
): LearnedIcon[] {
  const encoded = encodeLearned(descriptor)
  return icons.filter((icon) => icon.descriptor !== encoded)
}
