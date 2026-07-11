import type {
  RouteLocationNormalized,
  Router,
  RouteRecordRaw,
  RouterScrollBehavior,
} from 'vue-router'

import { SKILL_LOCALE_CODES, type SkillLocale } from '@/lib/types/i18n'
import { loadSkillLocale } from '@/utils/dataLoader'

/**
 * Shared route definitions used by both SPA and SSG modes.
 *
 * These routes define the structure of the application and are imported by:
 * - src/router/index.ts (for SPA mode)
 * - src/main.ssg.ts (for SSG mode)
 */

// Anchors the skill route's param to the exact skill-locale set; anything else
// falls through to the not-found redirect.
const SKILL_LOCALE_PATTERN = SKILL_LOCALE_CODES.join('|')

// The locale chunk must be warm before a skill route renders: vite-ssg
// renders each route exactly once with no Suspense, so an un-awaited chunk
// would bake fallback text into the static HTML (and the meta description
// would be scraped from the wrong language). Client navigation shares the
// warm-up, so SkillSections stays a synchronous component.
//
// A global beforeResolve, not beforeEnter on the record: beforeEnter skips
// param-only navigation, and the globe menu's locale switch is exactly that
// (same record, new :textLocale).
async function warmSkillLocale(
  to: RouteLocationNormalized,
  from: RouteLocationNormalized,
): Promise<boolean | void> {
  if (to.name !== 'skill') return
  try {
    await loadSkillLocale(to.params.textLocale as SkillLocale)
  } catch {
    // Chunk fetch failed: offline, or a stale tab importing a re-hashed chunk
    // after a deploy. A hard navigation picks up fresh HTML and chunk URLs; on
    // the initial load (nothing fresher to fetch) proceed and let the reader
    // render the en fallback.
    if (!import.meta.env.SSR && from.matched.length > 0) {
      window.location.assign(to.fullPath)
      return false
    }
  }
}

// Import-failure wording differs per engine (Chrome "Failed to fetch
// dynamically imported module", Safari "Importing a module script failed",
// Firefox "error loading dynamically imported module", plus the module-MIME
// variant the SPA rewrite produces), so match the family.
const CHUNK_ERROR_RE =
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Failed to load module script/i

// A deploy purges the previous build's hashed chunks, so a stale tab's next
// lazy route import fails (the SPA rewrite answers the miss with index.html)
// and vue-router would swallow the aborted navigation: header clicks die
// until a hard refresh. Recover by completing the click as a full navigation
// onto the new build. Remembering the last recovered URL keeps a persistent
// failure (offline, a blocked chunk) from looping: its second failure stays
// a dead click. Route chunks are the only unhandled dynamic imports (skill
// locales recover in warmSkillLocale, html-to-image failures toast), so no
// vite:preloadError backstop: it would fire first, and preventing its
// rethrow starves this handler of the destination.
const CHUNK_RECOVERY_KEY = 'stargazer.chunk-recovery'

function installChunkErrorRecovery(router: Router): void {
  if (import.meta.env.SSR) return
  router.onError((error, to) => {
    if (!(error instanceof Error) || !CHUNK_ERROR_RE.test(error.message)) return
    try {
      if (sessionStorage.getItem(CHUNK_RECOVERY_KEY) === to.fullPath) return
      sessionStorage.setItem(CHUNK_RECOVERY_KEY, to.fullPath)
    } catch {
      return
    }
    window.location.assign(to.fullPath)
  })
}

// One installer for both entries (SPA router/index.ts, SSG main.ssg.ts), so
// the guard set cannot drift between them.
export function installRouterGuards(router: Router): void {
  // Awaited by each pre-render's navigation, so baked pages carry real text.
  router.beforeResolve(warmSkillLocale)
  installChunkErrorRecovery(router)
}

// Back/forward restores the reader's position (providing scrollBehavior at
// all flips history.scrollRestoration to manual, so the saved position must
// win even on hash-bearing URLs); fresh hash links (search-overlay deep
// links to a skill section) scroll to their anchor. Everything else is left
// alone, so hero-to-hero roster browsing keeps the current scroll as before.
// Shared by both entries like the routes and the warm-up guard.
export const scrollBehavior: RouterScrollBehavior = (to, _from, savedPosition) => {
  if (savedPosition) return savedPosition
  if (to.hash) return { el: to.hash }
  return false
}

export const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: () => import('@/views/HomeView.vue'),
  },
  {
    path: '/share',
    name: 'share',
    component: () => import('@/views/ShareView.vue'),
  },
  {
    // The prefix is the skill-text language, one route across all 16 locales.
    // Chrome stays en/zh and is resolved separately (see routeLocale.ts).
    path: `/:textLocale(${SKILL_LOCALE_PATTERN})/skill/:name`,
    name: 'skill',
    component: () => import('@/views/SkillView.vue'),
    props: true, // Pass route params as props for better testability
    // Locale chunk warm-up lives in warmSkillLocale (global beforeResolve).
  },
  // Guide stays en/zh: its content is hand-written in the app locales.
  {
    path: '/en/guide',
    name: 'guide-en',
    component: () => import('@/views/GuideView.vue'),
  },
  {
    path: '/zh/guide',
    name: 'guide-zh',
    component: () => import('@/views/GuideView.vue'),
  },
  {
    path: '/wandwars',
    name: 'wandwars',
    component: () => import('@/views/WandWarsView.vue'),
  },
  {
    path: '/skills',
    name: 'skills',
    component: () => import('@/views/SkillsView.vue'),
  },
  // Client-only image tool (canvas/clipboard/file APIs); not pre-rendered.
  {
    path: '/teams',
    name: 'teams',
    component: () => import('@/views/TeamsView.vue'),
  },
  // Unknown URLs (stale links, typos) redirect home instead of rendering a
  // blank router-view. Dynamic path: skipped by SSG pre-rendering.
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    redirect: '/',
  },
]
