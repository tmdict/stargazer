// npm run fits makes the data pack's fit table (pvp/fits.bin) in the
// DATA_PACK_DIR folder: every lineup of the PvP data file placed on every
// preset map, with and without its phantimal, so the generator has each fit
// check's answer and runs none on those maps.
//
// A row is a lineup on every map. The rows are made side by side, on all the
// computer's cores but one. A row is kept in node_modules/.cache/fits however
// the run ends, and a later run uses it again while what it was made from is
// the same (scripts/lib/fitTable.ts, the app's fitTable.ts); each run makes a
// few kept rows again, and makes them all again when one comes out different.

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { availableParallelism } from 'node:os'
import { join } from 'node:path'
import { exit } from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Worker } from 'node:worker_threads'

import { FITS_FILE, localPack, mirror } from './lib/dataPack.ts'
import {
  buildFitCode,
  cacheFolder,
  digest,
  fitStamp,
  loadFitCode,
  readDataFile,
  rowCode,
  syncFitTable,
} from './lib/fitTable.ts'
import type { FitAnswer, FitTask } from './lib/fitWorker.ts'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const PACK = join(ROOT, 'src', 'pack')
const KEPT = join(cacheFolder(ROOT), 'rows.json')
const RECHECKED = 20
const REPORT_EVERY = 30_000

function fail(message: string): never {
  console.error(`fits: ${message}`)
  exit(1)
}

// A row as made, with the lists and weights it read and the digest of what it
// was made from beside the code.
interface Kept {
  key: string
  reads: unknown
  row: unknown
}

// The kept rows by lineup, of one build of the fit code.
interface KeptFile {
  code: string
  rows: Record<string, Kept[]>
}

const count = (n: number): string => n.toLocaleString('en-US')
const rows = (n: number): string => `${count(n)} ${n === 1 ? 'row' : 'rows'}`

// The threads that make rows, started as tasks need them. Each task's answer
// goes to `each` as it comes, and a thread that fails stops the run.
function startThreads(code: string, dataFile: Uint8Array) {
  const size = Math.max(1, availableParallelism() - 1)
  const threads: Worker[] = []
  const idle: Worker[] = []
  let failed: (error: Error) => void = () => {}
  const failure = new Promise<never>((_, reject) => (failed = reject))
  failure.catch(() => {})
  const start = (): Worker => {
    const thread = new Worker(new URL('./lib/fitWorker.ts', import.meta.url), {
      workerData: { url: pathToFileURL(code).href, dataFile },
    })
    thread.on('error', failed)
    thread.on('exit', () => failed(new Error('A thread making rows ended early')))
    threads.push(thread)
    return thread
  }
  const run = (
    tasks: readonly FitTask[],
    each: (task: FitTask, answer: FitAnswer) => void,
  ): Promise<void> => {
    const waiting = [...tasks]
    let left = waiting.length
    const done = new Promise<void>((finish) => {
      const hand = (thread: Worker): void => {
        const task = waiting.shift()
        if (!task) {
          idle.push(thread)
          if (!left) finish()
          return
        }
        thread.once('message', (answer: FitAnswer) => {
          left--
          each(task, answer)
          hand(thread)
        })
        thread.postMessage(task)
      }
      if (!left) finish()
      while (waiting.length && (idle.length || threads.length < size)) hand(idle.pop() ?? start())
    })
    return Promise.race([done, failure])
  }
  return { size, run, stop: () => Promise.all(threads.map((thread) => thread.terminate())) }
}

const dir = localPack(ROOT)
if (!dir || !existsSync(dir)) fail('set DATA_PACK_DIR in .env.local to the pack folder')

const { file, files, drop } = await buildFitCode(ROOT)
process.on('exit', drop)
// A signal ends the run through `exit`, whose handlers drop the built code and
// keep the rows made.
const SIGNALS = { SIGHUP: 129, SIGINT: 130, SIGTERM: 143 } as const
for (const [signal, status] of Object.entries(SIGNALS)) process.once(signal, () => exit(status))

const code = await loadFitCode(file)
const dataFile = readDataFile(PACK)
const data = await code.decodeSlData(dataFile)
const lineups = data.everyMap
const lineupOf = (index: number): string => lineups[index]!.heroes.join(',')
const keyOf = (index: number, plain: boolean, reads: unknown): string =>
  digest(JSON.stringify(code.rowInputs(data, lineups[index]!, plain, reads)))

