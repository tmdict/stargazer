/* The site's look, light or dark, as `data-theme` on <html>. The head script
 * in index.html sets it before the first paint from the stored choice, light
 * unless dark was picked; this composable adopts it after mount, and other
 * tabs follow a change through the storage event. */

import { onMounted, onUnmounted, ref } from 'vue'

import { PREFS_KEY, readPrefs, writePref } from '@/utils/prefs'

export type Theme = 'light' | 'dark'

const theme = ref<Theme>('light')

// Anything but a stored "dark" is the light look.
const storedTheme = (): Theme => (readPrefs()?.theme === 'dark' ? 'dark' : 'light')

// Controls that fade their colours would otherwise change at different
// speeds, so transitions stay off until the new colours have applied.
const apply = (next: Theme): void => {
  theme.value = next
  const root = document.documentElement
  if (root.getAttribute('data-theme') === next) return
  root.classList.add('theme-switching')
  root.setAttribute('data-theme', next)
  void getComputedStyle(document.body).color
  setTimeout(() => root.classList.remove('theme-switching'), 1)
}

const onStorage = (event: StorageEvent): void => {
  if (event.key === PREFS_KEY || event.key === null) apply(storedTheme())
}

export function useTheme(): { theme: typeof theme; toggle: () => void } {
  onMounted(() => {
    theme.value = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'
    window.addEventListener('storage', onStorage)
  })

  onUnmounted(() => {
    window.removeEventListener('storage', onStorage)
  })

  const toggle = (): void => {
    const next = theme.value === 'dark' ? 'light' : 'dark'
    writePref('theme', next)
    apply(next)
  }

  return { theme, toggle }
}
