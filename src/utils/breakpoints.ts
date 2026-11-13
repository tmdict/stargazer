// Site-wide viewport tiers (px). A tier is exported when script builds a
// matchMedia query from it (useBreakpoint, useNarrowViewport, SkillsBrowser,
// SkillSearchOverlay); CSS @media rules write the same numbers as literals
// (CSS can't reference these consts), and the two must match.
//
//   480 / 768   mobile / tablet
//   1220        two-column stack point (arena, /skills)
//   1280        desktop-chrome boundary (padding, gaps, font tuning)
//   1599        laptop: board, portrait and control sizes a step under desktop
//   1600 / 1920 reader-column width steps (SkillsBrowser)
//
// Other widths (374, 420, 640, 700, 720, 920, 1100, 1320) are local to the
// layouts that use them and are written there. GuideSlRulesView's 1101 query
// pairs with the 1100 rule of its own layout.
export const MOBILE_MAX_WIDTH = 480
export const TABLET_MAX_WIDTH = 768
export const SPLIT_MIN_WIDTH = 1220
export const LAPTOP_MAX_WIDTH = 1599

export type Breakpoint = 'mobile' | 'tablet' | 'laptop' | 'desktop'

// The tiers where the side panel is a bottom sheet.
export const isNarrowBreakpoint = (breakpoint: Breakpoint): boolean =>
  breakpoint === 'mobile' || breakpoint === 'tablet'
