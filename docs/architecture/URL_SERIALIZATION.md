# URL Serialization

## Overview

State leaves the live boards through two serialization formats, split by exportability. The binary link codec (`/src/utils/binaryEncoder.ts`) carries every `?g=` payload (Arena, Teams and `/share` links) plus the Arena autosave (`stargazer.arena`), the one binary value at rest: compact, stateless, and versionless. The JSON interchange codec (url-safe base64 of `MultiGridState` JSON) is the format of the saved-team library, the per-mode autosave slots and backup files, the data that canonicalization and byte-equality compares operate on, and never a link.

## Design Principles

1. **One generic codec**: a single self-describing format for every link; pages route on the decoded payload's mode instead of owning formats
2. **Compact representation**: bit packing, section bitmaps, and small wire ids for minimal URL length
3. **No version field**: the format is frozen by golden-string tests; a future change ships with its own temporary migration, since the app and its links deploy together and links are expendable by policy
4. **Strict decoding**: unknown mode ids, map ids, or section-bitmap bits reject the payload, and the bit stream must be fully consumed: a payload either decodes exactly or not at all
5. **Input validation**: `validateGridState()` filters out-of-range entries before encoding so bit-field truncation can never alias ids

## Core Components

### Codec entry points (`/src/utils/urlStateManager.ts`)

| Function                                                        | Contract                                                                                                                                                                                                               |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `decodeLinkFromUrl()`                                           | The universal link decoder, the only function any page or storage pass calls for a `?g=` payload. Returns a `BinaryLinkState` (`{ mode, active, d, boards }`) or null; strict v2 first, then the temporary legacy shim |
| `encodeGridStateToUrl()` / `decodeGridStateFromUrl()`           | The Arena adapters: encode wraps the single board as mode `'arena'`; decode rejects any payload naming another mode, so a Teams link pasted on the Arena page fails clean instead of half-rendering one board          |
| `encodeMultiGridStateToLinkUrl()`                               | Encodes a decoded `MultiGridState` as a binary Teams link (Copy Link decodes the persistence snapshot once and re-encodes it for the wire)                                                                             |
| `encodeMultiGridStateToUrl()` / `decodeMultiGridStateFromUrl()` | The JSON interchange codec. Decode rejects any board that is not a plain object with the serializer's section shapes and sanitizes a non-integer or out-of-range `season` (0 to 9999)                                  |
| `getEncodedStateFromUrl()` / `getEncodedStateFromRoute()`       | Read `?g=` from `window.location` (initial page load) or a route query (ShareView)                                                                                                                                     |

The store actions `restoreFromEncodedState()` / `restoreMultiFromDecodedState()` / `restoreMultiFromEncodedState()` (`/src/stores/urlState.ts`) apply decoded state to the boards (see Character Restoration). `useShareLink` (`/src/composables/useShareLink.ts`) copies a read-only `/share?g=<encoded>` link to the clipboard and opens the share page.

### Wire registries (`/src/lib/teams/wire.ts`)

Stable numeric ids for the string-keyed modes and maps, so links carry small integers instead of text. A deliberately pure leaf (no data loading, no Vue) that the codec can import; completeness against the real `TEAM_MODES` / `MAPS` data is enforced by contract tests (`tests/unit/lib/teams/wire.test.ts`) rather than imports.

- **Modes** (3-bit field): `arena` 0, `1v1` 1, `3v3` 2, `5v5` 3, `5v5sl` 4. The mode implies the board count, so it is never encoded separately
- **Maps** (6-bit field): 0 reserved for "no map" (Arena boards carry none: their serialized tiles are authoritative, and a restore adopts the preset those tiles reproduce, if any); registered map keys get ids 1+ (`arena1` to `arena5sp` 1 to 6, `preset-as1` to `preset-as4` 7 to 10, `preset-sr1` to `preset-sr11` 11 to 21). Seasonal preset ids follow the rotation policy: a season's maps replace the last season's and freed ids return to the pool

Mode and permanent-map ids are append-only: reassigning one silently re-routes every existing link. Rotating seasonal preset ids re-routes old links too, accepted under the links-are-expendable policy.

### Binary Encoder (`/src/utils/binaryEncoder.ts`)

- **`encodeLink(input)`**: `{ mode, active?, d?, boards }` → bytes. Unknown mode keys throw; a board list disagreeing with the mode's count is padded/trimmed with a warning; an arena board's `m` is stripped; entries are pre-filtered by `validateGridState()`
- **`decodeLink(bytes)`**: bytes → `BinaryLinkState` or null, silent on failure: a failed probe is expected traffic for the universal decoder
- **`bytesToUrlSafe()` / `urlSafeToBytes()`**: URL-safe base64 alphabet (`A-Za-z0-9-_`), shared with the JSON interchange encoding

