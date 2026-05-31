import { useRoute, useRouter } from 'vue-router'

import { useI18nStore } from '@/stores/i18n'
import { splitLocalePath } from '@/utils/routeLocale'

/**
 * Locale toggle that respects URL authority: on locale-prefixed routes
 * (`/en/...`, `/zh/...`) it navigates to the sibling-locale URL so the path
 * stays the source of truth; elsewhere it flips the global store preference.
 */
export function useLocaleToggle() {
  const route = useRoute()
  const router = useRouter()
  const i18n = useI18nStore()

  return () => {
    const { locale, rest } = splitLocalePath(route.path)
    if (locale) {
      router.push(`/${locale === 'en' ? 'zh' : 'en'}${rest}`)
    } else {
      i18n.toggleLocale()
    }
  }
}
