/* The Supreme League worker's helpers (slHelper.worker.ts), which run a press's
 * fit checks and the boards of its set side by side. A round waits on its
 * longest check, so past three helpers nothing measured got faster. With fewer
 * than two the worker does the work itself, as one helper would only take its
 * turn. */

import type { FitJob, FitPoints } from '@/lib/pvp/generator/fit'
import type { BoardDraw } from '@/lib/pvp/generator/formation'
import type { HelperResponse, HelperTask } from './slHelper.worker'

type DrawTask = Omit<Extract<HelperTask, { type: 'draw' }>, 'type'>

export interface SlHelpers {
  // Each rejects, and every helper stops, once one fails.
  fit(jobs: FitJob[]): Promise<FitPoints[]>
  draw(tasks: DrawTask[]): Promise<BoardDraw[]>
}

const MOST = 3

interface Waiting {
  task: HelperTask
  done: (answer: HelperResponse) => void
  fail: () => void
}

export function startSlHelpers(): SlHelpers | null {
  const size = Math.min(MOST, (navigator.hardwareConcurrency || MOST + 1) - 1)
  if (size < 2 || typeof Worker === 'undefined') return null
  const queue: Waiting[] = []
  const idle: Worker[] = []
  const working = new Map<Worker, Waiting>()
  let stopped = false
  const stop = (): void => {
    stopped = true
    for (const helper of helpers) helper.terminate()
    for (const waiting of [...working.values(), ...queue]) waiting.fail()
    working.clear()
    queue.length = 0
  }
  const next = (): void => {
    while (idle.length && queue.length) {
      const helper = idle.pop()!
      const waiting = queue.shift()!
      working.set(helper, waiting)
      helper.postMessage(waiting.task)
    }
  }
  const helpers = Array.from({ length: size }, () => {
    const helper = new Worker(new URL('./slHelper.worker.ts', import.meta.url), { type: 'module' })
    helper.onmessage = (event: MessageEvent<HelperResponse>) => {
      const waiting = working.get(helper)
      if (!waiting || event.data.type === 'error') return stop()
      working.delete(helper)
      idle.push(helper)
      waiting.done(event.data)
      next()
    }
    helper.onerror = stop
    idle.push(helper)
    return helper
  })
  const run = (tasks: HelperTask[]): Promise<HelperResponse[]> => {
    if (stopped) return Promise.reject(new Error('The helpers stopped'))
    const answers = tasks.map(
      (task) => new Promise<HelperResponse>((done, fail) => queue.push({ task, done, fail })),
    )
    next()
    return Promise.all(answers)
  }
  return {
    fit: async (jobs) =>
      (await run(jobs.map((job) => ({ type: 'fit', job })))).map((answer) => {
        if (answer.type !== 'fitted') throw new Error('A helper answered another task')
        return answer.points
      }),
    draw: async (tasks) =>
      (await run(tasks.map((task) => ({ type: 'draw', ...task })))).map((answer) => {
        if (answer.type !== 'drawn') throw new Error('A helper answered another task')
        return answer.draw
      }),
  }
}
