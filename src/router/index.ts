import { createRouter, createWebHashHistory } from 'vue-router'

import HomeView from '../views/Home.vue'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/about',
      name: 'about',
      component: () => import('../views/About.vue'),
    },
    {
      path: '/link',
      name: 'link',
      component: () => import('../views/Links.vue'),
    },
  ],
})

export default router
