import type { Locale } from '@/lib/types/i18n'

/**
 * Splits a route path into its locale prefix (if any) and the remainder.
 * `/en/skill/walker` → `{ locale: 'en', rest: '/skill/walker' }`
 * `/skills`          → `{ locale: null, rest: '/skills' }`
 *
 * Single source of truth for locale-prefix parsing, shared by the route-locale
 * composable, the App-level store sync, and the language toggle.
 */
export function splitLocalePath(path: string): { locale: Locale | null; rest: string } {
  const match = path.match(/^\/(en|zh)(\/.*)?$/)
  if (!match) return { locale: null, rest: path }
  return { locale: match[1] as Locale, rest: match[2] ?? '' }
}
