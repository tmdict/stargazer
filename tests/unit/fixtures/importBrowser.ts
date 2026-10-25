import { vi } from 'vitest'

import type { ImportKind } from '@/lib/import/kinds'
import type { ImportRequest, ImportResponse } from '@/workers/import.worker'

// The browser's side of the screenshot import: workers that answer when told
// to, the sorter at once with `sortAs`, and images that decode to blank pixels.
export class FakeWorker {
  static started: FakeWorker[] = []
  static sortAs: ImportKind | null = null
  received: ImportRequest[] = []
  terminated = false
  onmessage: ((event: { data: ImportResponse }) => void) | null = null
  onerror: (() => void) | null = null
  constructor() {
    FakeWorker.started.push(this)
  }
  postMessage(message: ImportRequest): void {
    this.received.push(message)
    if (message.type === 'sort') {
      const kind = FakeWorker.sortAs
      queueMicrotask(() => this.reply({ type: 'sorted', id: message.id, kind }))
    }
  }
  terminate(): void {
    this.terminated = true
  }
  reply(message: ImportResponse): void {
    this.onmessage?.({ data: message })
  }
  reads(): string[] {
    return this.received.flatMap((m) => (m.type === 'read' ? [m.id] : []))
  }
  // The sorter takes the arena and the screenshots to sort; the others read.
  sorts(): boolean {
    return this.received.some((m) => m.type === 'arena' || m.type === 'sort')
  }
}

export const readers = (): FakeWorker[] => FakeWorker.started.filter((w) => !w.sorts())

export const bitmap = { width: 800, height: 600, close: () => {} }

const canvas = {
  width: 0,
  height: 0,
  getContext: () => ({
    drawImage: () => {},
    getImageData: (_x: number, _y: number, w: number, h: number) => ({
      data: new Uint8ClampedArray(w * h * 4),
    }),
  }),
}

export const stubImportBrowser = (): void => {
  FakeWorker.started = []
  FakeWorker.sortAs = null
  vi.stubGlobal('Worker', FakeWorker)
  vi.stubGlobal('document', { createElement: () => canvas })
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(async () => bitmap),
  )
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, blob: async () => new Blob() })),
  )
}

export const file = (name: string, size = 1): File => new File([new Uint8Array(size)], name)
