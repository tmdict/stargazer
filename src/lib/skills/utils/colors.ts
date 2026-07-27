/**
 * Shared palette for skill visual effects: targeting arrows, tile borders and
 * fills, unit borders, and connection lines. Skills reference a hue by name so
 * recurring colors stay identical across characters and retune in one place;
 * which hue a character uses remains that skill's choice.
 */
export const SKILL_COLORS = {
  red: '#e57373', // galahad, hepler, satrana, zandrok
  crimson: '#c83232', // phraesto (clone), talene
  rust: '#cd7169', // elijah-lailah (lailah)
  amber: '#ffa000', // aliceth, dunlingr
  gold: '#fbc02d', // phantimal (spirit marks)
  green: '#98be5d', // bonnie, callan, daimon, isabella, nara, niru, silvina
  teal: '#6d9c86', // faramor, ravion, thador
  blue: '#0288d1', // cassadee, evie, himmel, hugin
  sky: '#51abcb', // elijah-lailah (elijah)
  steel: '#7badc4', // alna
  lavender: '#b0a8d0', // frieren
  purple: '#9661f1', // gunnar, pandora, reinier, vala
  orchid: '#a47fb8', // kulu (breakable tiles)
  slate: '#565b63', // kulu (demolition zone)
  white: '#ffffff', // phraesto
} as const
