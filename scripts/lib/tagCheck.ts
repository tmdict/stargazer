// The tag check the skill import runs on each hero file: every attachment must
// pin a slot and level the hero's kit has. Pure; import-skills.ts feeds it the
// hero file and the feed's entry.

import type { CharacterTags, SlotKey } from '../../src/lib/types/skill.ts'

export interface OrphanTag {
  slug: string
  tag: string
  attachment: string // e.g. "ultimate:5"
  reason: string
}

// The part of a feed hero the check reads.
export interface FeedHeroKit {
  skills: Partial<Record<SlotKey, { levels: { level: number }[] }>>
}

export function orphanTags(
  slug: string,
  tags: CharacterTags | undefined,
  hero: FeedHeroKit,
): OrphanTag[] {
  const orphans: OrphanTag[] = []
  for (const [tag, attachments] of Object.entries(tags ?? {})) {
    for (const entry of attachments) {
      // Every key but `mods` is read as a slot, so a misspelt one is reported
      // as a slot the kit lacks. So is `charm`: charm tags live in the charm
      // data, never in a hero file.
      for (const [pin, level] of Object.entries(entry)) {
        if (pin === 'mods') continue
        const attachment = `${pin}:${level}`
        const slot = hero.skills[pin as SlotKey]
        if (!slot) {
          orphans.push({ slug, tag, attachment, reason: `slot "${pin}" not in hero's kit` })
        } else if (!slot.levels.some((l) => l.level === level)) {
          const have = slot.levels.map((l) => l.level).join(', ')
          orphans.push({
            slug,
            tag,
            attachment,
            reason: `level ${level} not in ${pin} (have: ${have})`,
          })
        }
      }
    }
  }
  return orphans
}
