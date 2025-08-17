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
    // English routes
    {
      path: '/en/about',
      name: 'about-en',
      component: AboutView,
      props: { locale: 'en' },
    },
    {
      path: '/en/skill/:name',
      name: 'skill-en',
      component: SkillView,
      props: (route) => ({ locale: 'en', name: route.params.name }),
    },
    // Chinese routes
    {
      path: '/zh/about',
      name: 'about-zh',
      component: AboutView,
      props: { locale: 'zh' },
    },
    {
      path: '/zh/skill/:name',
      name: 'skill-zh',
      component: SkillView,
      props: (route) => ({ locale: 'zh', name: route.params.name }),
    },
  ],
})

export default router
