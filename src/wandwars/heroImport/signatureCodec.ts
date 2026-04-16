/**
 * Shared Float32Array ↔ base64 string codec used by both the reference
 * signature loader (decode-only) and the generator tool (encode + decode).
 */

export function float32ToBase64(sig: Float32Array): string {
  const bytes = new Uint8Array(sig.buffer, sig.byteOffset, sig.byteLength)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!)
  return btoa(binary)
}

export function base64ToFloat32(b64: string): Float32Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Float32Array(bytes.buffer)
}
