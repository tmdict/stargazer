// Wraps text inside [[double brackets]] in a styled span used by skill/effect descriptions.
// Output is HTML; consumers must render via innerHTML or v-html.
export function highlightSkillText(text: string): string {
  return text.replace(/\[\[(.+?)\]\]/g, '<span class="skill-highlight">$1</span>')
}
