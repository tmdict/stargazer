/** A file's name without its folders and extension, as the loaders key what a
 * glob finds. */
export const fileStem = (path: string): string =>
  path.slice(path.lastIndexOf('/') + 1).replace(/\.\w+$/, '')
