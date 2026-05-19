/** Strips display-only tokens from skill descriptions: `[[value]]` collapses
 * to `value`, `<TAG>` is dropped. Search + snippet rendering both operate on
 * the cleaned form. */
export function cleanSkillText(raw: string): string {
  return raw
    .replace(/\[\[([^\]]*)\]\]/g, '$1')
    .replace(/<[A-Z]+>/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

export interface Snippet {
  pre: string
  match: string
  post: string
}

/** ±`context` chars around the first case-insensitive match. `text` is
 * expected to be already cleaned via {@link cleanSkillText}. */
export function renderSnippet(text: string, query: string, context = 30): Snippet | null {
  if (!query) return null
  const i = text.toLowerCase().indexOf(query.toLowerCase())
  if (i < 0) return null

  const start = Math.max(0, i - context)
  const end = Math.min(text.length, i + query.length + context)
  return {
    pre: (start > 0 ? '…' : '') + text.slice(start, i),
    match: text.slice(i, i + query.length),
    post: text.slice(i + query.length, end) + (end < text.length ? '…' : ''),
  }
}
