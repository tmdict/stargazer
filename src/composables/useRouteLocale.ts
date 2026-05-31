import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { splitLocalePath } from '@/utils/routeLocale'

export function useRouteLocale() {
  const route = useRoute()

  // 'en': default locale for missing/invalid route prefixes.
  return computed(() => splitLocalePath(route.path).locale ?? 'en')
}
