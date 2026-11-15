import type { Breakpoint } from '@/utils/breakpoints'

/* 5 v 5 board hex size per breakpoint. The boards row scrolls horizontally, so size
 * isn't bound by fitting five across: tablet and mobile match the Arena's breakpoint
 * sizes, and the wider tiers sit just above tablet. Shared by the Teams page and
 * the read-only multi-board share view. */
const SIZE: Record<Breakpoint, { x: number; y: number }> = {
  wide: { x: 36, y: 36 },
  desktop: { x: 32, y: 32 },
  laptop: { x: 32, y: 32 },
  tablet: { x: 30, y: 30 },
  mobile: { x: 23, y: 23 },
}

export function teamsBoardSize(breakpoint: Breakpoint): { x: number; y: number } {
  return SIZE[breakpoint]
}
