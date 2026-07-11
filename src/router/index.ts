import { createRouter, createWebHistory } from 'vue-router'

import { installChunkErrorRecovery, routes, scrollBehavior, warmSkillLocale } from './routes'

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior,
})

router.beforeResolve(warmSkillLocale)
installChunkErrorRecovery(router)

export default router
