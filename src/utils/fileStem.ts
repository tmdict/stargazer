/** A file's name without its folders and extension, as the loaders key what a
 * glob finds. */
export const fileStem = (path: string): string =>
  path.slice(path.lastIndexOf('/') + 1).replace(/\.\w+$/, '')

/** What a glob finds, under each file's stem. */
export const byStem = <T>(modules: Record<string, T>): Record<string, T> =>
  Object.fromEntries(Object.entries(modules).map(([path, value]) => [fileStem(path), value]))
