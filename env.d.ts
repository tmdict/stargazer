/// <reference types="vite/client" />

/**
 * Type declarations for vite-imagetools
 * Used for optimized character images in content files
 */
declare module '*.png?format=webp&quality=80&w=100' {
  const src: string
  export default src
}
