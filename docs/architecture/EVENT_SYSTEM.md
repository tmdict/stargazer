# Event System

## Overview

The event system provides centralized, type-safe component communication using Vue 3's provide/inject pattern. It enables decoupled interactions between components while maintaining clear event flow and TypeScript support.

## Design Principles

1. **Pure Pub/Sub**: Emitting only notifies subscribers — all state changes live in the subscribing components, never inside the bus
2. **Namespaced Events**: Organized by feature (`hex:*`, `character:*`)
3. **Type Safety**: Full TypeScript support with compile-time checking
4. **Real Consumers Only**: An event exists only when it has a cross-component subscriber; components with a direct line to a store call its actions directly
5. **Simple API**: Minimal interface with emit, on, and off methods

## Core Components

### Event API (`/src/composables/useGridEvents.ts`)

Provides typed event access throughout the grid component tree (the bus is created and provided by `GridManager`):

```typescript
interface GridEventAPI {
  emit: <K extends keyof GridEvents>(event: K, ...args: Parameters<GridEvents[K]>) => void
  on: <K extends keyof GridEvents>(event: K, handler: GridEvents[K]) => void
  off: <K extends keyof GridEvents>(event: K, handler: GridEvents[K]) => void
}
```

### Event Types

```typescript
interface GridEvents {
  'hex:click': (hex: Hex) => void
  'character:mouseenter': (hexId: number) => void
  'character:mouseleave': (hexId: number) => void
}
```

## Event Catalog

### Hex Events

- **hex:click**: Emitted by GridTiles' invisible event-capture layer. GridManager's subscriber owns all click semantics in one decision tree: map-editor paint, the mobile tap flow (lift/drop/target), and desktop remove-or-pick (clicking a placed hero removes it; an empty placement tile opens the character picker)

### Character Events

- **character:mouseenter** / **character:mouseleave**: Emitted by the GridCharacters overlay; GridTiles subscribes to drive the hover highlight on the tile beneath the character

Character and artifact removal are not bus events: GridCharacters and GridArtifacts call `characterStore.removeCharacterFromHex()` / `artifactStore.removeArtifact()` directly, the same way they call their other store actions.

## Implementation Patterns

### Creating Event System

```typescript
export function provideGridEvents() {
  const api = createGridEvents()
  provide(GridEventKey, api)
  return api
}
```

### Emitting Events

```typescript
const events = useGridEvents()
events.emit('hex:click', hex)
```

### Listening to Events

```typescript
onMounted(() => {
  events.on('hex:click', handleHexClick)
})

onUnmounted(() => {
  events.off('hex:click', handleHexClick)
})
```
