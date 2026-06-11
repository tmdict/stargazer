// Renders skill descriptions to HTML: [[value]] → highlight span,
// <STAT> → stat-tag span. Output is consumed via v-html / innerHTML; input is
// from a controlled feed, not user input.

const STAT_LABEL: Record<string, string> = {
  ATK: 'ATK',
  HP: 'HP',
  ARM: 'Armor',
  MR: 'Magic Resist',
  CRIT: 'Crit',
  HAST: 'Haste',
  LFS: 'Lifesteal',
  BAP: 'Skill Power',
  UAP: 'Ult Power',
}

// Canonical skill-text token grammar. searchHighlight and scripts/import-skills
// derive their stripping/reordering from these; vite.config.ts mirrors the
// [[...]] pattern with a pointer comment (build config can't import src).
export const HIGHLIGHT_RE = /\[\[(.+?)\]\]/g
export const STAT_TAG_RE = /<([A-Z][A-Za-z0-9_]*)>/g

export function highlightSkillText(text: string): string {
  if (!text) return text
  let out = text.replace(HIGHLIGHT_RE, '<span class="skill-highlight">$1</span>')
  out = out.replace(STAT_TAG_RE, (_m, tag: string) => {
    const label = STAT_LABEL[tag] ?? tag
    return `<span class="skill-stat-tag skill-stat-${tag.toLowerCase()}">${label}</span>`
  })
  return out
}
