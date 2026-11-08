/* What the Arena and Teams pages and the generator page pass each other in the
 * browser's history entry: never stored and in no link, so a reload keeps it
 * and a shared address does not. Generate's ↗ leaves `generatorFrom`, the page
 * it came from, whose saved boards the generator then reads; Open in Teams
 * leaves `generatedSide`, the set as shown, which the Teams page opens as a
 * new team. */

import { isTeamModeKey, type TeamModeKey } from '@/lib/teams/modes'

export type GeneratorFrom = 'arena' | TeamModeKey

export const isGeneratorFrom = (value: unknown): value is GeneratorFrom =>
  value === 'arena' || isTeamModeKey(value)

// The Teams mode a page's boards make: the Arena's one board is a 1v1.
export const generatorMode = (from: GeneratorFrom): TeamModeKey => (from === 'arena' ? '1v1' : from)
