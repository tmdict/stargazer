/* SSR-guarded, quota-tolerant localStorage helpers shared by the persistence
 * composables and the library stores (saved teams, rosters). Persistence is best-effort
 * everywhere: private mode, disabled storage, or quota failures are silent. */

// False where the browser refuses the page its storage, which a read alone
// cannot tell from an item that was never written.
export const storageReadable = (): boolean => {
  if (import.meta.env.SSR) return false
  try {
    localStorage.getItem('stargazer.flags')
    return true
  } catch {
    return false
  }
}

export const readStorage = (key: string): string | null => {
  if (import.meta.env.SSR) return null
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

// Returns whether the write landed, for callers that want to report data loss
// (the saved-team library); board autosave callers ignore it.
export const writeStorage = (key: string, value: string): boolean => {
  if (import.meta.env.SSR) return false
  try {
    localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

export const removeStorage = (key: string): void => {
  if (import.meta.env.SSR) return
  try {
    localStorage.removeItem(key)
  } catch {
    // Best effort, like every other storage call.
  }
}
