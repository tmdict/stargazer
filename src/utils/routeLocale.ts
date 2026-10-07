import { APP_LOCALES, type AppLocale } from '@/lib/types/i18n'

const LOCALE_PATH_RE = new RegExp(`^/(${APP_LOCALES.join('|')})(/.*)?$`)

/**
 * Splits a route path into its app-locale prefix (if any) and the remainder.
 * `/en/skill/walker` → `{ locale: 'en', rest: '/skill/walker' }`
 * `/skills`          → `{ locale: null, rest: '/skills' }`
 *
 * Single source of truth for locale-prefix parsing, shared by the route-locale
 * composable, the App-level store sync, and the language menu.
 *
 * Invariant: the prefix set is APP_LOCALES. This is the APP-locale
 * classifier, so a prefix that only names a skill-text language, like
 * `/ja/…`, must parse as "unprefixed": that is what keeps the App store sync
 * from pinning chrome to a language without chrome strings, and what makes
 * the header menu switch the chrome preference without rewriting the content
 * URL. Widening it to the skill-locale set would silently break both.
 */
export function splitLocalePath(path: string): { locale: AppLocale | null; rest: string } {
  const match = path.match(LOCALE_PATH_RE)
  if (!match) return { locale: null, rest: path }
  return { locale: match[1] as AppLocale, rest: match[2] ?? '' }
}
