// The numbers shown with a skill (cooldown, initial cooldown, range), derived
// from the feed's skillNumbers.json. Pure functions; import-skills.ts reads the
// feed and writes what these return to src/data/skill/numbers.json.
//
// The rules:
//   - A cooldown shows unless it is one of the game's "no timer" values (9999,
//     99999, 999999, 9999990), so 0 (an instant skill) shows and so would any
//     long real cooldown. The initial cooldown follows the same rule.
//   - A range shows unless it is absent; 15 tiles and up reads as "Global",
//     as in the game's skill panel.
// The game's panel shows the hero's current level, while a skill page lists
// every level, so a slot carries its Lv1 values plus, per later level, only
// the values that level changes.
//
// The same feed carries each hero's starting energy. The app shows the hero
// file's own copy, so the import only compares the two (energyMismatches).

import {
  SLOT_ORDER,
  type SkillNumbers,
  type SlotKey,
  type SlotNumbers,
  type SlotValues,
} from '../../src/lib/types/skill.ts'

// The smallest of the game's "no timer" values.
const NO_TIMER = 9999
const GLOBAL_RANGE_AT = 15

export interface FeedLevelNumbers {
  level: number
  cd: number
  initCd: number
  range: number | null
}

export interface FeedHeroNumbers {
  // The energy the hero starts a battle with.
  startMp?: number
  skills: Partial<Record<SlotKey, FeedLevelNumbers[]>>
}

function levelValues({ cd, initCd, range }: FeedLevelNumbers): SlotValues {
  const out: SlotValues = {}
  if (cd < NO_TIMER) {
    out.cooldown = cd
    if (initCd < NO_TIMER) out.initialCooldown = initCd
  }
  if (range !== null) out.range = range >= GLOBAL_RANGE_AT ? 'global' : range
  return out
}

const VALUE_KEYS = ['cooldown', 'initialCooldown', 'range'] as const

const isEmpty = (values: object): boolean => Object.keys(values).length === 0

/** One slot's numbers. A value that a later level removes can't be shown as a
 * change, so it is reported instead. */
function slotNumbers(levels: readonly FeedLevelNumbers[]): {
  numbers: SlotNumbers
  problems: string[]
} {
  const values = levels.map(levelValues)
  const numbers: SlotNumbers = { ...values[0] }
  const problems: string[] = []
  for (let i = 1; i < values.length; i++) {
    const prev = values[i - 1]!
    const next = values[i]!
    const level = levels[i]!.level
    for (const key of VALUE_KEYS) {
      if (prev[key] !== undefined && next[key] === undefined) {
        problems.push(`${key} disappears at Lv ${level}`)
      }
    }
    const changed: SlotValues = Object.fromEntries(
      VALUE_KEYS.filter((key) => next[key] !== undefined && next[key] !== prev[key]).map((key) => [
        key,
        next[key],
      ]),
    )
    if (!isEmpty(changed)) numbers.levels = { ...numbers.levels, [level]: changed }
  }
  return { numbers, problems }
}

export function heroSkillNumbers(
  slug: string,
  hero: FeedHeroNumbers,
): { numbers: Partial<Record<SlotKey, SlotNumbers>>; problems: string[] } {
  const numbers: Partial<Record<SlotKey, SlotNumbers>> = {}
  const problems: string[] = []
  for (const slot of SLOT_ORDER) {
    const levels = hero.skills[slot]
    if (!levels?.length) continue
    const result = slotNumbers(levels)
    problems.push(...result.problems.map((p) => `${slug}/${slot}: ${p}`))
    if (!isEmpty(result.numbers)) numbers[slot] = result.numbers
  }
  return { numbers, problems }
}

/** Hero files whose starting energy is not the feed's. A file's first energy
 * number is typed by hand and is the one the app shows and filters by, so a
 * balance change reaches it only through this report. A feed that stops
 * carrying the number is reported too, or the comparison would pass by
 * finding nothing to compare. A hero the feed lacks is reported by
 * skillNumbers. */
export function energyMismatches(
  heroes: Record<string, FeedHeroNumbers>,
  files: readonly { slug: string; energy: readonly number[] }[],
): string[] {
  return files.flatMap(({ slug, energy }) => {
    const hero = heroes[slug]
    if (!hero) return []
    if (typeof hero.startMp !== 'number') return [`${slug}: the feed has no starting energy`]
    return hero.startMp === energy[0]
      ? []
      : [`${slug}: the hero file starts at ${energy[0]}, the feed at ${hero.startMp}`]
  })
}

/** The whole file, for the given heroes in slug order. */
export function skillNumbers(
  heroes: Record<string, FeedHeroNumbers>,
  slugs: readonly string[],
): { numbers: SkillNumbers; problems: string[] } {
  const numbers: SkillNumbers = {}
  const problems: string[] = []
  for (const slug of [...slugs].sort()) {
    const hero = heroes[slug]
    if (!hero) {
      problems.push(`${slug}: not in the feed's skill numbers`)
      continue
    }
    const result = heroSkillNumbers(slug, hero)
    problems.push(...result.problems)
    if (!isEmpty(result.numbers)) numbers[slug] = result.numbers
  }
  return { numbers, problems }
}
