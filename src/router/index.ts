import { createRouter, createWebHistory } from 'vue-router'

import AboutView from '../views/About.vue'
import HomeView from '../views/Home.vue'
import SkillView from '../views/Skill.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/about',
      name: 'about',
      component: AboutView,
    },
    {
      path: '/skill/:name',
      name: 'skill',
      component: SkillView,
    },
  ],
})

export default router
