import { ref } from 'vue'

// Recently viewed skill pages, newest first; feeds the search overlay's
// empty state. Module-scope ref so recording (skill pages) and reading (the
// overlay) share one live list; localStorage only persists it across visits.
const STORAGE_KEY = 'stargazer.recentHeroes'
const MAX_RECENT = 5

const recentHeroes = ref<string[]>([])
let loaded = false

function load(): void {
  if (loaded || import.meta.env.SSR) return
  loaded = true
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const parsed: unknown = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      recentHeroes.value = parsed
        .filter((s): s is string => typeof s === 'string')
        .slice(0, MAX_RECENT)
    }
  } catch {
    // unreadable storage: start empty
  }
}

export function useRecentHeroes() {
  load()

  const record = (slug: string) => {
    if (import.meta.env.SSR) return
    recentHeroes.value = [slug, ...recentHeroes.value.filter((s) => s !== slug)].slice(
      0,
      MAX_RECENT,
    )
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(recentHeroes.value))
    } catch {
      // storage unavailable: the in-memory list still works this session
    }
  }

  return { recentHeroes, record }
}
