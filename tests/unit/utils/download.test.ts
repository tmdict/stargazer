import { afterEach, describe, expect, it, vi } from 'vitest'

import { timestampedName } from '@/utils/download'

describe('timestampedName', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('builds a local-time prefix-YYYYMMDD-HHMMSS.ext name', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 5, 8, 9, 4, 7)) // local: 2026-06-08 09:04:07
    expect(timestampedName('comps', 'png')).toBe('comps-20260608-090407.png')
  })

  it('zero-pads every field', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 0, 1, 0, 0, 0)) // local: 2026-01-01 00:00:00
    expect(timestampedName('stargazer', 'png')).toBe('stargazer-20260101-000000.png')
  })
})
