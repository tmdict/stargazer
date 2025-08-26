# URL Serialization

## Overview

The URL serialization system enables sharing game state through compact URLs using binary encoding and Base64. It preserves complete game state including character placements, hex states, and team configurations.

## Design Principles

1. **Compact Representation**: Binary encoding with bit packing for minimal URL length
2. **Complete State**: Captures all placements, states, teams, and artifacts
3. **Fixed Format**: Simple, stable binary format without versioning overhead
4. **Fast Encoding**: O(n) performance with millisecond execution
5. **Robust Decoding**: Graceful handling of invalid or partial state

## Core Components

### URL State Manager (`/src/utils/urlStateManager.ts`)

High-level API for URL generation and parsing with grid state.

### URL State Store (`/src/stores/urlState.ts`)

State restoration orchestration through Pinia store:

```typescript
interface UrlRestoreResult {
  success: boolean
  displayFlags?: DisplayFlags
  error?: string
}
```

### Binary Encoder (`/src/utils/binaryEncoder.ts`)

Handles bit-level operations for compact encoding.

### Grid State Serializer (`/src/utils/gridStateSerializer.ts`)

Converts between game state and compact format:

```typescript
interface GridState {
  t?: number[][] // tiles: [hexId, state]
  c?: number[][] // characters: [hexId, characterId, team]
  a?: (number | null)[] // artifacts: [ally, enemy]
  d?: number // display flags (bit-packed)
}
```

## Encoding Strategy

### Bit Allocation

- **Hex States**: 3 bits (8 possible states)
- **Character IDs**: 14 bits (supports IDs 0-16,383)
- **Team Assignment**: 1 bit (ALLY/ENEMY)
- **Artifacts**: 3 bits each (supports 7 artifact types)
- **Display Flags**: 4 bits (Grid Info, Targeting, Perspective, Skills)

### Extended Header Mode

Extended mode is triggered for:

- More than 7 tiles or characters
- Display flags present

```typescript
// Extended flags byte when bit 7 set:
// Bit 0: Needs extended counts
// Bits 1-4: Display flags (showHexIds, showArrows, showPerspective, showSkills)
// Bits 5-7: Reserved
```

### Display Flags

View preferences preserved in URLs:

- **Grid Info**: Hex ID display toggle (bit 0)
- **Targeting**: Arrow visualization toggle (bit 1)
- **Flat**: Perspective mode toggle (bit 2)
- **Skills**: Skill targeting display toggle (bit 3)

Bit-packed into 4 bits within extended header.

## Serialization Format

### Header Byte Structure

```
[Header: 8 bits]
  - Bits 0-2: Tile count (0-7)
  - Bits 3-5: Character count (0-7)
  - Bit 6: Has artifacts flag
  - Bit 7: Extended mode flag

[Extended Header (if bit 7 set)]
  - Extended flags byte (8 bits)
  - Additional tile count (if needed)
  - Additional character count (if needed)

[Tiles: 9 bits each]
  - Hex ID (6 bits)
  - State (3 bits)

[Characters: 21 bits each]
  - Hex ID (6 bits)
  - Character ID (14 bits)
  - Team (1 bit)

[Artifacts (if present): 6 bits]
  - Ally artifact (3 bits)
  - Enemy artifact (3 bits)
```

Only non-default hex states are stored, significantly reducing size.

## URL Generation Process

1. Collect non-default hex states
2. Gather character placements and display flags
3. Binary encode with variable-length IDs
4. Base64-like encode to URL-safe string
5. Append as query parameter

Example: `https://<url>>/?g=AQIDBAUGBwgJCg`

## Share Page Integration

The URL serialization system powers the Share page feature, enabling read-only grid viewing through direct links.

### Share URL Format

```
https://<url>/share?g=<encoded-state>
```

### Share Page Behavior

- **Read-only Mode**: Grid is displayed but not interactable (no dragging, clicking, or state changes)
- **Full State Preservation**: All display settings (perspective, arrows, hex IDs, skills) are maintained
- **Responsive Design**: Grid adapts to screen size without forcing perspective flattening on mobile
- **Modal Presentation**: Dark overlay background with centered grid container
- **Navigation**: Clicking outside the grid or using browser back returns to main page with state preserved

### Share Link Generation

The Link button in GridControls generates share URLs:

1. Serializes current grid state
2. Creates `/share?g=<encoded>` URL
3. Copies to clipboard with toast notification
4. Redirects to Share page for preview

## State Restoration API

### Restoration Flow

The URL state restoration is unified through the `urlState` store, providing consistent behavior across all views:

```typescript
import { useUrlStateStore } from '../stores/urlState'
import { getEncodedStateFromRoute, getEncodedStateFromUrl } from '../utils/urlStateManager'

const urlStateStore = useUrlStateStore()

// From current browser URL
const encodedState = getEncodedStateFromUrl()
const result = urlStateStore.restoreFromEncodedState(encodedState)

// From Vue Router query
const encodedState = getEncodedStateFromRoute(route.query)
const result = urlStateStore.restoreFromEncodedState(encodedState)

// Handle results
if (result.success) {
  // State restored successfully
  if (result.displayFlags) {
    // Apply display flags to UI
  }
} else {
  // Handle error: result.error contains details
}
```

### Character Placement Strategy

#### Standard Characters (ID < 10000)

Direct placement for regular character IDs.

#### Companion Characters (ID ≥ 10000)

Two-phase restoration for companions:

1. **Place main characters** - triggers skill activation and companion creation
2. **Reposition companions** - move from auto-generated positions to saved positions

This respects skill-based companion creation while preserving exact layouts.

**Note**: Character IDs are currently limited to 16,383 (14-bit encoding). This supports approximately 6,383 main characters with their companions.

## Grid Export

### Image Export

PNG generation from grid visualization:

```typescript
const dataUrl = await toPng(element, {
  quality: 1.0,
  pixelRatio: 2,
  backgroundColor: 'transparent',
})
```

### Clipboard Integration

Direct copy to clipboard for easy sharing.

## Related Documentation

- [`/docs/architecture/GRID.md`](./GRID.md) - Grid state being serialized
- [`/docs/architecture/SKILLS.md`](./SKILLS.md) - Companion character system
- [`/docs/architecture/MAP_EDITOR.md`](./MAP_EDITOR.md) - Map sharing features
