// The data pack's fit table (pvp/fits.bin) as npm run data and npm run fits
// handle it: the app's code for it, built by Vite so its imports resolve, and
// the stamp that says what a table was made from. The app uses a table only
// while its stamp is the one this code and data file give, so a change to a
// rule, a list, the engine or the records leaves the fit checks to the browser
// until npm run fits makes the table again.

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'vite'

import { FITS_FILE, FITS_MODULE, writeFitsModule } from './dataPack.ts'

const ENTRY = 'src/lib/pvp/generator/fitTable.ts'
const CACHE = 'node_modules/.cache/fits'
const DATA_FILE = 'pvp/pvp.bin'
const KEY_FILE = 'pvp/pvp.key'

// The pack's files stay out of a stamp's file list: a stamp takes the data
// file by itself, the key changes only with it, and the table's address is in
// the build or not by the stamp. Any other pack file in the fit code would
// change a table's rows without changing its stamp.
const PACK_COPY = 'src/pack/'
const PACK_FILES = [DATA_FILE, KEY_FILE, FITS_FILE, FITS_MODULE].map(
  (file) => `${PACK_COPY}${file}`,
)

// The hero and phantimal data files, which a row reads through the app's
// `rowInputs`.
const UNIT_FOLDERS = ['src/data/character/', 'src/data/seasonal/phantimal/']

interface SlFile {
  everyMap: { heroes: number[] }[]
}

// The app module's exports (src/lib/pvp/generator/fitTable.ts). A row, the
// lists and weights it read, and a table pass through the scripts unread.
export interface FitCode {
  decodeSlData(bytes: Uint8Array): Promise<SlFile>
  decodeSlFits(bytes: Uint8Array, data: SlFile): Promise<{ stamp: string }>
  encodeSlFits(table: unknown): Promise<Uint8Array>
  fitRow(data: SlFile, heroes: number[], plain: boolean): { row: unknown; reads: unknown }
  rowInputs(data: SlFile, team: SlFile['everyMap'][number], plain: boolean, reads: unknown): unknown
  fitTable(stamp: string, seasonal: unknown[], plain: unknown[]): unknown
}

export const digest = (...parts: (string | Uint8Array)[]): string => {
  const hash = createHash('sha256')
  for (const part of parts) hash.update(part)
  return hash.digest('hex')
}

export const cacheFolder = (root: string): string => join(root, CACHE)

export const loadFitCode = async (file: string): Promise<FitCode> =>
  (await import(pathToFileURL(file).href)) as FitCode

/** Builds the app's code for the fit table into a folder of its own, which
 * `drop` removes: the built file, and the files of this repo it is made of. */
export async function buildFitCode(
  root: string,
): Promise<{ file: string; files: string[]; drop: () => void }> {
  mkdirSync(cacheFolder(root), { recursive: true })
  const outDir = mkdtempSync(join(cacheFolder(root), 'code-'))
  const drop = (): void => rmSync(outDir, { recursive: true, force: true })
  try {
    const built = await build({
      configFile: false,
      root,
      resolve: { alias: { '@': join(root, 'src') } },
      logLevel: 'error',
      build: { ssr: ENTRY, outDir, minify: false, copyPublicDir: false },
    })
    const chunks = [built]
      .flat()
      .flatMap((result) => ('output' in result ? result.output : []))
      .filter((part) => part.type === 'chunk')
    const [code] = chunks
    if (chunks.length !== 1 || !code) throw new Error('The fit code did not build as one file')
    const ids = code.moduleIds.map((id) =>
      relative(root, id.replace(/\?.*$/, '')).split(sep).join('/'),
    )
    const other = ids.find((file) => file.startsWith(PACK_COPY) && !PACK_FILES.includes(file))
    if (other) throw new Error(`The fit code reads ${other}, which no stamp covers`)
    const files = ids.filter((file) => file.startsWith('src/') && !file.startsWith(PACK_COPY))
    return { file: join(outDir, code.fileName), files: [...new Set(files)].sort(), drop }
  } catch (error) {
    drop()
    throw error
  }
}

const digestFiles = (root: string, files: readonly string[]): string =>
  digest(...files.flatMap((file) => [file, digest(readFileSync(join(root, file)))]))

/** What a table is made from, as its stamp: the data file and the files the
 * fit code is built of. */
export const fitStamp = (root: string, files: readonly string[], dataFile: Uint8Array): string =>
  digest(digest(dataFile), digestFiles(root, files)).slice(0, 12)

/** What every row is made from: the files the fit code is built of, the unit
 * data files left out. */
export const rowCode = (root: string, files: readonly string[]): string =>
  digestFiles(
    root,
    files.filter((file) => !UNIT_FOLDERS.some((folder) => file.startsWith(folder))),
  )

export const readDataFile = (pack: string): Buffer => readFileSync(join(pack, DATA_FILE))

/** Points the app at the pack's fit table when its stamp is this code's and
 * data file's, and at none otherwise, with a line saying why. Returns whether
 * that changed a file of `pack`. */
export async function syncFitTable(
  pack: string,
  root: string,
): Promise<{ changed: boolean; note: string | null }> {
  // The fit code imports the module, which a pack just put in place lacks.
  const added = !existsSync(join(pack, FITS_MODULE)) && writeFitsModule(pack, false)
  const use = (used: boolean, note: string | null = null) => ({
    changed: writeFitsModule(pack, used) || added,
    note,
  })
  // A copy without the data pack has an empty key file, and no data to check.
  const key = join(pack, KEY_FILE)
  if (!existsSync(key) || !readFileSync(key, 'utf8').trim()) return use(false)
  const without = 'so the generator checks fits in the browser'
  const table = join(pack, FITS_FILE)
  if (!existsSync(table)) {
    return use(false, `the pack has no fit table, ${without}; npm run fits makes one`)
  }
  // Code that does not build stops the build itself, with its own message.
  const built = await buildFitCode(root).catch(() => null)
  if (!built) return use(false, `the fit table's code does not build, ${without}`)
  try {
    const dataFile = readDataFile(pack)
    let stamp: string | null = null
    try {
      const code = await loadFitCode(built.file)
      const data = await code.decodeSlData(dataFile)
      stamp = (await code.decodeSlFits(readFileSync(table), data)).stamp
    } catch {
      // A table sealed with another export's key or made for other lineups, or
      // fit code that does not load here.
    }
    if (stamp === fitStamp(root, built.files, dataFile)) return use(true)
    return use(
      false,
      `the fit table is out of date with the rules, the engine or the PvP data, ${without}; npm run fits makes it again`,
    )
  } finally {
    built.drop()
  }
}
