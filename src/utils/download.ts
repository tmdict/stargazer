/** Browser file-download helpers shared by image and text exporters. */

// Append to the DOM before clicking: some browsers ignore a synthetic click on
// a detached anchor.
export function downloadUrl(href: string, filename: string): void {
  const link = document.createElement('a')
  link.href = href
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  downloadUrl(url, filename)
  // WebKit dereferences the href asynchronously after the click, so a same-tick
  // revoke aborts the download; revoke on a generous delay instead.
  setTimeout(() => URL.revokeObjectURL(url), 40_000)
}

// Local-time `prefix-YYYYMMDD-HHMMSS.ext` for collision-resistant export names.
export function timestampedName(prefix: string, ext: string): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  const stamp = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
  return `${prefix}-${stamp}.${ext}`
}
