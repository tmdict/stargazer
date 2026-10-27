/// <reference types="vite/client" />

/** The Supreme League generator's set before a roster is picked (scripts/slPreview.ts). */
declare module 'virtual:sl-preview' {
  const set: import('@/lib/pvp/sl/generator/defaultSet').SlDefaultSet | null
  export default set
}

/**
 * Type declarations for vite-imagetools
 * Used for optimized images in content files
 */
declare module '*.png?format=webp&quality=80&w=100' {
  const src: string
  export default src
}

declare module '*.png?format=webp&quality=80&w=100&h=135&fit=cover&position=bottom' {
  const src: string
  export default src
}
