import { afterEach, describe, expect, it, vi } from 'vitest'

import { FRAME_NAMES } from '@/lib/import/card/frames'
import type { ImportRequest, ImportResponse, ReferenceImages } from '@/workers/import.worker'
import { createImage } from '../fixtures/image'

// The worker in its own global scope: what it posts, and a way to send it a message.
const startWorker = async (): Promise<{
  posted: ImportResponse[]
  send: (message: ImportRequest) => void
}> => {
  const posted: ImportResponse[] = []
  let listener: ((event: { data: ImportRequest }) => void) | undefined
  vi.stubGlobal('self', {
    postMessage: (message: ImportResponse) => posted.push(message),
    addEventListener: (_type: string, fn: typeof listener) => (listener = fn),
  })
  vi.resetModules()
  await import('@/workers/import.worker')
  return { posted, send: (message) => listener!({ data: message }) }
}

const references = (): ReferenceImages => ({
  frames: FRAME_NAMES.map(() => createImage(280, 404)),
  portraits: [{ characterId: 1, image: createImage(180, 248) }],
  artifacts: [],
  units: [],
  learned: [],
  arena: null,
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('import worker', () => {
  it('reads a screenshot only once its references are in', async () => {
    const { posted, send } = await startWorker()
    send({ type: 'read', id: 'early', image: createImage(400, 300), kind: 'formation' })
    send({ type: 'references', ...references() })
    send({ type: 'read', id: 'late', image: createImage(400, 300), kind: 'formation' })

    expect(posted.map((m) => m.type)).toEqual(['error', 'ready', 'reading'])
    expect(posted[0]).toMatchObject({ id: 'early', message: 'references not loaded' })
    expect(posted[2]).toMatchObject({ id: 'late', reading: { warnings: [{ kind: 'no-board' }] } })
  })

  it('rebuilds the hero table for learned faces only once it has one', async () => {
    const { posted, send } = await startWorker()
    send({ type: 'learned', learned: [] })
    expect(posted).toEqual([])
    send({ type: 'references', ...references() })
    send({ type: 'learned', learned: [] })
    expect(posted).toEqual([{ type: 'ready' }, { type: 'ready' }])
  })

  it('fails a replay frame when the arena did not load', async () => {
    const { posted, send } = await startWorker()
    send({ type: 'references', ...references() })
    send({ type: 'read', id: 'frame', image: createImage(400, 300), kind: 'replay' })
    expect(posted[1]).toEqual({ type: 'error', id: 'frame', message: 'arena not loaded' })
  })
})
