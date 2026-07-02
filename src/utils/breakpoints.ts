// Viewport breakpoint ladder (px). A tier is exported when a JS detector
// (useBreakpoint, useBottomSheet, SkillsBrowser, SkillSearchOverlay) builds a
// matchMedia query from it; tiers used only by CSS @media rules stay literals
// there (CSS can't reference these consts), with this list as the shared
// reference; the CSS literals must match.
//
//   480 / 768   mobile / tablet
//   1220        two-column stack point (arena, /skills, /guide, WandWars)
//   1280        desktop-chrome boundary (padding, gaps, font tuning)
//   1600 / 1920 reader-column width steps (GuideView, SkillsBrowser)
export const MOBILE_MAX_WIDTH = 480
export const TABLET_MAX_WIDTH = 768
export const SPLIT_MIN_WIDTH = 1220
