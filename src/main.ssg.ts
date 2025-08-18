import { ViteSSG } from 'vite-ssg'
import { createPinia } from 'pinia'
import App from './App.vue'
import { routes } from './router/routes'
import { loadCharacterImages } from './utils/dataLoader'
import { useGameDataStore } from './stores/gameData'
import { useI18nStore } from './stores/i18n'

import './styles/base.css'
import './styles/variables.css'

/**
 * SSG Entry Point
 *
 * Uses the same route definitions as the SPA (imported from router/routes.ts)
 * to ensure consistency between modes. During SSG, vite-ssg will:
 * - Pre-render content pages (/en/about, /zh/skill/*, etc.)
 * - Skip the home page (it's a fully interactive app)
 * - Generate static HTML with proper locale attributes
 */
export const createApp = ViteSSG(App, { routes }, async ({ app, router, initialState }) => {
  const pinia = createPinia()
  app.use(pinia)

  if (import.meta.env.SSR) {
    // During SSG: Set locale based on route before rendering each page
    router.beforeEach((to) => {
      const match = to.path.match(/^\/(en|zh)\//)
      if (match) {
        const i18n = useI18nStore(pinia)
        // setLocale is SSR-safe and will skip browser APIs during SSG
        i18n.setLocale(match[1] as 'en' | 'zh')
      }
    })

    // Pre-load only what's needed for content pages
    // Load character images for GridSnippet component
    const characterImages = loadCharacterImages()

    // Store minimal data in initialState
    initialState.gameData = {
      characterImages,
    }
  } else if (initialState.gameData) {
    // On client: Restore pre-fetched character images
    const gameDataStore = useGameDataStore(pinia)
    gameDataStore.setCharacterImages(initialState.gameData.characterImages)
  }
})
