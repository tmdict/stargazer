import { afterEach, describe, expect, it, vi } from 'vitest'

import { timestampedName } from '@/utils/download'

describe('timestampedName', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('builds a local-time prefix-YYYYMMDD-HHMMSS.ext name', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 5, 8, 9, 4, 7)) // local: 2026-06-08 09:04:07
    expect(timestampedName('teams', 'png')).toBe('teams-20260608-090407.png')
  })
})
