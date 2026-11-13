// A worker thread of npm run fits (scripts/fits.ts): makes the rows it is
// handed with the built fit code, one at a time.

import { parentPort, workerData } from 'node:worker_threads'

import type { FitCode } from './fitTable.ts'

// A lineup, by its place in the data file's rows of every map, and the set.
export interface FitTask {
  index: number
  plain: boolean
}

export type FitAnswer = ReturnType<FitCode['fitRow']>

const { url, dataFile } = workerData as { url: string; dataFile: Uint8Array }
const code = (await import(url)) as FitCode
const data = await code.decodeSlData(dataFile)

parentPort!.on('message', ({ index, plain }: FitTask) => {
  parentPort!.postMessage(code.fitRow(data, data.everyMap[index]!.heroes, plain))
})
