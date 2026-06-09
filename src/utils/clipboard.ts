/** Copy a PNG/image blob to the system clipboard. Throws if unsupported or denied. */
export async function copyImageBlob(blob: Blob): Promise<void> {
  if (!navigator.clipboard || !window.ClipboardItem) {
    throw new Error('Clipboard not supported')
  }
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
}
