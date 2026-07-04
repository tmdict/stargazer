/* SSR-guarded, quota-tolerant localStorage helpers shared by the persistence
 * composables and the saved-team library store. Persistence is best-effort
 * everywhere: private mode, disabled storage, or quota failures are silent. */

export const readStorage = (key: string): string | null => {
  if (import.meta.env.SSR) return null
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export const writeStorage = (key: string, value: string): void => {
  if (import.meta.env.SSR) return
  try {
    localStorage.setItem(key, value)
  } catch {
    // Best-effort.
  }
}

export const removeStorage = (key: string): void => {
  if (import.meta.env.SSR) return
  try {
    localStorage.removeItem(key)
  } catch {
    // Best-effort.
  }
}
