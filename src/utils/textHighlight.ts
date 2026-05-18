// Renders skill descriptions to HTML: [[value]] → highlight span,
// <STAT> → stat-tag span. Output is consumed via v-html / innerHTML; input is
// from a controlled feed, not user input.

const STAT_LABEL: Record<string, string> = {
  ATK: 'ATK',
  HP: 'HP',
}

const HIGHLIGHT_RE = /\[\[(.+?)\]\]/g
const STAT_TAG_RE = /\{([a-z]+)\}/g

export function highlightSkillText(text: string): string {
  if (!text) return text
  let out = text.replace(HIGHLIGHT_RE, '<span class="skill-highlight">$1</span>')
  out = out.replace(STAT_TAG_RE, (_m, tag: string) => {
    const label = STAT_LABEL[tag] ?? tag
    return `<span class="skill-stat-tag skill-stat-${tag.toLowerCase()}">${label}</span>`
  })
  return out
}
