/**
 * Seasonal phantimal Spirit Mark highlights.
 *
 * Each phantimal registers a skill under its namespaced ID that marks the unit
 * on its priority-behind tile (Necrodrakon: priority-front), the same
 * adjacent-tile priority Daimon uses. The mark paints both tile channels
 * (fill + border) in a yellow reserved for seasonal marks, so they read
 * apart from hero highlights.
 *
 * Retirement: delete this file and tests/unit/skills/phantimal.test.ts in the
 * same step as the phantimal data/locale JSONs; retired IDs restored from old
 * URLs still place, and would otherwise keep activating this skill. The
 * ./seasonal/*.ts glob in skill.ts is inert once this directory is empty.
 */
import { toPhantimalId } from '../../characters/phantimal'
import { registerSkill } from '../registry'
import type { Skill, SkillContext, TilePaint } from '../skill'
import { withTilePaint } from '../utils/builders'
import { findAdjacentPriorityTarget, type TargetDirection } from '../utils/targeting'

const SPIRIT_MARK_COLOR = '#fbc02d'

// One target computation feeds both paint channels.
function spiritMarkTiles(direction: TargetDirection) {
  return (ctx: SkillContext): TilePaint[] => {
    const info = findAdjacentPriorityTarget(ctx, direction)
    if (!info?.targetHexId) return []
    return [
      { hexId: info.targetHexId, color: SPIRIT_MARK_COLOR },
      { hexId: info.targetHexId, color: SPIRIT_MARK_COLOR, fill: true },
    ]
  }
}

const spiritMarks: { localId: number; name: string; direction: TargetDirection }[] = [
  { localId: 1, name: 'aurelian', direction: 'behind' },
  { localId: 2, name: 'orson', direction: 'behind' },
  { localId: 3, name: 'blightshroom', direction: 'behind' },
  { localId: 4, name: 'necrodrakon', direction: 'front' },
  { localId: 5, name: 'midnight-hunter', direction: 'behind' },
]

for (const { localId, name, direction } of spiritMarks) {
  const base: Skill = {
    id: `phantimal-${name}`,
    characterId: toPhantimalId(localId),
    onActivate() {},
    onDeactivate() {},
  }
  registerSkill(withTilePaint(base, spiritMarkTiles(direction)))
}
