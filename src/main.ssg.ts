import { createPinia } from 'pinia'
import { ViteSSG } from 'vite-ssg'

import App from './App.vue'
import { vScrollChain } from '@/directives/scrollChain'
import { installRouterGuards, routes, scrollBehavior } from '@/router/routes'

import './styles/base.css'
import './styles/controls.css'
import './styles/variables.css'

/**
 * SSG Entry Point
 *
 * Uses the same route definitions as the SPA (imported from router/routes.ts)
 * to ensure consistency between modes. vite-ssg pre-renders every route in
 * vite.config's getSSGRoutes: the skill permalinks across all SKILL_LOCALES
 * languages, the en/zh guide pages, and the interactive shells (/, /share,
 * /skills), which carry canonical/meta and hydrate into the app.
 *
 * Chrome locale comes from the en/zh URL prefix (App.vue store sync); skill
 * pages read their text locale from the :textLocale route param.
 */
export const createApp = ViteSSG(App, { routes, scrollBehavior }, async ({ app, router }) => {
  app.use(createPinia())
  app.directive('scroll-chain', vScrollChain)
  installRouterGuards(router)
})
