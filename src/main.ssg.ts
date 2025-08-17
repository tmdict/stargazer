import { ViteSSG } from 'vite-ssg'
import { createPinia } from 'pinia'
import App from './App.vue'
import type { RouteRecordRaw } from 'vue-router'
import { loadCharacterImages } from './utils/dataLoader'
import { useGameDataStore } from './stores/gameData'

import './styles/base.css'
import './styles/variables.css'

// Define only the content routes for SSG
const routes: RouteRecordRaw[] = [
  // Home page - client-side only
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

export const createApp = ViteSSG(App, { routes }, async ({ app, isClient, initialState }) => {
  const pinia = createPinia()
  app.use(pinia)

  if (!isClient) {
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
