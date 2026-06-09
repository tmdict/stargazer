/** Extract image File objects from the three intake paths: drop, paste, picker. */

const isImageFile = (file: File): boolean => file.type.startsWith('image/')

export function imageFilesFromDrop(event: DragEvent): File[] {
  return Array.from(event.dataTransfer?.files ?? []).filter(isImageFile)
}

export function imageFilesFromPaste(event: ClipboardEvent): File[] {
  const files: File[] = []
  for (const item of event.clipboardData?.items ?? []) {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const file = item.getAsFile()
      if (file) files.push(file)
    }
  }
  return files
}

export function imageFilesFromInput(event: Event): File[] {
  const input = event.target as HTMLInputElement
  return Array.from(input.files ?? []).filter(isImageFile)
}
