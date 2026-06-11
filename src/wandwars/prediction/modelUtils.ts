import type { HeroStats, MatchNote, MatchResult } from '../types'
import { wilsonConfidence } from './confidence'

/**
 * Get notes where the candidate hero is referenced in {heroName} tags.
 */
export function getRelevantNotes(candidate: string, matches: MatchResult[]): MatchNote[] {
  const notes: MatchNote[] = []
  for (const match of matches) {
    for (const note of match.notes) {
      if (note.heroes.includes(candidate)) {
        notes.push(note)
      }
    }
  }
  return notes
}

/**
 * Get notes where ALL referenced heroes are present in the teams.
 */
export function getMatchupNotes(
  leftTeam: string[],
  rightTeam: string[],
  matches: MatchResult[],
): MatchNote[] {
  const allHeroSet = new Set([...leftTeam, ...rightTeam])
  const notes: MatchNote[] = []
  for (const match of matches) {
    for (const note of match.notes) {
      if (note.heroes.length > 0 && note.heroes.every((h) => allHeroSet.has(h))) {
        notes.push(note)
      }
    }
  }
  return notes
}

/**
 * Wilson confidence for a hero's stats.
 */
export function getHeroWilsonConfidence(stats: HeroStats | undefined): 'high' | 'medium' | 'low' {
  if (!stats || stats.matches === 0) return 'low'
  return wilsonConfidence(stats.wins + stats.draws * 0.5, stats.matches)
}
