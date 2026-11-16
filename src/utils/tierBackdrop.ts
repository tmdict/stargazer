/* The backdrop behind a picture of a rarity tier, a top-to-bottom gradient.
   The stops are data, so a style and an SVG gradient draw the same one. */

export type BackdropTier = 'rare' | 'elite' | 'epic'

// A colour and where it sits, in percent from the top.
type BackdropStop = readonly [color: string, at: number]

export const BACKDROP_STOPS: Record<BackdropTier, readonly BackdropStop[]> = {
  rare: [
    ['#626e8c', 50],
    ['#7985af', 100],
  ],
  elite: [
    ['#745087', 0],
    ['#8465af', 50],
    ['#a57ad3', 100],
  ],
  epic: [
    ['#dd8c3a', 0],
    ['#f4b749', 50],
    ['#fcce5e', 100],
  ],
}

const HERO_TIERS: Record<string, BackdropTier> = { rare: 'rare', a: 'elite', s: 'epic' }

// A hero's tier by the `level` of its data file.
export const heroTier = (level: string): BackdropTier | undefined => HERO_TIERS[level]

export const tierBackdrop = (tier: BackdropTier): string =>
  `linear-gradient(${BACKDROP_STOPS[tier].map(([color, at]) => `${color} ${at}%`).join(', ')})`

export const heroBackdrop = (level: string): string | undefined => {
  const tier = heroTier(level)
  return tier && tierBackdrop(tier)
}
