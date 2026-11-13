import { inject, provide, type InjectionKey } from 'vue'

import type { GridContext } from '@/stores/gridContext'

const GridContextKey: InjectionKey<GridContext> = Symbol('gridContext')

export function provideGridContext(ctx: GridContext): void {
  provide(GridContextKey, ctx)
}

export function useGridContext(): GridContext {
  const ctx = inject(GridContextKey)
  if (!ctx) {
    throw new Error('useGridContext must be used within a component that provides a GridContext')
  }
  return ctx
}
