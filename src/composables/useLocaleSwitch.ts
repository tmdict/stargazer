import { useRoute, useRouter } from 'vue-router'

import type { AppLocale } from '@/lib/types/i18n'
import { useI18nStore } from '@/stores/i18n'
import { splitLocalePath } from '@/utils/routeLocale'

/**
 * Switching the site language while respecting URL authority: on a
 * locale-prefixed route (`/en/...`, `/zh/...`) the path stays the source of
 * truth, so the switch is a move to the sibling-locale URL; elsewhere the
 * locale is only the stored preference.
 */
export function useLocaleSwitch() {
  const route = useRoute()
  const router = useRouter()
  const i18n = useI18nStore()

  /** The current page in `locale`; undefined where the path carries no locale. */
  const target = (locale: AppLocale): string | undefined => {
    const { locale: current, rest } = splitLocalePath(route.path)
    return current ? `/${locale}${rest}` : undefined
  }

  const pick = (locale: AppLocale): void => {
    // Explicit user choice: persist it (the route watcher alone applies
    // URL locales without persisting)
    i18n.setLocale(locale)
    const to = target(locale)
    if (to) void router.push(to)
  }

  return { target, pick }
}
