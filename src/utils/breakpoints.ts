// Viewport breakpoint ladder (px). The mobile tier is exported because the JS
// detectors (useBreakpoint, useBottomSheet) build matchMedia queries from it. The
// desktop tier lives only in CSS @media rules (CSS can't reference these consts)
// and is listed here as the shared reference; the CSS literals must match.
//
//   480 / 768   mobile / tablet
//   1220        two-column stack point (arena, /skills, /guide, WandWars)
//   1280        desktop-chrome boundary (padding, gaps, font tuning)
//   1600 / 1920 reader-column width steps (GuideView, SkillsBrowser)
export const MOBILE_MAX_WIDTH = 480
export const TABLET_MAX_WIDTH = 768
