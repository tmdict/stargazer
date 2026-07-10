/** Copy a PNG/image blob to the system clipboard. Throws if unsupported or denied.
 * Takes a promise: Safari invalidates the user activation across an await, so the
 * ClipboardItem must be handed the pending capture inside the click's own task
 * and the browser awaits the blob itself. */
export async function copyImageBlob(blob: Promise<Blob>): Promise<void> {
  if (!navigator.clipboard || !window.ClipboardItem) {
    // The capture is already running; abandon it without an unhandled rejection.
    blob.catch(() => {})
    throw new Error('Clipboard not supported')
  }
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
}
