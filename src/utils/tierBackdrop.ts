/* The backdrop behind a picture of a rarity tier, a top-to-bottom gradient.
   The stops are data, so a style and an SVG gradient draw the same one. */

type BackdropTier = 'rare' | 'elite' | 'epic' | 'legendary' | 'mythic' | 'supreme'

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
  legendary: [
    ['#b9232b', 0],
    ['#b44742', 50],
    ['#cf6450', 100],
  ],
  mythic: [
    ['#f3edef', 0],
    ['#fcf8f8', 50],
    ['#ececfc', 100],
  ],
  supreme: [
    ['#c4fbeb', 0],
    ['#b9e1fa', 25],
    ['#ddc7fa', 50],
    ['#fee9da', 75],
    ['#fff8de', 100],
  ],
}

// The two pale tiers, where text set on the backdrop has to be dark.
export const isPaleTier = (tier: BackdropTier): boolean => tier === 'mythic' || tier === 'supreme'

const HERO_TIERS: Record<string, BackdropTier> = { rare: 'rare', a: 'elite', s: 'epic' }

// A hero's tier by the `level` of its data file.
export const heroTier = (level: string): BackdropTier | undefined => HERO_TIERS[level]

export const tierBackdrop = (tier: BackdropTier): string =>
  `linear-gradient(${BACKDROP_STOPS[tier].map(([color, at]) => `${color} ${at}%`).join(', ')})`

export const heroBackdrop = (level: string): string | undefined => {
  const tier = heroTier(level)
  return tier && tierBackdrop(tier)
}
