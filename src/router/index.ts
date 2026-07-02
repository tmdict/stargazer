import { createRouter, createWebHistory } from 'vue-router'

import { routes, warmSkillLocale } from './routes'

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeResolve(warmSkillLocale)

export default router
