/* The site's look, light or dark, as `data-theme` on <html>. The head script
 * in index.html sets it before the first paint from the stored choice, else
 * the device's setting; this composable adopts it after mount. Until a look
 * is pressed it follows the device live, and other tabs follow a change
 * through the storage event. */

import { onMounted, onUnmounted, readonly, ref, type Ref } from 'vue'

import { PREFS_KEY, readPrefs, writePref } from '@/utils/prefs'

type Theme = 'light' | 'dark'

const DARK_QUERY = '(prefers-color-scheme: dark)'

const theme = ref<Theme>('light')
// Where storage is unavailable, the pressed look still outranks the device.
let pressed: Theme | null = null

// A value other than a look reads as no choice, so the device decides.
const storedTheme = (): Theme | null => {
  const value = readPrefs()?.theme
  return value === 'light' || value === 'dark' ? value : null
}

const resolveTheme = (): Theme =>
  storedTheme() ?? pressed ?? (matchMedia(DARK_QUERY).matches ? 'dark' : 'light')

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

export function useTheme(): { theme: Readonly<Ref<Theme>>; toggle: () => void } {
  let device: MediaQueryList | undefined
  const onStorage = (event: StorageEvent): void => {
    if (event.key === PREFS_KEY || event.key === null) sync()
  }

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
    pressed = next
    writePref('theme', next)
    apply(next)
  }

  return { theme: readonly(theme), toggle }
}
