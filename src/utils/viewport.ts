// Window-size reads for overlay positioning. Call sites import a named intent
// from here instead of reading window globals: window.innerWidth/innerHeight
// include any classic scrollbar (macOS with a mouse attached, Windows), while
// position: fixed boxes are laid out in, and getBoundingClientRect reports
// against, the layout viewport, which excludes it. Clamping a popup against
// innerWidth parks it under the scrollbar, and a shrink-to-fit box forced
// narrower there re-triggers any ResizeObserver watching it, visibly walking
// the box down to its minimum width. ESLint bans the raw globals outside this
// file.

/** Layout viewport width: the coordinate space of `position: fixed` boxes. */
export function viewportWidth(): number {
  return document.documentElement.clientWidth
}

/** Layout viewport height. */
export function viewportHeight(): number {
  return document.documentElement.clientHeight
}

/** Width a classic scrollbar takes from the window (0 with overlay scrollbars). */
export function scrollbarGutter(): number {
  return window.innerWidth - document.documentElement.clientWidth
}

/**
 * Window height as mobile browsers resolve it under toolbar collapse (CSS
 * dvh). For clamping fixed boxes, use viewportHeight.
 */
export function dynamicViewportHeight(): number {
  return window.innerHeight
}

/**
 * Clamp a fixed box's left edge so the box stays inside the layout viewport,
 * pinning to the left margin when it cannot fit.
 */
export function clampX(left: number, width: number, margin: number): number {
  return Math.max(margin, Math.min(left, viewportWidth() - width - margin))
}

/** Vertical counterpart of clampX, pinning to the top margin. */
export function clampY(top: number, height: number, margin: number): number {
  return Math.max(margin, Math.min(top, viewportHeight() - height - margin))
}
