import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import { imagetools } from 'vite-imagetools'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), vueDevTools(), imagetools()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // @ts-ignore - vite-ssg extends config at runtime
  ssgOptions: {
    entry: 'src/main.ssg.ts', // Use SSG-specific entry
    script: 'async',
    formatting: 'minify',
    includedRoutes: () => {
      // Only generate content pages
      const skillIds = ['silvina', 'vala', 'dunlingr', 'reinier']
      const locales = ['en', 'zh']
      
      const routes: string[] = [
        '/', // Include home but won't be pre-rendered (no static content)
      ]
      
      // Add about pages
      locales.forEach(locale => {
        routes.push(`/${locale}/about`)
      })
      
      // Add skill pages
      locales.forEach(locale => {
        skillIds.forEach(skillId => {
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
  },
})
