// Where a shop popup opens, for every page that shows one.

import type { Point } from '@/lib/layout'

export const below = (under: DOMRect): Point => ({ x: under.left, y: under.bottom + 4 })

// The width under which shop.css gives the popups their phone layout.
export const onPhone = (): boolean => window.matchMedia('(max-width: 520px)').matches
