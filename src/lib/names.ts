/* Naming rules shared by the user-named libraries (saved teams, rosters). */

export const MAX_NAME_LENGTH = 60

export function sanitizeName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const name = raw.trim().slice(0, MAX_NAME_LENGTH)
  return name.length > 0 ? name : null
}

// "<base> N", counting on from the library size and skipping names in use.
export function nextAutoName(existingNames: readonly string[], base: string): string {
  const taken = new Set(existingNames)
  let n = existingNames.length + 1
  while (taken.has(`${base} ${n}`)) n++
  return `${base} ${n}`
}

// Truncate the base, not the suffix, so a max-length name still gets a
// visibly distinct derived name.
export function suffixedName(name: string, suffix: string): string {
  return `${name.slice(0, MAX_NAME_LENGTH - suffix.length)}${suffix}`
}

// `base` itself when free, else "base - 2", "base - 3", and so on.
export function uniqueName(existingNames: readonly string[], base: string): string {
  const taken = new Set(existingNames)
  if (!taken.has(base)) return base
  for (let n = 2; ; n++) {
    const candidate = suffixedName(base, ` - ${n}`)
    if (!taken.has(candidate)) return candidate
  }
}

export function duplicateName(name: string): string {
  return suffixedName(name, ' (copy)')
}
