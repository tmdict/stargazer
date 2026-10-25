/* The site's look, light or dark, as `data-theme` on <html>. The head script
 * in index.html sets it before the first paint from the stored choice, else
 * the device's setting; this composable adopts it after mount. While nothing
 * is stored it follows the device live, and other tabs follow a change
 * through the storage event. */

import { onMounted, onUnmounted, ref } from 'vue'

import { PREFS_KEY, readPrefs, writePref } from '@/utils/prefs'

export type Theme = 'light' | 'dark'

const DARK_QUERY = '(prefers-color-scheme: dark)'

const theme = ref<Theme>('light')

// A value other than a look reads as no choice, so the device decides.
const storedTheme = (): Theme | null => {
  const value = readPrefs()?.theme
  return value === 'light' || value === 'dark' ? value : null
}

const resolveTheme = (): Theme =>
  storedTheme() ?? (matchMedia(DARK_QUERY).matches ? 'dark' : 'light')

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

const sync = (): void => apply(resolveTheme())

const onStorage = (event: StorageEvent): void => {
  if (event.key === PREFS_KEY || event.key === null) sync()
}

export function useTheme(): { theme: typeof theme; toggle: () => void } {
  let device: MediaQueryList | undefined

  onMounted(() => {
    theme.value = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'
    window.addEventListener('storage', onStorage)
    device = matchMedia(DARK_QUERY)
    device.addEventListener('change', sync)
  })

  onUnmounted(() => {
    window.removeEventListener('storage', onStorage)
    device?.removeEventListener('change', sync)
  })

  const toggle = (): void => {
    const next = theme.value === 'dark' ? 'light' : 'dark'
    writePref('theme', next)
    apply(next)
  }

  return { theme, toggle }
}
