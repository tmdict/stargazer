import { loadSkillLocales } from '@/utils/dataLoader'

// Used by SkillView as a route guard. A hero is "documented" iff it has an
// en locale file.
export const DOCUMENTED_SKILLS = Object.keys(loadSkillLocales().en).sort()
