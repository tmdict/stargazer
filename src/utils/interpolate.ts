// Replaces {key} tokens in `text` with values from `vars`.
// Tokens not present in `vars` are left untouched, so this composes safely
// with other formatters (e.g. WandWars hero-name HTML) that share the same syntax.
export function interpolate(text: string, vars: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (match, key) => (key in vars ? String(vars[key]) : match))
}
