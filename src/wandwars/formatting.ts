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

export function formatName(name: string): string {
  return name
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export function formatNoteHtml(text: string): string {
  return text.replace(
    /\{([^}]+)\}/g,
    (_, name: string) => `<strong class="hero-highlight">${formatName(name)}</strong>`,
  )
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
