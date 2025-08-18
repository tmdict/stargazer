import { computed } from 'vue'
import { useRoute } from 'vue-router'

export function useRouteLocale() {
  const route = useRoute()

  const locale = computed(() => {
    const match = route.path.match(/^\/(en|zh)\//)
    return match ? match[1] : 'en'
  })

  return locale
}
