/* Packing and unpacking a hand-over's link code: a JSON object of stored item
 * names and their stored text, compressed with raw deflate and written in
 * link-safe base64 without padding. */

import { TRAVEL_KEYS } from './config'

/* The `#` part an old page leaves with: the mark and the packed items, the mark
 * alone when they cannot travel, or null when there is nothing to carry.
 *
 * The build inlines this function's text into pages that load no script file,
 * so its body uses nothing outside itself. */
export async function packLink(
  storage: Pick<Storage, 'getItem'>,
  keys: readonly string[],
  mark: string,
  maxCodeLength: number,
): Promise<string | null> {
  const items: Record<string, string> = {}
  let found = false
  for (const key of keys) {
    const value = storage.getItem(key)
    if (value !== null) {
      items[key] = value
      found = true
    }
  }
  if (!found) return null
  try {
    const stream = new Blob([JSON.stringify(items)])
      .stream()
      .pipeThrough(new CompressionStream('deflate-raw'))
    const bytes = new Uint8Array(await new Response(stream).arrayBuffer())
    let binary = ''
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 0x8000)))
    }
    const code = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    return code.length > maxCodeLength ? mark : mark + code
  } catch {
    return mark
  }
}

/* The carried items of a link code, or null when it does not unpack. Names
 * outside TRAVEL_KEYS and values that are not text are left out. */
export async function unpackCode(code: string): Promise<Map<string, string> | null> {
  try {
    const binary = atob(code.replace(/-/g, '+').replace(/_/g, '/'))
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
    const parsed: unknown = JSON.parse(await new Response(stream).text())
    if (!parsed || typeof parsed !== 'object') return null
    const items = new Map<string, string>()
    for (const key of TRAVEL_KEYS) {
      const value = (parsed as Record<string, unknown>)[key]
      if (typeof value === 'string') items.set(key, value)
    }
    return items
  } catch {
    return null
  }
}
