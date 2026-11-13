/* The guide's pages, one route each. Shared by the router, the SSG route list
 * (vite.config.ts) and the page meta: a page added here is pre-rendered and
 * needs a title, and the router names its view (router/routes.ts). Relative
 * import: vite.config.ts type-checks this file without the `@` alias. */

export type GuidePage = 'index' | 'upgrades' | 'mechanics'

export const GUIDE_PAGES: readonly GuidePage[] = ['index', 'upgrades', 'mechanics']

export const guidePath = (page: GuidePage): string =>
  page === 'index' ? '/guide' : `/guide/${page}`

// The PvP team generator and Who Would Win?, beside the season reports,
// each pre-rendered with its heading alone (GuideSlView, GuideWwwView), the
// rules the generator places its heroes by, and the lists those rules read.
export const SL_GENERATOR_PATH = '/guide/pvp/generator'
export const SL_RULES_PATH = '/guide/pvp/generator/rules'
export const SL_LISTS_PATH = '/guide/pvp/generator/rules/lists'
export const WWW_PATH = '/guide/pvp/www'
