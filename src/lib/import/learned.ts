/* Learned icons: descriptors of special hero icons (costumes) the bundled art
 * cannot match, kept from the user's corrections. A versioned envelope with
 * the descriptor geometry written in, so a change to the crop or descriptor
 * size discards the store instead of matching against stale vectors. No
 * storage access here: the composable reads and writes the key. */

import { decodeLearned, DESCRIPTOR_LENGTH, DESCRIPTOR_SIZE, encodeLearned } from './heroes'
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
    decodeLearned(icon.descriptor)?.length === DESCRIPTOR_LENGTH &&
    Number.isFinite(icon.learnedAt)
  )
}

export function parseLearnedIcons(raw: string | null): LearnedIcon[] {
  if (!raw) return []
  try {
    const env = JSON.parse(raw) as Partial<LearnedEnvelope>
    if (env.v !== 1 || !specMatches(env.spec) || !Array.isArray(env.icons)) return []
    return env.icons.filter(isIcon)
  } catch {
    return []
  }
}

export const serializeLearnedIcons = (icons: readonly LearnedIcon[]): string =>
  JSON.stringify({ v: 1, spec: SPEC, icons: [...icons] } satisfies LearnedEnvelope)

/* Append a learned icon, oldest first out when over the cap. */
export function addLearnedIcon(
  icons: readonly LearnedIcon[],
  characterId: number,
  descriptor: Float32Array,
  now: number,
): LearnedIcon[] {
  const next = [...icons, { characterId, descriptor: encodeLearned(descriptor), learnedAt: now }]
  next.sort((a, b) => a.learnedAt - b.learnedAt)
  return next.slice(Math.max(0, next.length - LEARNED_ICONS_CAP))
}
