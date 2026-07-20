// Unknown or typo'd `{key}` tokens are left as-is so they render visibly instead
// of collapsing to "undefined".
export function interpolate(text: string, vars: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (match, key) => (key in vars ? String(vars[key]) : match))
}
