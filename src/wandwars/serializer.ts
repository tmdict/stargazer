import { getResultSymbol } from './formatting'
import type { RecordedMatch } from './types'

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
