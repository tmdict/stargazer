// Helpers shared by the data importers.

import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { argv } from 'node:process'

import { STAT_TAG_RE } from '../../src/utils/textHighlight.ts'

// Default local source: the sibling afkj-data-viewer checkout, which emits
// `static/api/<feed>/<file>.json`. Resolved against the repo root so it holds
// regardless of CWD as long as the two repos are siblings. Override at
// runtime with `--src-dir <PATH>` (local) or `--url-base <URL>` (remote).
export const DEFAULT_SRC_DIR = '../afkj-data-viewer/static/api'

export function arg(name: string): string | undefined {
  const i = argv.indexOf(`--${name}`)
  if (i === -1) return undefined
  return argv[i + 1]
}

export function hasFlag(name: string): boolean {
  return argv.includes(`--${name}`)
}

// Reorder adjacent <STAT>[[value]] pairs to [[value]]<STAT>, which reads more
// naturally in both EN and ZH ("40% of ATK" rather than "ATK 40%"). Standalone
// stat tags like "based on <ATK>" are left untouched. The tag grammar comes
// from the canonical STAT_TAG_RE so renderer and importer can't diverge.
const STAT_VALUE_SWAP = new RegExp(`${STAT_TAG_RE.source}\\s*(\\[\\[[^\\]]+\\]\\])`, 'g')

function reorderStatValuePairs(text: string): string {
  return text.replace(STAT_VALUE_SWAP, '$2<$1>')
}

// Strip Unity TextMeshPro <sprite name="..."> markers. The mode label that
// follows the sprite carries the meaning; we don't ship the icon assets.
const SPRITE_TAG = /<sprite\s+name="[^"]*">/g

function stripSpriteTags(text: string): string {
  return text.replace(SPRITE_TAG, '')
}

export function cleanDescription(text: string): string {
  return reorderStatValuePairs(stripSpriteTags(text))
}

// Write only when content differs so re-runs produce no git diff. Compact,
// auto-managed output; callers targeting prettier-formatted dirs pass
// pre-formatted text instead.
export async function writeTextIfChanged(path: string, next: string): Promise<boolean> {
  if (existsSync(path)) {
    const prev = await readFile(path, 'utf8')
    if (prev === next) return false
  }
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, next)
  return true
}

export async function writeJsonIfChanged(path: string, value: unknown): Promise<boolean> {
  return writeTextIfChanged(path, JSON.stringify(value) + '\n')
}
