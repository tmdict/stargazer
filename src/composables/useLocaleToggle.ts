import { useRoute, useRouter } from 'vue-router'

import { useI18nStore } from '@/stores/i18n'
import { splitLocalePath } from '@/utils/routeLocale'

/**
 * Locale toggle that respects URL authority: on locale-prefixed routes
 * (`/en/...`, `/zh/...`) it persists the chosen locale and navigates to the
 * sibling-locale URL so the path stays the source of truth; elsewhere it
 * flips the global store preference.
 */
export function useLocaleToggle() {
  const route = useRoute()
  const router = useRouter()
  const i18n = useI18nStore()

  return () => {
    const { locale, rest } = splitLocalePath(route.path)
    if (locale) {
      const next = locale === 'en' ? 'zh' : 'en'
      // Explicit user choice: persist it (the route watcher alone applies
      // URL locales without persisting)
      i18n.setLocale(next)
      router.push(`/${next}${rest}`)
    } else {
      i18n.toggleLocale()
    }
  }
}
