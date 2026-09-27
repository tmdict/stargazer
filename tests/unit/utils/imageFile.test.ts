import { describe, expect, it } from 'vitest'

import { imageFilesFromDrop, imageFilesFromInput, imageFilesFromPaste } from '@/utils/imageFile'

// Each intake path reads a different browser API, so one breaking goes
// unnoticed by anyone testing through another. The helpers only read
// .type / .files / .items, hence the duck-typed stubs.
const file = (name: string, type: string) => ({ name, type }) as unknown as File

describe('screenshot intake', () => {
  it('keeps only image files on every path', () => {
    const drop = {
      dataTransfer: { files: [file('a.png', 'image/png'), file('notes.txt', 'text/plain')] },
    } as unknown as DragEvent
    expect(imageFilesFromDrop(drop).map((f) => f.name)).toEqual(['a.png'])

    // Paste goes through clipboard items: text items and non-image files are
    // skipped, and an image item whose getAsFile yields nothing is dropped.
    const pasted = file('pasted.png', 'image/png')
    const paste = {
      clipboardData: {
        items: [
          { kind: 'string', type: 'text/plain', getAsFile: () => null },
          { kind: 'file', type: 'text/plain', getAsFile: () => file('x.txt', 'text/plain') },
          { kind: 'file', type: 'image/png', getAsFile: () => null },
          { kind: 'file', type: 'image/png', getAsFile: () => pasted },
        ],
      },
    } as unknown as ClipboardEvent
    expect(imageFilesFromPaste(paste)).toEqual([pasted])

    const input = {
      target: { files: [file('a.jpg', 'image/jpeg'), file('readme.md', 'text/markdown')] },
    } as unknown as Event
    expect(imageFilesFromInput(input).map((f) => f.name)).toEqual(['a.jpg'])
  })

  it('returns nothing when the event carries no payload', () => {
    expect(imageFilesFromDrop({} as DragEvent)).toEqual([])
    expect(imageFilesFromPaste({} as ClipboardEvent)).toEqual([])
    expect(imageFilesFromInput({ target: { files: null } } as unknown as Event)).toEqual([])
  })
})
