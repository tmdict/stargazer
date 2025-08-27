# URL Serialization

## Overview

The URL serialization system enables sharing game state through compact URLs using binary encoding and Base64. It preserves complete game state including character placements, hex states, and team configurations.

## Design Principles

1. **Compact Representation**: Binary encoding with bit packing for minimal URL length
2. **Complete State**: Captures all placements, states, teams, and artifacts
3. **Fixed Format**: Simple, stable binary format without versioning overhead
4. **Fast Encoding**: O(n) performance with millisecond execution
5. **Robust Decoding**: Graceful handling of invalid or partial state
6. **Input Validation**: Pre-encoding validation ensures data integrity
7. **Error Resilience**: Graceful degradation with clear error messages

## Core Components

### URL State Management (`/src/utils/urlStateManager.ts`, `/src/stores/urlState.ts`)

Handles URL generation, parsing, and state restoration through a unified API:

- **`generateShareableUrl()`**: Creates shareable URLs with compressed state
- **`restoreFromEncodedState()`**: Restores grid from URL parameters
- **`updateUrlWithGridState()`**: Updates browser URL without navigation

### Binary Encoder (`/src/utils/binaryEncoder.ts`)

Performs bit-level encoding/decoding with built-in validation:

- **`validateGridState()`**: Pre-filters invalid entries
- **`encodeToBinary()`**: Compresses state to binary format
- **`decodeFromBinary()`**: Restores state with error handling

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

## Binary Encoding

### Format Structure

```
[Header: 8 bits]
  - Bits 0-2: Tile count (0-7)
  - Bits 3-5: Character count (0-7)
  - Bit 6: Has artifacts flag
  - Bit 7: Extended mode flag

[Extended Header (if bit 7 set): 8+ bits]
  - Bit 0: Needs extended counts
  - Bits 1-4: Display flags (Grid Info, Targeting, Flat, Skills)
  - Bits 5-7: Reserved
  - Additional tile count byte (if bit 0 set)
  - Additional character count byte (if bit 0 set)

[Tiles: 9 bits each]
  - Hex ID (6 bits): Range 1-63
  - State (3 bits): Range 0-7

[Characters: 21 bits each]
  - Hex ID (6 bits): Range 1-63
  - Character ID (14 bits): Range 1-16383
  - Team (1 bit): 1=ALLY, 2=ENEMY

[Artifacts (if header bit 6 set): 6 bits]
  - Ally artifact (3 bits): Range 0-7
  - Enemy artifact (3 bits): Range 0-7
```

Only non-default hex states are stored, significantly reducing size.

### Validation & Limits

Before encoding, `validateGridState()` filters invalid entries:

- **Hex IDs**: Must be 1-63 (6-bit limit)
- **Tile States**: Must be 0-7 (3-bit limit)
- **Character IDs**: Must be 1-16383 (14-bit limit)
- **Team Values**: Must be 1 (ALLY) or 2 (ENEMY)
- **Maximum Counts**: 262 tiles or characters (7 in header + 255 in extended)

Invalid entries are filtered with console warnings, ensuring header counts match actual data written and preventing encoding/decoding mismatches.

### Extended Mode

Extended mode activates when:

- More than 7 tile entries (modified hexes) OR more than 7 character entries
- Display flags are explicitly provided (even if all false)

Display flags are only stored when explicitly provided (`d !== undefined`), preserving `d=0` when intentionally set but omitting from output when not provided for URL optimization.

## URL Operations

### Encoding Process

1. Collect non-default hex states and character placements
2. Validate entries with `validateGridState()` (filters invalid data)
3. Serialize to GridState format via `serializeGridState()`
4. Binary encode with bit packing via `encodeToBinary()`
5. Convert to URL-safe string via `bytesToUrlSafe()`
6. Append as query parameter: `?g=<encoded>`

Example: `https://<url>/?g=AQIDBAUGBwgJCg`

### Decoding Process

1. Extract encoded string from URL parameter
2. Convert from URL-safe format via `urlSafeToBytes()`
3. Decode binary data via `decodeFromBinary()`
4. Apply state through `restoreFromEncodedState()`:

```typescript
const urlStateStore = useUrlStateStore()
const encodedState = getEncodedStateFromUrl() // or getEncodedStateFromRoute(route.query)
const result = urlStateStore.restoreFromEncodedState(encodedState)

if (result.success) {
  // State restored, apply display flags if present
} else {
  // Handle error: result.error contains details
}
```

### Character Restoration

- **Standard characters (ID < 10000)**: Direct placement
- **Companions (ID ≥ 10000)**: Two-phase - place mains first (triggers skills), then reposition companions

**Note**: Character IDs are currently limited to 16,383 (14-bit encoding). This supports approximately 6,383 main characters with their companions. IDs exceeding this limit are filtered during validation.
