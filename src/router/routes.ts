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
    component: () => import('@/views/HomeView.vue'),
  },
  {
    path: '/share',
    name: 'share',
    component: () => import('@/views/ShareView.vue'),
  },
  // English routes
  {
    path: '/en/skill/:name',
    name: 'skill-en',
    component: () => import('@/views/SkillView.vue'),
    props: true, // Pass route params as props for better testability
  },
  {
    path: '/en/guide/:name?',
    name: 'guide-en',
    component: () => import('@/views/GuideView.vue'),
    props: true,
  },
  {
    path: '/wandwars',
    name: 'wandwars',
    component: () => import('@/views/WandWarsView.vue'),
  },
  {
    path: '/skills',
    name: 'skills',
    component: () => import('@/views/SkillsView.vue'),
  },
  // Chinese routes
  {
    path: '/zh/skill/:name',
    name: 'skill-zh',
    component: () => import('@/views/SkillView.vue'),
    props: true, // Pass route params as props for better testability
  },
  {
    path: '/zh/guide/:name?',
    name: 'guide-zh',
    component: () => import('@/views/GuideView.vue'),
    props: true,
  },
]
