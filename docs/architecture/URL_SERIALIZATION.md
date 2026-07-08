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

Handles encoding, decoding, and state restoration:

- **`encodeGridStateToUrl()` / `decodeGridStateFromUrl()`**: Single-board binary encoding to/from a URL-safe string
- **`encodeMultiGridStateToUrl()` / `decodeMultiGridStateFromUrl()`**: Multi-board url-safe base64 JSON (see Multi-board state)
- **`getEncodedStateFromUrl()` / `getEncodedStateFromRoute()`**: Read the `?g=` parameter from `window.location` or a route query
- **`restoreFromEncodedState()` / `restoreMultiFromEncodedState()`**: Store actions that decode and apply state to the boards

The `useShareLink` composable (`/src/composables/useShareLink.ts`) copies a read-only `/share?g=<encoded>` link to the clipboard and opens the share page.

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
  - Display flags byte (if extended bit 7 set): bit 0 showGridInfo, 1 showArrows,
    2 showPerspective, 3 showSkills, 4 teamView, 5 inverted, 6 wrap (bit 7 spare)
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

Invalid entries are filtered with console warnings, ensuring header counts match actual data written and preventing encoding/decoding mismatches. Every field validated here must stay in sync with its bit width: `writeBits` silently truncates oversized values, which would alias them to different IDs on decode.

### Extended Mode

Extended mode activates when:

- More than 7 tile entries (modified hexes) OR more than 7 character entries
- Display flags are explicitly provided (even if all false)
- Phantimals are present
- Paragon entries are present

Display flags are only stored when explicitly provided (`d !== undefined`). Extended flags bit 7 marks their presence and is followed by a dedicated display-flags byte, so an explicit `d=0` (all toggles off) survives the round trip even when extended counts or phantimals also require the extended header.

## URL Operations

### Encoding Process

1. Serialize board state to GridState via `serializeGridState()` (only non-default tile states are kept)
2. Binary encode with bit packing via `encodeToBinary()`, which first filters invalid entries via `validateGridState()`
3. Convert to URL-safe string via `bytesToUrlSafe()`
4. Append as query parameter: `?g=<encoded>`

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
- **Companions (ID ≥ 10000)**: Settled per main: each main is placed (its skill spawns the companions), then those companions are repositioned onto their saved hexes before the next main is placed
- **Phantimals (ID ≥ 100000)**: Serialized separately in the `p` section via 4-bit local IDs

**Note**: Character IDs are limited to 65,535 (16-bit encoding). Companion IDs are `N * 10000 + base`, so the field covers companion index N up to 6 for base IDs below 5,536 (e.g. Zanie's second turret, ID 20089). IDs exceeding the limit are filtered during validation.

## Multi-board state (Teams)

The Teams page shares N boards in one link. Several boards plus an active id and global flags are too varied for the single-board binary packing, and there is no back-compat constraint, so multi-board state is encoded as **url-safe base64 of JSON** instead:

- `serializeMultiGridState(boards, activeId, displayFlags, mode)` → `MultiGridState` (`/src/utils/gridStateSerializer.ts`)
- `encodeMultiGridStateToUrl(state)` → the `g` value carried by `/teams?g=` and `/share?g=` links (`/src/utils/urlStateManager.ts`)
- `TeamsView` restores it on load via `useTeamsRestore`, which resolves the payload's team mode, normalizes the board count to the mode's shape, and applies it through `useUrlStateStore.restoreMultiFromEncodedState`.

`MultiGridState` is `{ boards, active?, d?, mode? }`. Each board record is a `BoardState` `{t, c, p, a, pr, m}`: the single-board `GridState` plus `m`, the board's map key. `mode` is always written by the serializer; links predating it (or carrying a mode that contradicts the board count) resolve their mode from the count via `resolveTeamMode` (`/src/lib/teams/modes.ts`) — five boards belong to the Supreme League page, otherwise the smallest fitting mode. Restore caps boards at `MAX_GRID_COUNT` (5), passes the map keys into `setGridCount`, then applies each board in order: tiles, mains (companions settled per main), paragon, artifacts, phantimals, then `seedPhantimalBaseline()`. After all boards, `grids.dedupeCharacters()` repairs page-wide hero uniqueness that per-board validation cannot see. The restore result reports `hasDisplayFlags` so payloads without a `d` field (canonical saved-team data) apply board content without touching the viewer's display toggles.

The same encoding, in a **canonical form** stripped of viewer state (`active` and `d`, boards rebuilt in fixed key order), is the payload of saved teams — see [Teams](./TEAMS.md). A saved team's `data` string works verbatim as a `/share?g=` value.

The single-board binary format above serves the Arena (`?g=` on `/`).
