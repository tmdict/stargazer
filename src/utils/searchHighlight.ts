import { HIGHLIGHT_RE, STAT_TAG_RE, statLabel } from './textHighlight'

/** Strips display-only tokens from skill descriptions: `[[value]]` collapses
 * to `value`, `<TAG>` is dropped. Search + snippet rendering both operate on
 * the cleaned form. */
export function cleanSkillText(raw: string): string {
  return raw
    .replace(HIGHLIGHT_RE, '$1')
    .replace(STAT_TAG_RE, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

export interface Snippet {
  pre: string
  match: string
  post: string
}

/** One run of skill text: a plain stretch, a `[[value]]` highlight, or a
 * `<TAG>` stat chip, flagged when it falls inside the query match. */
export interface RichPiece {
  text: string
  kind: 'plain' | 'value' | 'stat'
  /** Lowercased stat tag, for the chip's color class. */
  tag?: string
  marked: boolean
}

/** Renders raw skill text with its token styling intact, marking the first
 * case-insensitive query match across the visible text. The match can miss
 * where a stat chip's label interrupts what `cleanSkillText` joined — the
 * text then simply renders unmarked. */
export function renderRichText(raw: string, query: string): RichPiece[] {
  const segments: Omit<RichPiece, 'marked'>[] = []
  let last = 0
  for (const m of raw.matchAll(new RegExp(`${HIGHLIGHT_RE.source}|${STAT_TAG_RE.source}`, 'g'))) {
    if (m.index > last) segments.push({ text: raw.slice(last, m.index), kind: 'plain' })
    if (m[1] !== undefined) segments.push({ text: m[1], kind: 'value' })
    else if (m[2] !== undefined)
      segments.push({ text: statLabel(m[2]), kind: 'stat', tag: m[2].toLowerCase() })
    last = m.index + m[0].length
  }
  if (last < raw.length) segments.push({ text: raw.slice(last), kind: 'plain' })

  const visible = segments.map((s) => s.text).join('')
  const start = query ? visible.toLowerCase().indexOf(query.toLowerCase()) : -1
  const end = start + query.length

  const pieces: RichPiece[] = []
  let pos = 0
  for (const s of segments) {
    const sStart = pos
    const sEnd = (pos += s.text.length)
    if (start < 0 || sEnd <= start || sStart >= end) {
      pieces.push({ ...s, marked: false })
    } else if (s.kind === 'stat') {
      // Chips render whole; any overlap marks the entire chip.
      pieces.push({ ...s, marked: true })
    } else {
      const a = Math.max(start, sStart) - sStart
      const b = Math.min(end, sEnd) - sStart
      if (a > 0) pieces.push({ text: s.text.slice(0, a), kind: s.kind, marked: false })
      pieces.push({ text: s.text.slice(a, b), kind: s.kind, marked: true })
      if (b < s.text.length) pieces.push({ text: s.text.slice(b), kind: s.kind, marked: false })
    }
  }
  return pieces
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
