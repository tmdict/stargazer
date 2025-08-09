import { inject, provide, type InjectionKey } from 'vue'

import type { Hex } from '../lib/hex'
import { Team } from '../lib/types/team'
import { useArtifactStore } from '../stores/artifact'
import { useCharacterStore } from '../stores/character'

/**
 * Grid event types with namespacing
 */
export interface GridEvents {
  // Hex interactions
  'hex:click': (hex: Hex) => void
  'hex:hover': (hexId: number | null) => void

  // Character interactions
  'character:remove': (hexId: number) => void
  'character:dragStart': (hexId: number, characterId: number) => void
  'character:placed': (hexId: number, characterId: number) => void
  'character:removed': (hexId: number) => void

  // Grid updates
  'grid:updated': () => void

  // Artifact interactions
  'artifact:remove': (team: Team) => void
}

/**
 * Simplified grid event system using provide/inject pattern
 */
export interface GridEventAPI {
  emit: <K extends keyof GridEvents>(event: K, ...args: Parameters<GridEvents[K]>) => void
  on: <K extends keyof GridEvents>(event: K, handler: GridEvents[K]) => void
  off: <K extends keyof GridEvents>(event: K, handler: GridEvents[K]) => void
}

// Injection key
export const GridEventKey: InjectionKey<GridEventAPI> = Symbol('grid-events')

/**
 * Create grid event system (for provider)
 */
export function createGridEvents(): GridEventAPI {
  const characterStore = useCharacterStore()
  const artifactStore = useArtifactStore()
  const handlers = new Map<keyof GridEvents, Set<Function>>()

  const emit: GridEventAPI['emit'] = (event, ...args) => {
    const eventHandlers = handlers.get(event)
    if (eventHandlers) {
      eventHandlers.forEach((handler) => handler(...args))
    }

    // Handle events directly in the store where appropriate
    switch (event) {
      case 'hex:click':
        const hex = args[0] as Hex
        characterStore.handleHexClick(hex)
        break

      case 'character:remove':
        const hexId = args[0] as number
        characterStore.removeCharacterFromHex(hexId)
        break

      case 'artifact:remove':
        const team = args[0] as Team
        artifactStore.removeArtifact(team)
        break
    }
  }

  const on: GridEventAPI['on'] = (event, handler) => {
    if (!handlers.has(event)) {
      handlers.set(event, new Set())
    }
    handlers.get(event)!.add(handler)
  }

  const off: GridEventAPI['off'] = (event, handler) => {
    const eventHandlers = handlers.get(event)
    if (eventHandlers) {
      eventHandlers.delete(handler)
    }
  }

  return { emit, on, off }
}

/**
 * Use grid events (for consumers)
 */
export function useGridEvents(): GridEventAPI {
  const api = inject(GridEventKey)
  if (!api) {
    throw new Error('Grid events not provided. Wrap your app with a provider.')
  }
  return api
}

/**
 * Provide grid events to children
 */
export function provideGridEvents() {
  const api = createGridEvents()
  provide(GridEventKey, api)
  return api
}
