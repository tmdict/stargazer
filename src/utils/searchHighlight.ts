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

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** First case-insensitive occurrence, located on the original string: index
 * arithmetic on toLowerCase output shifts under length-changing folds (İ). */
function findMatch(text: string, query: string): { start: number; end: number } | null {
  if (!query) return null
  const m = new RegExp(escapeRegExp(query), 'iu').exec(text)
  return m ? { start: m.index, end: m.index + m[0].length } : null
}

/** One run of skill text: a plain stretch, a `[[value]]` highlight, or a
 * `<TAG>` stat chip; plain and value runs are flagged when they fall inside
 * the query match. */
export interface RichPiece {
  text: string
  kind: 'plain' | 'value' | 'stat'
  /** Lowercased stat tag, for the chip's color class. */
  tag?: string
  marked: boolean
}

/** Renders raw skill text with its token styling intact, marking the first
 * query match. Matching runs on the corpus view of the text — chip labels
 * skipped and whitespace runs collapsed, as in {@link cleanSkillText} — so
 * the pane marks what the search actually hit; residual disagreements (a
 * whitespace run split across a chip) render unmarked rather than mis-marked. */
export function renderRichText(raw: string, query: string): RichPiece[] {
  const segments: Omit<RichPiece, 'marked'>[] = []
  const pushText = (text: string, kind: 'plain' | 'value') =>
    segments.push({ text: text.replace(/\s{2,}/g, ' '), kind })
  let last = 0
  for (const m of raw.matchAll(new RegExp(`${HIGHLIGHT_RE.source}|${STAT_TAG_RE.source}`, 'g'))) {
    if (m.index > last) pushText(raw.slice(last, m.index), 'plain')
    if (m[1] !== undefined) pushText(m[1], 'value')
    else if (m[2] !== undefined)
      segments.push({ text: statLabel(m[2]), kind: 'stat', tag: m[2].toLowerCase() })
    last = m.index + m[0].length
  }
  if (last < raw.length) pushText(raw.slice(last), 'plain')

  const searchable = segments.map((s) => (s.kind === 'stat' ? '' : s.text)).join('')
  const match = findMatch(searchable, query)

  const pieces: RichPiece[] = []
  let pos = 0
  for (const s of segments) {
    if (s.kind === 'stat') {
      pieces.push({ ...s, marked: false })
      continue
    }
    const sStart = pos
    const sEnd = (pos += s.text.length)
    if (!match || sEnd <= match.start || sStart >= match.end) {
      pieces.push({ ...s, marked: false })
    } else {
      const a = Math.max(match.start, sStart) - sStart
      const b = Math.min(match.end, sEnd) - sStart
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
  const match = findMatch(text, query)
  if (!match) return null

  const start = Math.max(0, match.start - context)
  const end = Math.min(text.length, match.end + context)
  return {
    pre: (start > 0 ? '…' : '') + text.slice(start, match.start),
    match: text.slice(match.start, match.end),
    post: text.slice(match.end, end) + (end < text.length ? '…' : ''),
  }
}
