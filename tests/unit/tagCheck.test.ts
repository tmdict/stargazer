import { describe, expect, it } from 'vitest'

import type { CharacterTags } from '@/lib/types/skill'
import { orphanTags, type FeedHeroKit } from '../../scripts/lib/tagCheck'

const levels = (count: number) => Array.from({ length: count }, (_, i) => ({ level: i + 1 }))

const kit: FeedHeroKit = { skills: { ultimate: { levels: levels(5) }, ex: { levels: levels(4) } } }

describe('orphanTags', () => {
  it('reports a slot or level the kit lacks and a key that is no slot, and nothing else', () => {
    const tags = {
      debuff: [{ ultimate: 1, mods: ['global'] }, { ex: 4 }],
      dot: [{ skill3: 1 }, { ultmate: 1 }],
      summon: [{ ex: 5, mods: ['global'] }],
    } as unknown as CharacterTags
    expect(orphanTags('hero', tags, kit).map((o) => `${o.tag} ${o.attachment}`)).toEqual([
      'dot skill3:1',
      'dot ultmate:1',
      'summon ex:5',
    ])
  })
})
