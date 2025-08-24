import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import { imagetools } from 'vite-imagetools'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import generateSitemap from 'vite-ssg-sitemap'
import { DOCUMENTED_SKILLS } from './src/lib/skill'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), vueDevTools(), imagetools()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // @ts-expect-error - vite-ssg extends config at runtime
  ssgOptions: {
    entry: 'src/main.ssg.ts', // Use SSG-specific entry
    script: 'async',
    formatting: 'minify',
    includedRoutes: () => {
      // Get skill IDs from the single source of truth
      const skillIds = [...DOCUMENTED_SKILLS]
      const locales = ['en', 'zh']

      const routes: string[] = [
        '/', // Include home but won't be pre-rendered (no static content)
        '/share', // Include share for direct URL navigation
      ]

      // Add about pages
      locales.forEach((locale) => {
        routes.push(`/${locale}/about`)
      })

      // Add skill pages
      locales.forEach((locale) => {
        skillIds.forEach((skillId) => {
          routes.push(`/${locale}/skill/${skillId}`)
        })
      })

      return routes
    },
    onPageRendered: (route: string, html: string) => {
      // Extract locale from route for proper lang attribute
      const match = route.match(/^\/(en|zh)\//)
      if (match) {
        const locale = match[1]
        // Replace html lang attribute
        return html.replace(/<html[^>]*>/, `<html lang="${locale}">`)
      }
      return html
    },
    onFinished() {
      generateSitemap({
        hostname: 'https://stargazer.tmdict.com',
        changefreq: 'weekly',
        priority: 0.8,
        readable: true,
        generateRobotsTxt: true,
      })
    },
  },
})
