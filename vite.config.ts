import { readdirSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import { imagetools } from 'vite-imagetools'
import vueDevTools from 'vite-plugin-vue-devtools'
import generateSitemap from 'vite-ssg-sitemap'

// SSG Helpers

// Derive skill list from directory structure (Node context, no import.meta.glob)
const skillContentDir = fileURLToPath(new URL('./src/content/skill', import.meta.url))
const skillIds = readdirSync(skillContentDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort()

const locales = ['en', 'zh']

/** Returns all routes to pre-render during SSG */
function getSSGRoutes(): string[] {
  const routes: string[] = [
    '/', // Include home but won't be pre-rendered (no static content)
    '/share', // Include share for direct URL navigation
  ]

  locales.forEach((locale) => {
    routes.push(`/${locale}/about`)
    skillIds.forEach((skillId) => {
      routes.push(`/${locale}/skill/${skillId}`)
    })
  })

  return routes
}

/** Extracts description from rendered page content's first 1-2 <p> tags */
function extractContentDescription(html: string): string | null {
  const articleMatch = html.match(/<article>([\s\S]*?)<\/article>/)
  if (!articleMatch) return null

  const paragraphs = [...articleMatch[1].matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)]
  if (paragraphs.length === 0) return null

  const text = paragraphs
    .slice(0, 2)
    .map((m) =>
      m[1]
        .replace(/<[^>]+>/g, '') // Strip HTML tags
        .replace(/\[\[(.+?)\]\]/g, '$1') // Strip [[]] skill markers
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .join(' ')

  if (!text) return null

  return text.length <= 150 ? text : text.slice(0, text.lastIndexOf(' ', 150) || 150) + ' ...'
}

/** Post-processes SSG-rendered pages: sets lang attribute and derives skill descriptions */
function processRenderedPage(route: string, html: string): string {
  const match = route.match(/^\/(en|zh)\//)
  if (match) {
    html = html.replace(/<html[^>]*>/, `<html lang="${match[1]}">`)
  }

  // Auto-derive description from content for skill pages
  if (route.match(/^\/(en|zh)\/skill\//)) {
    const description = extractContentDescription(html)
    if (description) {
      const escaped = description.replace(/"/g, '&quot;')
      html = html.replace(
        /<meta name="description" content="[^"]*">/,
        `<meta name="description" content="${escaped}">`,
      )
      html = html.replace(
        /<meta property="og:description" content="[^"]*">/,
        `<meta property="og:description" content="${escaped}">`,
      )
    }
  }

  return html
}

// Vite Config

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
    includedRoutes: getSSGRoutes,
    onPageRendered: processRenderedPage,
    onFinished() {
      generateSitemap({
        hostname: 'https://stargazer.tmdict.com',
        changefreq: 'monthly',
        priority: 0.8,
        generateRobotsTxt: true,
        // @ts-expect-error - vite-ssg-sitemap types do not allow disabling lastmod
        lastmod: '',
      })
    },
  },
})
