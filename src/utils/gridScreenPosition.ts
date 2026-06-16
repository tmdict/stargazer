// Convert a grid-SVG-space point (e.g. layout.hexToPixel) to viewport
// coordinates. getScreenCTM folds in the perspective transform + page position,
// so callers placing fixed overlays needn't. Pass the board's own SVG when more
// than one grid is on the page (5 v 5); otherwise the first grid is used. Null if
// the grid SVG isn't mounted.
export function svgPointToScreen(
  point: { x: number; y: number },
  svgEl?: SVGSVGElement | null,
): { x: number; y: number } | null {
  const svg = svgEl ?? document.querySelector<SVGSVGElement>('.grid-tiles')
  if (!svg) return null
  const ctm = svg.getScreenCTM()
  if (!ctm) return null
  const pt = svg.createSVGPoint()
  pt.x = point.x
  pt.y = point.y
  const screen = pt.matrixTransform(ctm)
  return { x: screen.x, y: screen.y }
}