### Grid State Serializer (`/src/utils/gridStateSerializer.ts`)

Converts between game state and the compact section format both codecs carry:

```typescript
interface GridState {
  t?: number[][] // tiles: [hexId, state], non-default only
  c?: number[][] // characters: [hexId, characterId, team]
  a?: (number | null)[] // artifacts: [ally, enemy]
  s?: number[][] // seasonal units (phantimals): [hexId, localUnitId, team]
  y?: number[][] // synergy-band units: [hexId, localUnitId, team]
  u?: number[][] // upgrade attrs: [team, characterId, attrId, value], sorted, non-default only
  d?: number // display flags (bit-packed)
}
```

## Binary Wire Format

All fields are written LSB-first. One envelope, then one header + sections per board; the board count comes from the mode, so it is never encoded.

```
[Envelope: 14 bits]
  - Mode id (3 bits): wire.ts registry; unknown ids reject
  - Active board (3 bits): clamped to the mode's board range
  - Display flags (8 bits): bit 0 wrap, 1 showSkills, 2 showPerspective,
    3 inverted, 4 teamView (bits 5-7 spare). Always present: a state that
    carried no `d` encodes the unpack defaults, so skills/perspective don't
    flip on decode. Grid info is not a display flag: its visibility is the
    viewer's device pref (`useGridInfoPrefs`), never carried by a link.

[Per board, in order: Header: 14 bits]
  - Map id (6 bits): wire.ts registry; 0 = no map; unknown ids reject. An
    arena-mode board carrying any map id rejects (arena boards never encode one)
  - Section bitmap (8 bits): t=0x01, c=0x02, a=0x04, s=0x08, y=0x10, u=0x20
    (bits 6-7 spare; a set spare bit rejects). A counted section with a zero
    count rejects: the encoder never writes an empty section. Both rules exist
    because short retired-format payloads misread as plausible near-empty
    links without them.

[Sections, in bitmap-bit order:]
  Tiles      count (6 bits) + 9 bits each: hex ID (6) + state (3)
  Characters count (6 bits) + 23 bits each: hex ID (6) + character ID (16) +
             team (1)
  Artifacts  12 bits fixed: ally (6) + enemy (6); 0 = null
  Phantimals count (4 bits) + 11 bits each: hex ID (6) + local ID (4) + team (1)
  Synergy    count (4 bits) + 23 bits each: hex ID (6) + local unit ID (16) +
             team (1). Locals reuse the character field's ID space (hero =
             base ID, spawned companion = N * 10000 + base); the 200000 band
             offset is applied on restore.
  Upgrades   count (6 bits) + 27 bits each: team (1) + character ID (16,
             0 reserved for a future team-scope row) + attr ID (6) + value (4).
             Carries every registry attr (`/src/lib/characters/attributes.ts`);
             the registry contract test pins that attr maxes fit the value field.
```

Team values are written as `team - 1` (1 bit) and read back as `+ 1`. After the last board the stream must be at a clean end: fewer than 8 bits remaining, all zero. Trailing content, however plausible the prefix, rejects the payload. Together with the unknown-id rejections this makes decoding all-or-nothing, which is what lets the legacy shim probe formats safely.

The wire format is frozen by golden-string tests in `tests/unit/utils/binaryEncoder.test.ts`: a change to bit layout, field order, section order, or the URL-safe alphabet fails them, because it silently breaks every existing link.

### Validation & Limits

Before encoding, `validateGridState()` filters invalid entries (with console warnings), so header counts always match the data written. `writeBits` silently truncates oversized and fractional values alike, which would alias them to different IDs on decode, so every id field also requires an integer:

- **Hex IDs**: 1-63 (6-bit field)
- **Tile states**: 0-7 (3 bits); tiles capped at 63 entries (6-bit count)
- **Character IDs**: 1-65535 (16 bits); characters capped at 63 entries
- **Artifact IDs**: null or 1-63; out-of-range IDs become null so the other side's artifact survives; an `a` that is not a two-element array drops
- **Phantimal entries**: local ID 1-15, capped at 15 entries (4-bit count)
- **Synergy entries**: local ID 1-65535, capped at 15 entries (4-bit count)
- **Upgrade entries**: known attr IDs only (values clamp to the registry range), character ID 0-65535, deduped last-wins with default-valued rows dropped (mirroring `canonicalAttrRows`), capped at 63 entries (6-bit count)
- **Team values**: 1 (ALLY) or 2 (ENEMY)
- **Empty sections**: an emptied list is omitted entirely, which the decoder's zero-count rejection relies on

### Capacity & Headroom

