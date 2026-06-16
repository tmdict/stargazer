import { createPinia } from 'pinia'
import { ViteSSG } from 'vite-ssg'

import App from './App.vue'
import { vScrollChain } from '@/directives/scrollChain'
import { routes } from '@/router/routes'

import './styles/base.css'
import './styles/variables.css'

/**
 * SSG Entry Point
 *
 * Uses the same route definitions as the SPA (imported from router/routes.ts)
 * to ensure consistency between modes. During SSG, vite-ssg will:
 * - Pre-render the skill permalink pages (/{en,zh}/skill/*), the only SSG content
 * - Skip the home page (it's a fully interactive app)
 * - Generate static HTML with proper locale attributes
 *
 * Locale is extracted from the URL path in each view component.
 */
export const createApp = ViteSSG(App, { routes }, async ({ app }) => {
  app.use(createPinia())
  app.directive('scroll-chain', vScrollChain)
})
