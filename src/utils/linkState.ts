// Reads the board a page was opened with: `?g=` for an Arena or Teams link,
// `?hd=` for an Honor Duel board's.

// From the address bar, for a page that reads it before the router is ready.
export function getEncodedStateFromUrl(): string | null {
  return new URLSearchParams(window.location.search).get('g')
}

export function getDuelLinkFromUrl(): string | null {
  return new URLSearchParams(window.location.search).get('hd')
}

// From a route's query, where a repeated or empty parameter is not a string.
export function getEncodedStateFromRoute(query: { g?: string | string[] | null }): string | null {
  return typeof query.g === 'string' ? query.g : null
}
