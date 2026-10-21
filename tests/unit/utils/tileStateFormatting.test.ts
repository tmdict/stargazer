import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { Team } from '@/lib/types/team'
import { TEAM_COLORS } from '@/utils/tileStateFormatting'

describe('TEAM_COLORS', () => {
  it('draws the teams in the colours of the CSS team tokens', () => {
    const css = readFileSync('src/styles/variables.css', 'utf-8')
    const token = (name: string): string | undefined =>
      css.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6});`, 'i'))?.[1]
    expect(TEAM_COLORS[Team.ALLY]).toBe(token('color-ally'))
    expect(TEAM_COLORS[Team.ENEMY]).toBe(token('color-enemy'))
  })
})