// Both digests are taken beside the build, so files saved during the run
// leave the table stamped with what its rows were made from.
const common = rowCode(ROOT, files)
const stamp = fitStamp(ROOT, files, dataFile)
const kept = new Map<string, Kept[]>()
if (existsSync(KEPT)) {
  try {
    const stored = JSON.parse(readFileSync(KEPT, 'utf8')) as KeptFile
    if (stored.code === common) {
      for (const [lineup, entries] of Object.entries(stored.rows)) kept.set(lineup, entries)
    }
  } catch {
    // A file a stopped run left half-written; every row is made again.
  }
}
process.on('exit', () => {
  const stored: KeptFile = { code: common, rows: Object.fromEntries(kept) }
  writeFileSync(KEPT, JSON.stringify(stored))
})

const threads = startThreads(file, dataFile)

// One set's rows, each kept from an earlier run or the other set where what
// it was made from is the same, and made otherwise. A lineup that summons no
// phantimal has one row for both sets.
async function makeSet(plain: boolean): Promise<{ set: Kept[]; reused: FitTask[] }> {
  const set = lineups.map((_, index) =>
    kept.get(lineupOf(index))?.find((entry) => entry.key === keyOf(index, plain, entry.reads)),
  )
  const tasks = set.flatMap((row, index) => (row ? [] : [{ index, plain }]))
  const reused = set.flatMap((row, index) => (row ? [{ index, plain }] : []))
  if (tasks.length) {
    const cores = `${threads.size} ${threads.size === 1 ? 'core' : 'cores'}`
    console.log(
      `fits: making ${rows(tasks.length)} ${plain ? 'without' : 'with'} phantimals on ${cores}`,
    )
  }
  const began = Date.now()
  let done = 0
  const report = setInterval(() => {
    if (!done) return
    const left = ((Date.now() - began) / done) * (tasks.length - done)
    console.log(
      `fits: ${count(done)} of ${rows(tasks.length)}, about ${Math.ceil(left / 60_000)} min left`,
    )
  }, REPORT_EVERY)
  try {
    await threads.run(tasks, ({ index }, { row, reads }) => {
      const entry = { key: keyOf(index, plain, reads), reads, row }
      set[index] = entry
      kept.set(lineupOf(index), [...(kept.get(lineupOf(index)) ?? []), entry])
      done++
    })
  } finally {
    clearInterval(report)
  }
  return { set: set as Kept[], reused }
}

async function makeSets() {
  const seasonal = await makeSet(false)
  const plain = await makeSet(true)
  return {
    seasonal: seasonal.set,
    plain: plain.set,
    reused: [...seasonal.reused, ...plain.reused],
  }
}

let made = await makeSets()
const { reused } = made
const again = Array.from(
  { length: Math.min(RECHECKED, reused.length) },
  () => reused.splice(Math.floor(Math.random() * reused.length), 1)[0]!,
)
let differs = false
await threads.run(again, ({ index, plain }, { row }) => {
  const before = (plain ? made.plain : made.seasonal)[index]!.row
  if (JSON.stringify(row) !== JSON.stringify(before)) differs = true
})
if (differs) {
  console.log('fits: a kept row came out different when made again, so every row is made again')
  kept.clear()
  made = await makeSets()
} else if (again.length) {
  console.log(
    `fits: used ${rows(reused.length + again.length)} already made, and the ${count(again.length)} made again to check came out the same`,
  )
}
await threads.stop()

// Only the rows of this table stay kept.
kept.clear()
lineups.forEach((_, index) =>
  kept.set(lineupOf(index), [...new Set([made.seasonal[index]!, made.plain[index]!])]),
)

const table = code.fitTable(
  stamp,
  made.seasonal.map((entry) => entry.row),
  made.plain.map((entry) => entry.row),
)
const target = join(dir, FITS_FILE)
let unchanged = false
if (existsSync(target)) {
  try {
    const before = await code.decodeSlFits(readFileSync(target), data)
    unchanged = JSON.stringify(before) === JSON.stringify(table)
  } catch {
    // A table sealed with another export's key, or made for other lineups.
  }
}
if (unchanged) console.log('fits: the fit table in the pack folder is already this one')
else {
  const bytes = await code.encodeSlFits(table)
  writeFileSync(target, bytes)
  console.log(`fits: wrote ${FITS_FILE} in the pack folder (${Math.round(bytes.length / 1024)} KB)`)
}

mirror(dir, PACK)
const { note } = await syncFitTable(PACK, ROOT)
if (note) fail(note)