A link is the 14-bit envelope, then per board a 14-bit header plus only the sections it uses, rounded up to whole bytes and base64-encoded (6 bits per URL character). An arena link holding 3 changed tiles, 2 heroes, and 1 upgrade row is 14 + 14 + (6 + 3 × 9) + (6 + 2 × 23) + (6 + 27) = 146 bits: 19 bytes, 26 characters. A fully loaded board (20 changed tiles, 10 heroes at P4/R4, both artifacts, a phantimal per side) is about 175 characters as an arena link and about 855 as a five-board link, roughly a quarter of the same boards as JSON interchange.

Every field has room beyond today's data. The registry-backed fields are pinned by contract tests (`tests/unit/lib/teams/wire.test.ts`, `tests/unit/characters/attributes.test.ts`), so a mode, map, or attr that outgrows its field fails CI instead of truncating on the wire:

| Field                  | Bits | In use                      | Capacity | Headroom                                       |
| ---------------------- | ---- | --------------------------- | -------- | ---------------------------------------------- |
| Mode id                | 3    | 5 modes                     | 8        | 3 more modes                                   |
| Active board           | 3    | 5 boards max                | 8        | modes of up to 8 boards                        |
| Display flags          | 8    | 5 flags                     | 8        | 3 more toggles                                 |
| Map id                 | 6    | 21 maps + "none"            | 64       | 42 more maps                                   |
| Section bitmap         | 8    | 6 sections                  | 8        | 2 more sections                                |
| Hex id (every entry)   | 6    | 45 hexes                    | 63       | the grid can grow to 63 hexes                  |
| Tile state             | 3    | 7 states                    | 8        | 1 more state                                   |
| Character id           | 16   | heroes + companions         | 65,535   | companion index N ≤ 6 for base ids below 5,536 |
| Artifact id            | 6    | 6 permanent + 12 seasonal   | 63       | seasonal ids rotate, so the pool never grows   |
| Phantimal local id     | 4    | 5 types                     | 15       | same rotation                                  |
| Attr id                | 6    | 2                           | 63       | 61 more upgrade kinds                          |
| Attr value             | 4    | max level 4                 | 15       | level caps can rise to 15                      |
| Upgrade rows per board | 6    | 20 (5 heroes × 2 sides × 2) | 63       | 6 attrs per hero on a full board               |

Growth that costs nothing (no format change, no shim): new heroes, maps, modes, artifacts, phantimal types, and upgrade kinds; higher level caps up to 15; new display toggles (3 spare bits); and whole new features as new sections (2 spare bitmap bits). The registries are append-only, so adding content is adding a row.

Growth that forces a new format, each a change to the game's shape rather than its content: a grid beyond 63 hexes, an eighth tile state, more than 8 modes or 8 boards in a mode, a ninth section, an exhausted registry (64 maps or 64 upgrade kinds), or an id scheme outgrowing 16 bits. A new format ships the way v2 did: new golden strings, a frozen copy of the old decoder in a temporary shim that converts the arena autosave once, and every existing link breaks.

## Link Flow

1. **Encode**: serialize the live boards, `encodeLink()`, `bytesToUrlSafe()`, append as `?g=<encoded>`
2. **Decode**: every page reads `?g=` and calls `decodeLinkFromUrl()`, then routes on the payload's own mode:
   - `/` (Arena) accepts mode `'arena'` only (via `decodeGridStateFromUrl`)
   - `/teams` accepts team modes: `useTeamsRestore.initialize()` adopts the link's mode, shape-normalizes, and applies it; an arena-mode payload is a wrong-page link and falls back to the saved slot
   - `/share` renders whatever the payload says: mode `'arena'` gets the single-board viewer, team modes the multi-board viewer (`restoreMultiFromDecodedState`); its Edit action reopens the payload on `/` or `/teams`
3. A link that fails to decode is treated as absent (the page falls back to its saved state), so a bad link can never wipe an autosave

### Migration shim (TEMPORARY)

`decodeLinkFromUrl` falls back to `decodeLegacyLink` (`/src/utils/upgradeMigration.ts`): a JSON probe for pre-binary Teams links, then a frozen copy of the retired v1 binary decoder, both normalized into the v2 `BinaryLinkState` shape. A startup storage pass in the same module rewrites at-rest legacy values (the arena autosave, the four mode slots, library records) to the current formats. The whole module is planned for deletion about a month after release; its header carries the removal runbook.

## Character Restoration

Applying a decoded board (`applyGridState` in `/src/stores/urlState.ts`) first picks the map: a payload without `m` (Arena links and autosave) adopts the preset its tiles reproduce (`findMapByTiles`), otherwise all tiles reset. It then restores, in order: tiles, mains (companions settled per main), synergy units, upgrade attrs, artifacts, phantimals, then `seedPhantimalBaseline()`.

