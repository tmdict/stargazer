/* Skill modes: heroes whose skill runs in one of several modes the player
 * picks before battle, keyed by base hero id. A placed hero stores its mode's
 * position in this list as hero attribute 3 (ATTR_SKILL_MODE), so every list
 * is append-only: a mode is never reordered or removed, and a new one goes at
 * the end. Position 0 is the default and is never stored. The attribute's
 * 4-bit value field allows up to 16 modes per hero. */

import type { BadgeIcon } from '../types/unitBadge'
import { SKILL_COLORS } from './utils/colors'

export interface SkillMode {
  // App locale key holding the game's name for the mode.
  name: string
  color: string
}

interface HeroSkillModes {
  icon: BadgeIcon
  modes: readonly SkillMode[]
}

export const SKILL_MODES: Readonly<Record<number, HeroSkillModes>> = {
  // Dunlingr's Bell of Order
  57: {
    icon: 'bell',
    modes: [
      { name: 'spellbind', color: SKILL_COLORS.gold },
      { name: 'curelock', color: SKILL_COLORS.lilac },
    ],
  },
  // Natsu
  78: {
    icon: 'flame',
    modes: [
      { name: 'lightning-fire-dragon-mode', color: SKILL_COLORS.gold },
      { name: 'fire-dragon-king-mode', color: SKILL_COLORS.crimson },
    ],
  },
}
