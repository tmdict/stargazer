/// <reference types="vite/client" />

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
