import { describe, expect, it } from 'vitest'

import { imageFilesFromDrop, imageFilesFromInput, imageFilesFromPaste } from '@/utils/imageFile'

// Minimal duck-typed stubs — the helpers only read .type / .files / .items.
const file = (name: string, type: string) => ({ name, type }) as unknown as File

describe('imageFilesFromDrop', () => {
  it('returns only image files from the drag payload', () => {
    const event = {
      dataTransfer: { files: [file('a.png', 'image/png'), file('notes.txt', 'text/plain')] },
    } as unknown as DragEvent
    expect(imageFilesFromDrop(event).map((f) => f.name)).toEqual(['a.png'])
  })

  it('returns [] when there is no dataTransfer', () => {
    expect(imageFilesFromDrop({} as DragEvent)).toEqual([])
  })
})

describe('imageFilesFromPaste', () => {
  it('extracts image files via getAsFile, skipping non-file and non-image items', () => {
    const img = file('pasted.png', 'image/png')
    const event = {
      clipboardData: {
        items: [
          { kind: 'string', type: 'text/plain', getAsFile: () => null },
          { kind: 'file', type: 'text/plain', getAsFile: () => file('x.txt', 'text/plain') },
          { kind: 'file', type: 'image/png', getAsFile: () => img },
        ],
      },
    } as unknown as ClipboardEvent
    expect(imageFilesFromPaste(event)).toEqual([img])
  })

  it('returns [] when there is no clipboardData', () => {
    expect(imageFilesFromPaste({} as ClipboardEvent)).toEqual([])
  })
})

describe('imageFilesFromInput', () => {
  it('returns only image files from the input element', () => {
    const event = {
      target: { files: [file('a.jpg', 'image/jpeg'), file('readme.md', 'text/markdown')] },
    } as unknown as Event
    expect(imageFilesFromInput(event).map((f) => f.name)).toEqual(['a.jpg'])
  })

  it('returns [] when the input has no files', () => {
    expect(imageFilesFromInput({ target: { files: null } } as unknown as Event)).toEqual([])
  })
})
