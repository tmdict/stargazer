/* Recovery for a tab left open across a deploy. The deploy purges the previous
 * build's hashed chunks, so the tab's next lazy import fails (the SPA rewrite
 * answers the miss with index.html). Each dynamic import recovers where it is
 * made: route chunks in the router's error handler, components through
 * defineLazyComponent, skill locales in the router's warm-up guard; the image
 * export toasts instead. So there is no vite:preloadError backstop: it would
 * fire first, and preventing its rethrow starves the router's handler of the
 * destination. */

// Import-failure wording differs per engine (Chrome "Failed to fetch
// dynamically imported module", Safari "Importing a module script failed",
// Firefox "error loading dynamically imported module", plus the module-MIME
// variant the SPA rewrite produces), so match the family.
const CHUNK_ERROR_RE =
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Failed to load module script/i

export const isChunkLoadError = (error: unknown): boolean =>
  error instanceof Error && CHUNK_ERROR_RE.test(error.message)

// Remembering the last recovered URL keeps a persistent failure (offline, a
// blocked chunk) from looping: its second failure stays with the caller.
const CHUNK_RECOVERY_KEY = 'stargazer.chunk-recovery'

/* Loads `fullPath` afresh from the current build, once per URL: false when
 * this URL was already recovered (or storage is refused), so the caller shows
 * its failure instead. A page whose own data file a deploy replaced recovers
 * through it too. */
export function reloadOntoCurrentBuild(fullPath: string): boolean {
  try {
    if (sessionStorage.getItem(CHUNK_RECOVERY_KEY) === fullPath) return false
    sessionStorage.setItem(CHUNK_RECOVERY_KEY, fullPath)
  } catch {
    return false
  }
  // Assigning the page already shown, when its address has a #fragment, only
  // scrolls to the fragment.
  const target = new URL(fullPath, window.location.href)
  if (target.pathname + target.search === window.location.pathname + window.location.search) {
    window.location.reload()
  } else {
    window.location.assign(target)
  }
  return true
}
