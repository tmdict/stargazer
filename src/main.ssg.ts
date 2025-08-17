import { ViteSSG } from 'vite-ssg'
import { createPinia } from 'pinia'
import App from './App.vue'
import type { RouteRecordRaw } from 'vue-router'
import { loadCharacterImages } from './utils/dataLoader'
import { useGameDataStore } from './stores/gameData'

import './styles/base.css'
import './styles/variables.css'

/**
 * SSG Route Configuration
 *
 * This defines routes for both pre-rendered content pages and the client-side home page.
 * The home page is included here but NOT pre-rendered because:
 *
 * 1. The game is fully interactive and requires JavaScript to function
 * 2. It has complex state management (characters, artifacts, grid state)
 * 3. There's no SEO benefit to pre-rendering an interactive canvas game
 * 4. Arena grids should load dynamically, not be static HTML
 *
 * By including the home route here, vite-ssg knows about it and can handle
 * client-side routing to it, but won't attempt to pre-render it. This gives us
 * the best of both worlds: SEO-friendly content pages + dynamic game experience.
 */
const routes: RouteRecordRaw[] = [
  // Home page - client-side only (not pre-rendered)
  {
    path: '/',
    name: 'home',
    component: () => import('./views/Home.vue'),
  },
  // Content pages - will be pre-rendered
  {
    path: '/:locale(en|zh)/about',
    name: 'about',
    component: () => import('./views/About.vue'),
    props: (route) => ({ locale: route.params.locale }),
  },
  {
    path: '/:locale(en|zh)/skill/:name',
    name: 'skill',
    component: () => import('./views/Skill.vue'),
    props: (route) => ({
      locale: route.params.locale as string,
      name: route.params.name as string,
    }),
  },
]

export const createApp = ViteSSG(App, { routes }, async ({ app, initialState }) => {
  const pinia = createPinia()
  app.use(pinia)

  if (import.meta.env.SSR) {
    // During SSG: Pre-load only what's needed for content pages
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
