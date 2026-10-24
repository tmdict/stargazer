/* The guide's pages, one route each. Shared by the router, the SSG route list
 * (vite.config.ts) and the page meta, so a page added here is routed,
 * pre-rendered and titled in one place. Relative import: vite.config.ts
 * type-checks this file without the `@` alias. */

export type GuidePage = 'index' | 'upgrades' | 'mechanics'

export const GUIDE_PAGES: readonly GuidePage[] = ['index', 'upgrades', 'mechanics']

export const guidePath = (page: GuidePage): string =>
  page === 'index' ? '/guide' : `/guide/${page}`

// The Supreme League generator, beside the season reports. A tool drawn in the
// browser, so it is not among the pre-rendered pages.
export const SL_GENERATOR_PATH = '/guide/pvp/sl'
