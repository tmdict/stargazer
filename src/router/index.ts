import { createRouter, createWebHistory } from 'vue-router'

import { installRouterGuards, routes, scrollBehavior } from './routes'

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior,
})

installRouterGuards(router)

export default router
