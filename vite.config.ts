import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import { imagetools } from 'vite-imagetools'
import vueDevTools from 'vite-plugin-vue-devtools'
import generateSitemap from 'vite-ssg-sitemap'

import { SITE_ORIGIN } from './src/lib/site'
import { APP_LOCALES, SKILL_LOCALES } from './src/lib/types/i18n'
import { HIGHLIGHT_RE, splitHighlightToken } from './src/utils/textHighlight'

// SSG Helpers

// Skill routes derive from the locale dirs: every (language, hero) file on
// disk gets a route. Optional `<HeroName>.<lang>.vue` snippet files in
// src/content/skill/ are discovered at runtime via import.meta.glob; they
// don't gate routing.
const skillLocaleRoot = fileURLToPath(new URL('./src/locales/skill', import.meta.url))

// Any valid skill-text prefix (used to stamp <html lang> and to scope the
// description extraction to skill pages).
const localePattern = SKILL_LOCALES.map((l) => l.code).join('|')
const LOCALE_PREFIX_RE = new RegExp(`^\\/(${localePattern})\\/`)
const SKILL_ROUTE_RE = new RegExp(`^\\/(${localePattern})\\/skill\\/`)

/** Returns all routes to pre-render during SSG */
function getSSGRoutes(): string[] {
  // Pre-render static HTML so canonical/meta are correct without JS.
  const routes: string[] = ['/', '/share', '/skills']

  // Guide pages exist only in the app locales.
  APP_LOCALES.forEach((locale) => routes.push(`/${locale}/guide`))

  for (const { code } of SKILL_LOCALES) {
    const dir = join(skillLocaleRoot, code)
    // SKILL_LOCALES is the contract; a missing dir means the importer hasn't
    // run for a newly added language, and continuing would silently ship a
    // build whose menu and hreflang link to pages that don't exist.
    if (!existsSync(dir)) {
      throw new Error(`[ssg] missing skill locale dir "${code}"; run npm run import:skills`)
    }
    readdirSync(dir)
      // Underscore-prefixed files are per-language data (the `_keywords`
      // glossary), not hero pages.
      .filter((f) => f.endsWith('.json') && !f.startsWith('_'))
      .sort()
      .forEach((f) => routes.push(`/${code}/skill/${f.replace(/\.json$/, '')}`))
  }

  return routes
}

/** Extracts description from rendered page content's first 1-2 <p> tags */
function extractContentDescription(html: string): string | null {
  const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/)
  if (!articleMatch) return null

  // `<p` must be followed by whitespace or `>` so `<path>` (svg) doesn't match.
  const paragraphs = [...articleMatch[1].matchAll(/<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/g)]
  if (paragraphs.length === 0) return null

  const text = paragraphs
    .slice(0, 2)
    .map((m) =>
      m[1]
        .replace(/<[^>]+>/g, '') // Strip HTML tags
        // Strip [[]] skill markers, dropping a keyword token's `|key` suffix
        .replace(HIGHLIGHT_RE, (_, inner: string) => splitHighlightToken(inner).label)
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

// The lazy locale chunk is imported by the route guard only after the app
// bundle executes; preloading it on its own pages saves a round trip on cold
// loads (the primary path for shared/SEO links into non-en/zh pages).
let assetFiles: string[] | null = null
function localeChunkHref(code: string): string | null {
  if (!assetFiles) {
    const assetsDir = fileURLToPath(new URL('./dist/assets', import.meta.url))
    assetFiles = existsSync(assetsDir) ? readdirSync(assetsDir) : []
  }
  const chunkRe = new RegExp(`^${code}-[\\w-]+\\.js$`)
  const file = assetFiles.find((f) => chunkRe.test(f))
  return file ? `/assets/${file}` : null
}

/** Post-processes SSG-rendered pages: sets lang attribute and derives skill descriptions */
function processRenderedPage(route: string, html: string): string {
  const match = route.match(LOCALE_PREFIX_RE)
  if (match) {
    html = html.replace(/<html[^>]*>/, `<html lang="${match[1]}">`)
  }

  html = dedupeAssetLinks(html)

  const skillMatch = route.match(SKILL_ROUTE_RE)
  if (skillMatch && !(APP_LOCALES as readonly string[]).includes(skillMatch[1])) {
    const href = localeChunkHref(skillMatch[1])
    if (href) {
      html = html.replace('</head>', `<link rel="modulepreload" crossorigin href="${href}"></head>`)
    }
  }

  if (skillMatch) {
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
        `[ssg] extractContentDescription found nothing on ${route}; meta description falling back to template default.`,
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
        hostname: SITE_ORIGIN,
        changefreq: 'monthly',
        priority: 0.8,
        generateRobotsTxt: true,
        // The form-detection page and the share-link shell, not content.
        exclude: ['/forms', '/share'],
        // @ts-expect-error - vite-ssg-sitemap types do not allow disabling lastmod
        lastmod: '',
      })
    },
  },
})
