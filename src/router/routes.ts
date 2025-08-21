import type { RouteRecordRaw } from 'vue-router'

/**
 * Shared route definitions used by both SPA and SSG modes.
 *
 * These routes define the structure of the application and are imported by:
 * - src/router/index.ts (for SPA mode)
 * - src/main.ssg.ts (for SSG mode)
 */
export const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: () => import('../views/Home.vue'),
  },
  {
    path: '/share',
    name: 'share',
    component: () => import('../views/Share.vue'),
  },
  // English routes
  {
    path: '/en/about',
    name: 'about-en',
    component: () => import('../views/About.vue'),
  },
  {
    path: '/en/skill/:name',
    name: 'skill-en',
    component: () => import('../views/Skill.vue'),
    props: true, // Pass route params as props for better testability
  },
  // Chinese routes
  {
    path: '/zh/about',
    name: 'about-zh',
    component: () => import('../views/About.vue'),
  },
  {
    path: '/zh/skill/:name',
    name: 'skill-zh',
    component: () => import('../views/Skill.vue'),
    props: true, // Pass route params as props for better testability
  },
]
