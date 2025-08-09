# Event System

## Overview

The event system provides centralized, type-safe component communication using Vue 3's provide/inject pattern. It enables decoupled interactions between components while maintaining clear event flow and TypeScript support.

## Design Principles

1. **Centralized Bus**: Single event API instance for all application events
2. **Namespaced Events**: Organized by feature (`hex:*`, `character:*`, `artifact:*`)
3. **Type Safety**: Full TypeScript support with compile-time checking
4. **Direct Store Integration**: Events trigger store actions automatically
5. **Simple API**: Minimal interface with emit, on, and off methods

## Core Components

### Event API (`/src/composables/useGridEvents.ts`)

Provides typed event access throughout the application:

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
  'hex:hover': (hexId: number | null) => void
  'character:remove': (hexId: number) => void
  'character:dragStart': (hexId: number, characterId: number) => void
  'artifact:remove': (team: Team) => void
}
```

## Event Catalog

### Hex Events

- **hex:click**: User clicks hex tile - triggers character placement logic
- **hex:hover**: Mouse enters/leaves hex - updates hover state

### Character Events

- **character:remove**: Remove character from hex
- **character:dragStart**: Start dragging character from grid

### Artifact Events

- **artifact:remove**: Remove artifact from team

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
events.emit('character:remove', hexId)
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

### Direct Store Actions

Events automatically trigger store actions:

```typescript
switch (event) {
  case 'hex:click':
    characterStore.handleHexClick(hex)
    break
  case 'character:remove':
    characterStore.removeCharacterFromHex(hexId)
    break
}
```

## Performance Considerations

- **Handler Management**: Uses Map and Set for efficient handler storage
- **Memory Cleanup**: Always remove listeners in `onUnmounted`
- **Direct Actions**: Store integration avoids event cascades

## Related Documentation

- [`/docs/architecture/GRID.md`](./GRID.md) - Grid system using events
- [`/docs/architecture/DRAG_AND_DROP.md`](./DRAG_AND_DROP.md) - Drag events integration
