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

Decoding rejects any input that yields zero bytes (a valid encoding always
carries at least one header byte), so truncated links fail with an error
instead of restoring an empty board.

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
  p?: number[][] // phantimals: [hexId, localPhantimalId, team]
  pr?: number[][] // paragon: [team, characterId, level]
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
  - Extended flags byte:
    - Bit 0: Needs extended counts
    - Bit 1: Has paragon (paragon section present after phantimals)
    - Bits 2-5: reserved
    - Bit 6: Has phantimals (phantimal section present after artifacts)
    - Bit 7: Has display flags (a dedicated display-flags byte follows)
  - Display flags byte (if extended bit 7 set): bit 0 Grid Info, 1 Targeting,
    2 Flat, 3 Skills, 4 Team View, 5 Invert, 6 Wrap (bit 7 spare)
  - Additional tile count byte (if extended bit 0 set)
  - Additional character count byte (if extended bit 0 set)

[Tiles: 9 bits each]
  - Hex ID (6 bits): Range 1-63
  - State (3 bits): Range 0-7

[Characters: 23 bits each]
  - Hex ID (6 bits): Range 1-63
  - Character ID (16 bits): Range 1-65535
  - Team (1 bit): 1=ALLY, 2=ENEMY

[Artifacts (if header bit 6 set): 12 bits]
  - Ally artifact (6 bits): 0 = null, 1-63 = artifact ID
  - Enemy artifact (6 bits): 0 = null, 1-63 = artifact ID

[Phantimals (if extended flags bit 6 set, after artifacts)]
  - Count (4 bits): Range 0-15
  - Each entry (11 bits): hex ID (6) + local phantimal ID (4) + team (1)

[Paragon (if extended flags bit 1 set, after phantimals)]
  - Count (5 bits): Range 0-31
  - Each entry (20 bits): team (1) + character ID (16) + level (3)
```

Only non-default hex states are stored, significantly reducing size.

### Validation & Limits

Before encoding, `validateGridState()` filters invalid entries:

- **Hex IDs**: Must be 1-63 (6-bit limit)
- **Tile States**: Must be 0-7 (3-bit limit)
- **Character IDs**: Must be 1-65535 (16-bit limit)
- **Artifact IDs**: Must be null or 1-63 (6-bit limit); out-of-range IDs become null
- **Phantimal entries**: Local ID 1-15, capped at 15 entries (4-bit count field)
- **Paragon entries**: Level 1-7, capped at 31 entries (5-bit count field)
- **Team Values**: Must be 1 (ALLY) or 2 (ENEMY)
- **Maximum Counts**: 262 tiles or characters (7 in header + 255 in extended)

Invalid entries are filtered with console warnings, ensuring header counts match actual data written and preventing encoding/decoding mismatches. Every field validated here must stay in sync with its bit width — `writeBits` silently truncates oversized values, which would alias them to different IDs on decode.

### Extended Mode

Extended mode activates when:

- More than 7 tile entries (modified hexes) OR more than 7 character entries
- Display flags are explicitly provided (even if all false)
- Phantimals are present

Display flags are only stored when explicitly provided (`d !== undefined`). Extended flags bit 7 marks their presence and is followed by a dedicated display-flags byte, so an explicit `d=0` (all toggles off) survives the round trip even when extended counts or phantimals also require the extended header.

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
- **Phantimals (ID ≥ 100000)**: Serialized separately in the `p` section via 4-bit local IDs

**Note**: Character IDs are limited to 65,535 (16-bit encoding). Companion IDs are `N * 10000 + base`, so the field covers companion index N up to 6 for base IDs below 5,536 (e.g. Zanie's second turret, ID 20089). IDs exceeding the limit are filtered during validation.

## Multi-board state (5 v 5)

The Teams page shares N boards in one link. Five boards plus an active-id and global flags are too varied for the single-board binary packing — and there is no back-compat constraint — so multi-board state is encoded as **url-safe base64 of JSON** instead:

- `serializeMultiGridState(boards, activeId, displayFlags)` → `MultiGridState` (`/src/utils/gridStateSerializer.ts`)
- `generateMultiShareableUrl(...)` → `…/teams?g=<base64-json>` (`/src/utils/urlStateManager.ts`)
- `TeamsView` restores it on load via `useUrlStateStore.restoreMultiFromEncodedState`, rebuilding each board.

The single-board binary format above still serves the Arena (`?g=` on `/`).