- **Standard characters (ID < 9000)**: direct placement
- **Placeholders (ID 9000-9999)**: reserved band for the per-faction stand-ins (`/src/lib/characters/placeholder.ts`); placed directly, and copies of one id may repeat within a team
- **Companions (ID 10000-99999)**: settled per main: each main is placed (its skill spawns the companions), then those companions are repositioned onto their saved hexes before the next main is placed, so a spawned companion cannot squat on a tile a later main needs
- **Phantimals (ID 100000-199999)**: serialized separately in the `s` section via 4-bit local IDs
- **Synergy-band units (ID 200000-299999)**: serialized in the `y` section by their local ID (the 200000 offset stripped); locals mirror the `c` band, so restore reuses the same main/companion split. The `y` loop runs after `c` and before phantimals, so a phantimal whose faction requirement depends on the synergy hero still qualifies, and before `seedPhantimalBaseline()` so a bulk restore never reads as a qualifying transition
- **Crafted locals**: a phantimal- or synergy-band value inside `c` or `y` is dropped (the JSON codec has no validation pass), since `200050 % 10000` would otherwise match hero 50's companions

Both restore paths end with `grids.deriveSynergy()`: the Syn affordance is never serialized, so it is re-derived from whether any restored board holds a synergy hero.

## Multi-board state (JSON interchange)

`MultiGridState` is `{ boards, active?, d?, mode?, season? }`. Each board record is a `BoardState` `{t, c, s, y, u, a, m}`: the single-board `GridState` plus `m`, the board's map key. This is the format of the saved-team library, the per-mode autosave slots, and backup files.

- **Serialize**: `serializeMultiGridState(boards, activeId, displayFlags, mode)` → `MultiGridState`; `encodeMultiGridStateToUrl(state)` → url-safe base64 JSON, the `data` payload of slots, saved teams, and exports
- **`mode`**: always written by the serializer; a payload without one, or carrying a mode that contradicts the board count, resolves its mode from the count via `resolveTeamMode` (`/src/lib/teams/modes.ts`): five boards belong to the Supreme League page, otherwise the smallest fitting mode
- **`season`**: the content pool the snapshot was built from (`/src/lib/seasonal.ts`), always written by the serializer and preserved (never re-stamped) by canonicalization. An invalid value sanitizes away, and an absent one means no provenance (readers treat the payload as current-pool content). It drives the retired-seasonal masking and ingress strip documented in [Seasonal Content](./SEASONAL.md); binary links never carry it. Pre-field payloads are stamped season 7 by the temporary shim while it lives; there is no permanent default, per the shims-are-always-temporary policy
- **Restore**: `restoreMultiFromDecodedState` (shared by the JSON wrapper and ShareView's binary links) caps boards at `MAX_GRID_COUNT` (5), passes the map keys into `setGridCount`, then applies each board in order as above. After all boards, `grids.dedupeCharacters()` repairs page-wide hero uniqueness that per-board validation cannot see
- **Display flags**: the restore result reports `hasDisplayFlags`, so payloads without a `d` field (canonical saved-team data) apply board content without touching the viewer's toggles. Callers decide whether to honor a present `d`: a `?g=` link applies every flag (sharing the sharer's exact view is the point of a link), while Teams slot and saved-team restores ignore it entirely, since view toggles are device-level preferences (`stargazer.teams.display`)
- **Teams ingress**: link, slot, and saved-team loads shape-normalize every payload against its mode via `normalizeTeamPayload`, which also strips `y` from modes without `allowSynergy`: a crafted synergy section on a multi-board mode would otherwise bypass the page-wide duplicate repair, since its ids differ from the base hero's. `/share` stays lenient and renders payloads as-is
- **Canonical form**: the same encoding stripped of viewer state (`active` and `d`, boards rebuilt in `BOARD_CONTENT_KEYS` order, `u` rows normalized) is the payload of saved teams; see [Teams](./TEAMS.md). A saved team's `data` string is interchange data, not a link: sharing it goes through export files or the Copy Link action, which re-encodes it as binary

Adding a section is forward-compatible for **rendering** JSON: an old client ignores the unknown key and decodes everything else. It is not compatible for **persisting**: an old client that imports a team export or re-saves a loaded team canonicalizes through its own `BOARD_CONTENT_KEYS` and permanently drops sections it doesn't know. Binary links have no such leniency: an old client rejects a link whose bitmap sets a bit it doesn't know, by design.

## Related Documentation

- [`/docs/architecture/TEAMS.md`](./TEAMS.md) - Per-mode slots, the saved-team library, canonical data and the restore sequences
- [`/docs/architecture/SEASONAL.md`](./SEASONAL.md) - Season stamps, retired content masking and the ingress strip
- [`/docs/architecture/GRID.md`](./GRID.md) - Unit id namespaces, companions, the multi-board store
