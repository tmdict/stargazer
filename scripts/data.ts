// npm run data fills src/pack/: from DATA_PACK_DIR on your computer, else the
// version data.lock pins, downloaded with DATA_PACK_URL, DATA_PACK_TOKEN and
// DATA_PACK_PATH. `build` stops on a missing or incomplete pack; `pin` writes
// the DATA_PACK_DIR folder's commit into data.lock first, then prints the same
// checks without stopping.
//
// Build logs can be public, so nothing here prints the download's address,
// where it redirects, or the paths inside it.

import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { argv, env, exit, loadEnvFile } from 'node:process'
import { fileURLToPath } from 'node:url'

import {
  download,
  DownloadError,
  dropMarker,
  mirror,
  packCommit,
  packProblems,
  pinNotice,
  pinProblem,
  readMarker,
  writeGenerated,
  writeStandIns,
} from './lib/dataPack.ts'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const PACK = join(ROOT, 'src', 'pack')
const LOCK = join(ROOT, 'data.lock')
const STAGING = join(ROOT, 'node_modules', '.cache', 'data-pack')
// Vitest's module cache keeps file lists from before a copy changed them.
const VITEST_CACHE = join(ROOT, 'node_modules', '.vitest-cache')

const mode = argv[2]
if (mode !== undefined && mode !== 'build' && mode !== 'pin') {
  console.error('data: usage: npm run data [-- build], npm run data:pin')
  exit(1)
}

function fail(message: string): never {
  console.error(`data: ${message}`)
  exit(1)
}

const readPin = (): string | null =>
  existsSync(LOCK) ? readFileSync(LOCK, 'utf8').trim() || null : null

const localEnv = join(ROOT, '.env.local')
if (existsSync(localEnv)) loadEnvFile(localEnv)
const dir = env.DATA_PACK_DIR ? resolve(ROOT, env.DATA_PACK_DIR) : null
const { DATA_PACK_URL: url, DATA_PACK_TOKEN: token, DATA_PACK_PATH: path } = env
const HOST_SETTINGS = ['DATA_PACK_URL', 'DATA_PACK_TOKEN', 'DATA_PACK_PATH']
const unset = HOST_SETTINGS.filter((name) => !env[name])
const noPackFix =
  unset.length < HOST_SETTINGS.length
    ? `set ${unset.join(' and ')}`
    : 'set DATA_PACK_DIR in .env.local'

let changed = 0
if (dir) {
  if (!existsSync(dir)) fail('DATA_PACK_DIR names a folder that does not exist')
  if (mode === 'pin') {
    const problem = pinProblem(dir)
    if (problem) fail(problem)
    writeFileSync(LOCK, `${packCommit(dir)}\n`)
  }
  changed = mirror(dir, PACK) + writeGenerated(PACK)
  dropMarker(PACK)
  const notice = pinNotice(dir, readPin())
  if (notice) console.log(`data: ${notice}`)
} else if (mode === 'pin') {
  fail('set DATA_PACK_DIR in .env.local to pin')
} else if (url && token && path) {
  const pin = readPin()
  if (!pin) fail('data.lock names no version')
  // A branch name would download whatever its tip is at each build.
  if (!/^[0-9a-f]{40}$/.test(pin)) fail('data.lock holds no full commit id')
  if (readMarker(PACK) !== pin) {
    try {
      await download(url, token, path, pin, PACK, STAGING)
    } catch (error) {
      fail(
        error instanceof DownloadError ? error.message : 'the download could not be put in place',
      )
    }
    changed = 1
  }
  changed += writeGenerated(PACK)
} else {
  changed = writeStandIns(PACK) + writeGenerated(PACK)
  if (mode === 'build') fail(`no data pack; ${noPackFix}`)
  console.log(
    `data: no data pack, so the app runs without game pictures or skill text; ${noPackFix}`,
  )
}

if (changed) rmSync(VITEST_CACHE, { recursive: true, force: true })

if (mode === 'build' || mode === 'pin') {
  const { problems, notes } = packProblems(PACK, ROOT)
  for (const note of notes) console.log(`data: ${note}`)
  if (problems.length && mode === 'pin') console.error('data: pinned, but a build would stop on:')
  for (const problem of problems) console.error(`data: ${problem}`)
  if (problems.length && mode === 'build') exit(1)
}
