import { afterEach, describe, expect, it, vi } from 'vitest'

import { FRAME_NAMES } from '@/lib/import/card/frames'
import type {
  HeroReferences,
  ImportRequest,
  ImportResponse,
  MatchReferences,
} from '@/workers/import.worker'
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

const heroes = (): ImportRequest =>
  ({
    type: 'heroes',
    frames: FRAME_NAMES.map(() => createImage(280, 404)),
    portraits: [{ characterId: 1, image: createImage(180, 248) }],
    learned: [],
  }) satisfies HeroReferences & { type: 'heroes' }

const match = (): ImportRequest =>
  ({
    type: 'match',
    artifacts: [],
    units: [],
    arena: null,
  }) satisfies MatchReferences & { type: 'match' }

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('import worker', () => {
  it('reads a match screen once both parts are in, a roster once the hero part is', async () => {
    const { posted, send } = await startWorker()
    const read = (id: string, kind: 'formation' | 'roster') =>
      send({ type: 'read', id, image: createImage(400, 300), kind })
    read('early', 'formation')
    send(heroes())
    read('roster', 'roster')
    read('half', 'formation')
    send(match())
    read('late', 'formation')

    expect(posted.map((m) => m.type)).toEqual([
      'error',
      'ready',
      'reading',
      'error',
      'ready',
      'reading',
    ])
    expect(posted[0]).toMatchObject({ id: 'early', message: 'references not loaded' })
    expect(posted[2]).toMatchObject({ id: 'roster', reading: { grid: null, slots: [] } })
    expect(posted[3]).toMatchObject({ id: 'half', message: 'references not loaded' })
    expect(posted[5]).toMatchObject({ id: 'late', reading: { warnings: [{ kind: 'no-board' }] } })
  })
})
