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

// Inside a [[...]] token, a trailing `|key` marks a glossary keyword: the key
// resolves against the language's `_keywords` glossary for its tooltip text
// (SkillKeywordTooltip). A pipeless token is a plain value highlight.
const KEYWORD_KEY_RE = /^(.*)\|([A-Za-z][A-Za-z0-9_]*)$/s

export function splitHighlightToken(inner: string): { label: string; key?: string } {
  const m = KEYWORD_KEY_RE.exec(inner)
  return m ? { label: m[1]!, key: m[2]! } : { label: inner }
}

export function statLabel(tag: string): string {
  return STAT_LABEL[tag] ?? tag
}

export function highlightSkillText(text: string): string {
  if (!text) return text
  let out = text.replace(HIGHLIGHT_RE, (_m, inner: string) => {
    const { label, key } = splitHighlightToken(inner)
    return key
      ? `<span class="skill-keyword" data-kw="${key}">${label}</span>`
      : `<span class="skill-highlight">${label}</span>`
  })
  out = out.replace(
    STAT_TAG_RE,
    (_m, tag: string) =>
      `<span class="skill-stat-tag skill-stat-${tag.toLowerCase()}">${statLabel(tag)}</span>`,
  )
  return out
}
