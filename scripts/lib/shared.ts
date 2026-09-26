// Helpers shared by the data importers.

import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { argv, env, loadEnvFile } from 'node:process'

import { STAT_TAG_RE } from '../../src/utils/textHighlight.ts'

// --src-dir, else DATA_FEED_DIR (environment or .env.local), resolved against
// the repo root so it holds regardless of CWD.
export function feedSrcDir(projectRoot: string, srcDirFlag: string | undefined): string {
  if (srcDirFlag) return resolve(srcDirFlag)
  const localEnv = join(projectRoot, '.env.local')
  if (existsSync(localEnv)) loadEnvFile(localEnv)
  const dir = env.DATA_FEED_DIR
  if (!dir) {
    throw new Error('no data feed: set DATA_FEED_DIR in .env.local, or pass --src-dir / --url-base')
  }
  return resolve(projectRoot, dir)
}

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

// Write only when content differs so re-runs produce no git diff.
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
