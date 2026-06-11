import { readdirSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import { imagetools } from 'vite-imagetools'
import vueDevTools from 'vite-plugin-vue-devtools'
import generateSitemap from 'vite-ssg-sitemap'

// SSG Helpers

// Derive skill list from the locale dir — every hero with skill text gets a
// route. Optional `<HeroName>.<lang>.vue` snippet files in src/content/skill/
// are discovered at runtime via import.meta.glob; they don't gate routing.
const skillLocaleDir = fileURLToPath(new URL('./src/locales/skill/en', import.meta.url))
const skillIds = readdirSync(skillLocaleDir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.replace(/\.json$/, ''))
  .sort()

const locales = ['en', 'zh']

/** Returns all routes to pre-render during SSG */
function getSSGRoutes(): string[] {
  // Pre-render static HTML so canonical/meta are correct without JS.
  const routes: string[] = ['/', '/share', '/skills', '/wandwars']

  locales.forEach((locale) => {
    routes.push(`/${locale}/guide`)
    skillIds.forEach((skillId) => {
      routes.push(`/${locale}/skill/${skillId}`)
    })
  })

  return routes
}

/** Extracts description from rendered page content's first 1-2 <p> tags */
function extractContentDescription(html: string): string | null {
  const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/)
  if (!articleMatch) return null

  const paragraphs = [...articleMatch[1].matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)]
  if (paragraphs.length === 0) return null

  const text = paragraphs
    .slice(0, 2)
    .map((m) =>
      m[1]
        .replace(/<[^>]+>/g, '') // Strip HTML tags
        .replace(/\[\[(.+?)\]\]/g, '$1') // Strip [[]] skill markers (mirrors HIGHLIGHT_RE in src/utils/textHighlight.ts)
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .join(' ')

  if (!text) return null
  if (text.length <= 150) return text

  // Cut at the last word boundary before 150 chars; spaceless text (e.g. zh) cuts at 150
  const cut = text.lastIndexOf(' ', 150)
  return text.slice(0, cut > 0 ? cut : 150) + ' ...'
}

/** vite-ssg emits asset `<link>` tags in two passes (static manifest +
 * dynamic-import resolution); modules reachable from both are listed twice.
 * Keep the first occurrence per href. */
function dedupeAssetLinks(html: string): string {
  const seen = new Set<string>()
  return html.replace(
    /<link[^>]+href="(\/assets\/[^"]+)"[^>]*>\s*/g,
    (full, href: string) => {
      if (seen.has(href)) return ''
      seen.add(href)
      return full
    },
  )
}

/** Post-processes SSG-rendered pages: sets lang attribute and derives skill descriptions */
function processRenderedPage(route: string, html: string): string {
  const match = route.match(/^\/(en|zh)\//)
  if (match) {
    html = html.replace(/<html[^>]*>/, `<html lang="${match[1]}">`)
  }

  html = dedupeAssetLinks(html)

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
    } else {
      console.warn(
        `[ssg] extractContentDescription found nothing on ${route} — meta description falling back to template default.`,
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
