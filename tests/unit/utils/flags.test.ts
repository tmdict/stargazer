import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { readFlag, writeFlag } from '@/utils/flags'
import { stubLocalStorage } from '../fixtures/storage'

const FLAGS_KEY = 'stargazer.flags'

let storage: Map<string, string>

beforeEach(() => {
  vi.stubEnv('SSR', false)
  storage = stubLocalStorage().storage
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('flags item', () => {
  it('reads an entry only when it is a date', () => {
    storage.set(FLAGS_KEY, JSON.stringify({ whatsNew: '2026-11-06', moved: 1, welcomed: '1' }))
    expect(readFlag('whatsNew')).toBe('2026-11-06')
    expect(readFlag('moved')).toBeNull()
    expect(readFlag('welcomed')).toBeNull()
  })

  it('reads a value that is not an object as no flags', () => {
    storage.set(FLAGS_KEY, 'garbage{')
    expect(readFlag('whatsNew')).toBeNull()
  })

  it('keeps the other flags on a write, and drops entries it does not know', () => {
    storage.set(
      FLAGS_KEY,
      JSON.stringify({ whatsNew: '2026-11-06', retired: '2026-01-01', moved: 7 }),
    )
    writeFlag('welcomed', '2026-11-20')
    expect(JSON.parse(storage.get(FLAGS_KEY)!)).toEqual({
      whatsNew: '2026-11-06',
      welcomed: '2026-11-20',
    })
  })
})
