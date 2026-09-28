/* Saved-team backup files: a Stargazer export file (lib/exportFile) holding the
 * whole library. Records are re-validated and canonicalized through the same
 * rules as hydration before they merge. */

import { mergeImport, readExportFile, type MergeResult } from '@/lib/exportFile'
import { teamContentKey, validateSavedTeam, type SavedTeam } from './savedTeam'

export interface TeamsExportFile {
  app: 'stargazer'
  kind: 'saved-teams'
  exportedAt: string
  teams: SavedTeam[]
}

export function buildExport(teams: readonly SavedTeam[], exportedAt: string): TeamsExportFile {
  return {
    app: 'stargazer',
    kind: 'saved-teams',
    exportedAt,
    teams: [...teams],
  }
}

// Season-blind for seasonal-free teams, so an old export of an unchanged team
// still dedupes across a season flip.
const contentKey = (team: SavedTeam): string => teamContentKey(team.data) ?? team.data

// Null when the file is not a saved-teams export.
export function parseImport(
  raw: string,
  existing: readonly SavedTeam[],
): MergeResult<SavedTeam> | null {
  const records = readExportFile(raw, 'saved-teams', 'teams')
  if (records === null) return null
  return mergeImport(records, existing, validateSavedTeam, contentKey)
}
