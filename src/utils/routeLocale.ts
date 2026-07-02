import type { AppLocale } from '@/lib/types/i18n'

/**
 * Splits a route path into its app-locale prefix (if any) and the remainder.
 * `/en/skill/walker` → `{ locale: 'en', rest: '/skill/walker' }`
 * `/skills`          → `{ locale: null, rest: '/skills' }`
 *
 * Single source of truth for locale-prefix parsing, shared by the route-locale
 * composable, the App-level store sync, and the language toggle.
 *
 * Invariant: the regex stays `(en|zh)`. This is the APP-locale classifier, so
 * a skill-text prefix like `/ko/…` must parse as "unprefixed": that is what
 * keeps the App store sync from pinning chrome to a non-app language, and what
 * makes the header toggle flip the chrome preference without rewriting the
 * content URL. Widening it to the skill-locale set would silently break both.
 */
export function splitLocalePath(path: string): { locale: AppLocale | null; rest: string } {
  const match = path.match(/^\/(en|zh)(\/.*)?$/)
  if (!match) return { locale: null, rest: path }
  return { locale: match[1] as AppLocale, rest: match[2] ?? '' }
}
