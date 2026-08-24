/**
 * Character ids shared by suites that run against the real skill registry.
 * The ALLY_/ENEMY_ ids have no registered skill, so placement has no side
 * effects; the named heroes are code-registered and usable without loaded
 * game data.
 */

import { COMPANION_ID_OFFSET } from '@/lib/grid'

export const ALLY_A = 11
export const ALLY_B = 12
export const ALLY_C = 13
export const ENEMY_A = 21
export const ENEMY_B = 22

export const PHRAESTO = 50 // companion spawn: raises capacity, throws with no free tile
export const PHRAESTO_COMPANION = COMPANION_ID_OFFSET + PHRAESTO
export const KULU = 80 // cosmetic demolition zone: ally 18-24, enemy 22-28
export const GUNNAR = 106 // behind-tile highlight; activation never fails
