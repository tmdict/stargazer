/**
 * Shared palette for skill visual effects: targeting arrows, tile borders and
 * fills, and connection lines. Hues are referenced by name so a color shared
 * across characters stays identical and retunes in one place.
 * Each is a CSS variable with a value per look (variables.css), so an effect sets
 * it through `style`, never an SVG attribute, where var() doesn't resolve.
 */
export const SKILL_COLORS = {
  red: 'var(--skill-red)', // galahad, hepler, satrana, zandrok
  crimson: 'var(--skill-crimson)', // natsu, talene
  rust: 'var(--skill-rust)', // elijah-lailah (one faction between)
  amber: 'var(--skill-amber)', // aliceth, dunlingr (spellbind)
  gold: 'var(--skill-gold)', // natsu, phantimal (spirit marks)
  green: 'var(--skill-green)', // bonnie, callan, daimon, isabella, nara, niru, silvina
  teal: 'var(--skill-teal)', // faramor, ravion, thador
  blue: 'var(--skill-blue)', // cassadee, evie, himmel, hugin
  sky: 'var(--skill-sky)', // elijah-lailah
  steel: 'var(--skill-steel)', // alna
  lavender: 'var(--skill-lavender)', // frieren
  purple: 'var(--skill-purple)', // gunnar, pandora, reinier, vala
  lilac: 'var(--skill-lilac)', // dunlingr (curelock)
  orchid: 'var(--skill-orchid)', // kulu (breakable tiles)
  slate: 'var(--skill-slate)', // kulu (demolition zone)
} as const
