import { createRouter, createWebHistory } from 'vue-router'

import { routes, scrollBehavior, warmSkillLocale } from './routes'

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior,
})

router.beforeResolve(warmSkillLocale)

export default router
