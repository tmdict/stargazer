/* The guide's pages, one route per app locale each. Shared by the router,
 * the SSG route list (vite.config.ts) and the page meta, so a page added
 * here is routed, pre-rendered and titled in one place. Relative import:
 * vite.config.ts type-checks this file without the `@` alias. */

import type { AppLocale } from './types/i18n.ts'

export type GuidePage = 'index' | 'upgrades' | 'mechanics'

export const GUIDE_PAGES: readonly GuidePage[] = ['index', 'upgrades', 'mechanics']

export const guidePath = (locale: AppLocale, page: GuidePage): string =>
  page === 'index' ? `/${locale}/guide` : `/${locale}/guide/${page}`
