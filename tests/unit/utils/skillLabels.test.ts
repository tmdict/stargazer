import { describe, expect, it } from 'vitest'

import { skillMetaItems } from '@/utils/skillLabels'

const EN = {
  ultimate: 'Ultimate',
  ex: 'Exclusive Equipment',
  cooldown: 'Cooldown: ${1}\nInitial Cooldown: ${2}',
  range: 'Range: ${1}',
  rangeGlobal: 'Global',
}
const ZH = {
  ultimate: '终极技能',
  ex: '专属装备',
  cooldown: '冷却时间：${1}\n初始冷却时间：${2}',
  range: '技能范围：${1}',
  rangeGlobal: '全场',
}

// Stands in for the arrow the component draws between chained values.
const text = (items: ReturnType<typeof skillMetaItems>) =>
  items.map((i) => `${i.before}${i.values.join(' → ')}${i.after}`)

describe('skillMetaItems', () => {
  it("fills the game's templates with bare numbers, one item per value", () => {
    expect(skillMetaItems({ cooldown: 7, initialCooldown: 1.25, range: 1 }, EN)).toEqual([
      { before: 'Cooldown: ', values: ['7'], after: '' },
      { before: 'Initial Cooldown: ', values: ['1.25'], after: '' },
      { before: 'Range: ', values: ['1'], after: '' },
    ])
  })

  it('shows a zero cooldown', () => {
    expect(text(skillMetaItems({ cooldown: 0, initialCooldown: 0 }, EN))).toEqual([
      'Cooldown: 0',
      'Initial Cooldown: 0',
    ])
  })

  it('reads in the skill-text language', () => {
    expect(text(skillMetaItems({ cooldown: 12, initialCooldown: 0, range: 'global' }, ZH))).toEqual(
      ['冷却时间：12', '初始冷却时间：0', '技能范围：全场'],
    )
  })

  it('chains values that later levels change, in level order', () => {
    expect(
      text(
        skillMetaItems(
          {
            cooldown: 15,
            initialCooldown: 15,
            range: 2,
            levels: {
              5: { cooldown: 10 },
              3: { cooldown: 12, initialCooldown: 12, range: 'global' },
            },
          },
          EN,
        ),
      ),
    ).toEqual(['Cooldown: 15 → 12 → 10', 'Initial Cooldown: 15 → 12', 'Range: 2 → Global'])
  })

  it('drops the lines whose values are absent', () => {
    expect(text(skillMetaItems({ cooldown: 15 }, EN))).toEqual(['Cooldown: 15'])
    expect(text(skillMetaItems({ range: 'global' }, EN))).toEqual(['Range: Global'])
  })

  it('shows nothing without numbers or labels', () => {
    expect(skillMetaItems(undefined, EN)).toEqual([])
    expect(skillMetaItems({}, EN)).toEqual([])
    expect(skillMetaItems({ cooldown: 7 }, undefined)).toEqual([])
  })
})
