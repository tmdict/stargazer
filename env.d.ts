/// <reference types="vite/client" />

/** The PvP team generator's set before a roster is picked (scripts/packModule.ts). */
declare module 'virtual:sl-preview' {
  const set: import('@/lib/pvp/generator/defaultSet').SlDefaultSet | null
  export default set
}

/** The placement engine's lists, leans and weights (scripts/packModule.ts). */
declare module 'virtual:formation-rules' {
  const data: import('@/lib/pvp/data/formationRulesData').FormationRulesData | null
  export default data
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
