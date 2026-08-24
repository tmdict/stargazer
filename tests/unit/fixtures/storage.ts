/**
 * In-memory localStorage stub for persistence suites. Call in beforeEach and
 * pair with vi.unstubAllGlobals() in afterEach; each call starts empty.
 */

import { vi } from 'vitest'

export function stubLocalStorage() {
  const storage = new Map<string, string>()
  const setItemSpy = vi.fn((key: string, value: string) => {
    storage.set(key, value)
  })
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: setItemSpy,
    removeItem: (key: string) => storage.delete(key),
    clear: () => storage.clear(),
  })
  return { storage, setItemSpy }
}
