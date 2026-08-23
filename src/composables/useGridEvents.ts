import { inject, provide, type InjectionKey } from 'vue'

import type { Hex } from '@/lib/hex'

export interface GridEvents {
  // Hex interactions; the DOM event travels along so handlers can tell touch
  // gestures from mouse clicks.
  'hex:click': (hex: Hex, event: MouseEvent) => void

  // Character interactions
  'character:mouseenter': (hexId: number) => void
  'character:mouseleave': (hexId: number) => void
}

/**
 * Pure pub/sub grid event system using provide/inject. Emitting only notifies
 * subscribers: all state changes live in the subscribing components.
 */
export interface GridEventAPI {
  emit: <K extends keyof GridEvents>(event: K, ...args: Parameters<GridEvents[K]>) => void
  on: <K extends keyof GridEvents>(event: K, handler: GridEvents[K]) => void
  off: <K extends keyof GridEvents>(event: K, handler: GridEvents[K]) => void
}

export const GridEventKey: InjectionKey<GridEventAPI> = Symbol('grid-events')

export function createGridEvents(): GridEventAPI {
  // unknown[] lets handlers of every signature share one map; the generic
  // emit/on/off signatures keep the public API typed.
  const handlers = new Map<keyof GridEvents, Set<(...args: unknown[]) => void>>()

  const emit: GridEventAPI['emit'] = (event, ...args) => {
    handlers.get(event)?.forEach((handler) => handler(...args))
  }

  const on: GridEventAPI['on'] = (event, handler) => {
    if (!handlers.has(event)) {
      handlers.set(event, new Set())
    }
    handlers.get(event)!.add(handler as (...args: unknown[]) => void)
  }

  const off: GridEventAPI['off'] = (event, handler) => {
    handlers.get(event)?.delete(handler as (...args: unknown[]) => void)
  }

  return { emit, on, off }
}

export function useGridEvents(): GridEventAPI {
  const api = inject(GridEventKey)
  if (!api) {
    throw new Error('Grid events not provided. Wrap your app with a provider.')
  }
  return api
}

export function provideGridEvents() {
  const api = createGridEvents()
  provide(GridEventKey, api)
  return api
}
