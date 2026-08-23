# Event System

## Overview

The event system provides centralized, type-safe component communication using Vue 3's provide/inject pattern. It enables decoupled interactions between components while maintaining clear event flow and TypeScript support.

## Design Principles

1. **Pure Pub/Sub**: Emitting only notifies subscribers; all state changes live in the subscribing components, never inside the bus
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
  'hex:click': (hex: Hex, event: MouseEvent) => void // the DOM event tells touch taps from mouse clicks
  'character:mouseenter': (hexId: number) => void
  'character:mouseleave': (hexId: number) => void
}
```

## Event Catalog

### Hex Events

- **hex:click**: Emitted by GridTiles' invisible event-capture layer. GridManager's subscriber owns all click semantics in one decision tree: map-editor paint, the lifted-hero drop, the tap-target flow, and wide-layout remove-or-pick (a mouse click on a placed hero removes it; a touch tap does not, since hero taps belong to the character layer's lift flow; an empty placement tile opens the character picker while the team has an open slot)

### Character Events

- **character:mouseenter** / **character:mouseleave**: Emitted by the GridCharacters overlay; GridTiles subscribes to drive the hover highlight on the tile beneath the character

Character and artifact removal are not bus events: GridCharacters and GridArtifacts call `ctx.remove()` / `ctx.removeArtifact()` on their injected `GridContext` directly, the same way they call its other operations.

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
