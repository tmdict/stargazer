import type { RecordedMatch } from './types'

function getResultSymbol(winner: 'left' | 'right' | 'draw', dominant: boolean): string {
  if (winner === 'draw') return '='
  if (winner === 'left') return dominant ? '>>' : '>'
  return dominant ? '<<' : '<'
}

export function serializeMatch(match: RecordedMatch): string {
  const left = match.left.join(',')
  const right = match.right.join(',')
  const symbol = getResultSymbol(match.winner, match.dominant)
  const line = `${left} ${symbol} ${right}`
  return match.notes.trim() ? `${line};${match.notes.trim()}` : line
}

export function serializeMatches(matches: RecordedMatch[]): string {
  return matches.map(serializeMatch).join('\n') + '\n'
}
