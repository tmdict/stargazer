import { useI18nStore } from '@/stores/i18n'

/**
 * Join translated words with a space for English, no space for Chinese.
 */
export function joinLocale(...parts: string[]): string {
  try {
    const i18n = useI18nStore()
    return parts.join(i18n.currentLocale === 'zh' ? '' : ' ')
  } catch {
    return parts.join(' ')
  }
}

export function formatPercent(value: number | undefined): string {
  if (value === undefined) return '—'
  return (value * 100).toFixed(1) + '%'
}

export function formatScore(score: number): string {
  return (score * 100).toFixed(1) + '%'
}

export function formatSigned(value: number | undefined): string {
  if (value === undefined) return '—'
  const pct = (value * 100).toFixed(1)
  return value >= 0 ? `+${pct}%` : `${pct}%`
}

/**
 * Format a hero name using the current locale.
 * Tries i18n character translation first, falls back to title-case formatting.
 */
export function formatName(name: string): string {
  try {
    const i18n = useI18nStore()
    const translated = i18n.t(`character.${name}`)
    if (translated !== `character.${name}`) return translated
  } catch {
    // i18n not available (e.g., in Node scripts or before store init)
  }
  return name
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

// Escape HTML-significant characters so user-provided text rendered via v-html stays inert.
// Tokens like `{hero}` survive because `{` and `}` are not escaped: the regex pass below
// re-introduces controlled markup for those.
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function formatNoteHtml(
  text: string,
  leftTeam: string[] = [],
  rightTeam: string[] = [],
): string {
  const leftSet = new Set(leftTeam)
  const rightSet = new Set(rightTeam)
  return escapeHtml(text).replace(/\{([^}]+)\}/g, (_, name: string) => {
    let cls = 'hero-highlight'
    if (leftSet.has(name)) cls += ' team-left'
    else if (rightSet.has(name)) cls += ' team-right'
    return `<strong class="${cls}">${formatName(name)}</strong>`
  })
}

export function signClass(value: number | undefined): string {
  if (value === undefined || value === 0) return ''
  return value > 0 ? 'positive' : 'negative'
}

export function getResultSymbol(winner: 'left' | 'right' | 'draw', dominant: boolean): string {
  if (winner === 'draw') return '='
  if (winner === 'left') return dominant ? '>>' : '>'
  return dominant ? '<<' : '<'
}
