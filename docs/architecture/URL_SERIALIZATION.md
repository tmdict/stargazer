# URL Serialization

## Overview

State leaves the live boards through exactly two serialization formats, split by purpose:

- **Binary** (`/src/utils/binaryEncoder.ts`): the link format. Every `?g=` payload — Arena links, Teams links, `/share` links — is one self-describing binary string, plus the Arena autosave (`stargazer.arena`), the one binary value at rest (a device-local snapshot that is never exported or shared). Compact, stateless, and versionless: the format changes only with a written migration.
- **JSON interchange** (`encodeMultiGridStateToUrl` / `decodeMultiGridStateFromUrl`): url-safe base64 of `MultiGridState` JSON. The saved-team library, per-mode autosave slots, and backup/export files — the data canonicalization and byte-equality compares operate on. Never a link.

The split follows exportability: anything a user can export or share as a team file is JSON; links and the unexportable arena autosave are binary.

## Design Principles

1. **One generic codec**: a single self-describing format for every link; pages route on the decoded payload's mode instead of owning formats
2. **Compact representation**: bit packing, section bitmaps, and small wire ids for minimal URL length
3. **No version field**: the format is frozen by golden-string tests; a future change ships with its own temporary migration shim
4. **Strict decoding**: unknown mode ids, map ids, or section-bitmap bits reject the payload, and the bit stream must be fully consumed — a payload either decodes exactly or not at all
5. **Input validation**: `validateGridState()` filters out-of-range entries before encoding so bit-field truncation can never alias ids

## Core Components

### URL State Management (`/src/utils/urlStateManager.ts`, `/src/stores/urlState.ts`)

- **`decodeLinkFromUrl()`**: the universal link decoder — the only function any page or storage pass calls for a `?g=` payload. Returns a `BinaryLinkState` (`{ mode, active, d, boards }`) or null. Strict v2 first; a failure falls through to the temporary legacy shim (see Migration shim below)
- **`encodeGridStateToUrl()` / `decodeGridStateFromUrl()`**: the Arena adapters — encode wraps the single board as mode `'arena'`; decode rejects any payload naming another mode, so a Teams link pasted on the Arena page fails clean instead of half-rendering one board
- **`encodeMultiGridStateToLinkUrl()`**: encodes a decoded `MultiGridState` as a binary Teams link (the Copy Link path decodes the persistence snapshot once and re-encodes it for the wire)
- **`encodeMultiGridStateToUrl()` / `decodeMultiGridStateFromUrl()`**: the JSON interchange codec (see Multi-board state)
- **`getEncodedStateFromUrl()` / `getEncodedStateFromRoute()`**: read the `?g=` parameter from `window.location` or a route query
- **`restoreFromEncodedState()` / `restoreMultiFromDecodedState()` / `restoreMultiFromEncodedState()`**: store actions that apply decoded state to the boards

The `useShareLink` composable (`/src/composables/useShareLink.ts`) copies a read-only `/share?g=<encoded>` link to the clipboard and opens the share page.

### Wire registries (`/src/lib/teams/wire.ts`)

Stable numeric ids for the string-keyed modes and maps, so links carry small integers instead of text. A deliberately pure leaf (no data loading, no Vue) that the codec can import; completeness against the real `TEAM_MODES` / `MAPS` data is enforced by contract tests rather than imports.

- **Modes** (3-bit field): `arena` 0, `1v1` 1, `3v3` 2, `5v5` 3, `5v5sl` 4. The mode implies the board count, so it is never encoded separately
- **Maps** (6-bit field): 0 reserved for "no map" (Arena boards carry none — their serialized tiles are authoritative); registered map keys get ids 1+. Seasonal preset ids follow the rotation policy: a season's maps replace the last season's and freed ids return to the pool

Ids are append-only: reassigning one silently re-routes every existing link.

### Binary Encoder (`/src/utils/binaryEncoder.ts`)

- **`encodeLink(input)`**: `{ mode, active?, d?, boards }` → bytes. Unknown mode keys throw; a board list disagreeing with the mode's count is padded/trimmed with a warning; entries are pre-filtered by `validateGridState()`
- **`decodeLink(bytes)`**: bytes → `BinaryLinkState` or null (silent — a failed probe is expected traffic for the universal decoder)
- **`validateGridState()`**: the pre-encoding filter (exported for direct testing; `encodeBoard` is its one live caller)
- **`bytesToUrlSafe()` / `urlSafeToBytes()`**: URL-safe base64 alphabet (`A-Za-z0-9-_`), shared with the JSON interchange encoding

### Grid State Serializer (`/src/utils/gridStateSerializer.ts`)

Converts between game state and the compact section format both codecs carry:

```typescript
interface GridState {
  t?: number[][] // tiles: [hexId, state]
  c?: number[][] // characters: [hexId, characterId, team]
  a?: (number | null)[] // artifacts: [ally, enemy]
  s?: number[][] // seasonal units (phantimals today): [hexId, localUnitId, team]
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
    arena-mode board carrying any map id rejects (arena boards never encode
    one — their serialized tiles are authoritative)
  - Section bitmap (8 bits): t=0x01, c=0x02, a=0x04, s=0x08, y=0x10, u=0x20
    (bits 6-7 spare; a set spare bit rejects). A counted section with a zero
    count rejects: the encoder never writes an empty section, and both rules
    exist because short retired-format payloads were observed to misread as
    plausible near-empty v2 links without them

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

After the last board the stream must be at a clean end: fewer than 8 bits remaining, all zero. Trailing content — however plausible the prefix — rejects the payload. Together with the unknown-id rejections this makes decoding all-or-nothing, which is what lets the legacy shim probe formats safely.

The wire format is frozen by golden-string tests in `tests/unit/utils/binaryEncoder.test.ts`: a change to bit layout, field order, section order, or the URL-safe alphabet fails them, because it silently breaks every existing link.

### Validation & Limits

Before encoding, `validateGridState()` filters invalid entries (with console warnings), so header counts always match the data written — `writeBits` silently truncates oversized and fractional values alike, which would alias them to different IDs on decode, so every id field also requires an integer:

- **Hex IDs**: 1-63 (6-bit field)
- **Tile states**: 0-7 (3 bits); tiles capped at 63 entries (6-bit count)
- **Character IDs**: 1-65535 (16 bits); characters capped at 63 entries
- **Artifact IDs**: null or 1-63; out-of-range IDs become null
- **Phantimal entries**: local ID 1-15, capped at 15 entries (4-bit count)
- **Synergy entries**: local ID 1-65535, capped at 15 entries (4-bit count)
- **Upgrade entries**: known attr IDs only (values clamp to the registry range), character ID 0-65535, capped at 63 entries (6-bit count)
- **Team values**: 1 (ALLY) or 2 (ENEMY)

**Capacity notes**: character IDs are limited to 65,535, so companion IDs (`N * 10000 + base`) cover companion index N up to 6 for base IDs below 5,536 (e.g. Zanie's second turret, ID 20089). Artifact and phantimal fields fit because seasonal ids rotate (each season's ids replace the last season's) rather than accumulate.

## Link Flow

1. **Encode**: serialize the live boards, `encodeLink()`, `bytesToUrlSafe()`, append as `?g=<encoded>`
2. **Decode**: every page reads `?g=` and calls `decodeLinkFromUrl()`, then routes on the payload's own mode:
   - `/` (Arena) accepts mode `'arena'` only (via `decodeGridStateFromUrl`)
   - `/teams` accepts team modes: `useTeamsRestore.initialize()` adopts the link's mode, shape-normalizes, and applies it; an arena-mode payload is a wrong-page link and falls back to the saved slot
   - `/share` renders whatever the payload says: mode `'arena'` gets the single-board viewer, team modes the multi-board viewer (`restoreMultiFromDecodedState`)
3. A link that fails to decode is treated as absent (the page falls back to its saved state), so a bad link can never wipe an autosave

### Migration shim (TEMPORARY)

`decodeLinkFromUrl` falls back to `decodeLegacyLink` (`/src/utils/upgradeMigration.ts`): a frozen copy of the retired v1 binary decoder plus a JSON probe for pre-binary Teams links, both normalized into the v2 `BinaryLinkState` shape. A startup storage pass in the same module rewrites at-rest legacy values (the arena autosave, mode slots, library records) to the current formats. The whole module is planned for deletion about a month after release; its header carries the removal runbook.

## Character Restoration

Applying a decoded board (`applyGridState` in `/src/stores/urlState.ts`) restores, in order: tiles, mains (companions settled per main), synergy units, upgrade attrs, artifacts, phantimals, then `seedPhantimalBaseline()`.

- **Standard characters (ID < 9000)**: direct placement
- **Placeholders (ID 9000-9999)**: reserved band for the per-faction stand-ins (lib/characters/placeholder.ts); placed directly, and copies of one id may repeat within a team
- **Companions (ID 10000-99999)**: settled per main: each main is placed (its skill spawns the companions), then those companions are repositioned onto their saved hexes before the next main is placed
- **Phantimals (ID 100000-199999)**: serialized separately in the `s` section via 4-bit local IDs
- **Synergy-band units (ID 200000-299999)**: serialized in the `y` section by their local ID (the 200000 offset stripped); locals mirror the `c` band, so restore reuses the same main/companion split. The `y` loop runs after `c` and before phantimals, so a phantimal whose faction requirement depends on the synergy hero still qualifies, and before `seedPhantimalBaseline()` so a bulk restore never reads as a qualifying transition

Both restore paths end with `grids.deriveSynergy()`: the Syn affordance is never serialized, so it is re-derived from whether any restored board holds a synergy hero.

## Multi-board state (JSON interchange)

`MultiGridState` is `{ boards, active?, d?, mode?, season? }`. Each board record is a `BoardState` `{t, c, s, y, u, a, m}`: the single-board `GridState` plus `m`, the board's map key. `season` is the content pool the snapshot was built from (`/src/lib/seasonal.ts`): always written by the serializer and preserved (never re-stamped) by canonicalization; an invalid value sanitizes away, and an absent one means no provenance (readers treat the payload as current-pool content). Pre-field payloads are stamped season 7 by the temporary shim while it lives — there is no permanent default, per the shims-are-always-temporary policy. It drives the retired-seasonal masking and ingress strip documented in [Seasonal Content](./SEASONAL.md); binary links never carry it. This is the format of the saved-team library, the per-mode autosave slots, and backup files:

- `serializeMultiGridState(boards, activeId, displayFlags, mode)` → `MultiGridState` (`/src/utils/gridStateSerializer.ts`)
- `encodeMultiGridStateToUrl(state)` → url-safe base64 JSON, the `data` payload of slots, saved teams, and exports
- `mode` is always written by the serializer; payloads predating it (or carrying a mode that contradicts the board count) resolve their mode from the count via `resolveTeamMode` (`/src/lib/teams/modes.ts`): five boards belong to the Supreme League page, otherwise the smallest fitting mode

Restore (`restoreMultiFromDecodedState`, shared by the JSON wrapper and ShareView's binary links) caps boards at `MAX_GRID_COUNT` (5), passes the map keys into `setGridCount`, then applies each board in order as above. After all boards, `grids.dedupeCharacters()` repairs page-wide hero uniqueness that per-board validation cannot see. The restore result reports `hasDisplayFlags` so payloads without a `d` field (canonical saved-team data) apply board content without touching the viewer's display toggles. Callers decide whether to honor a present `d`: a `?g=` link applies every flag (sharing the sharer's exact view is the point of a link), while Teams mode-slot restores ignore it entirely, since view toggles are device-level preferences (`stargazer.teams.display`).

Teams ingress (link, slot, and saved-team loads) shape-normalizes every payload against its mode via `normalizeTeamPayload`, which also strips `y` from modes without `allowSynergy`: a crafted synergy section on a multi-board mode would otherwise bypass the page-wide duplicate repair, since its ids differ from the base hero's. `/share` stays lenient and renders payloads as-is.

Adding a section is forward-compatible for **rendering** JSON: an old client ignores the unknown key and decodes everything else. It is not compatible for **persisting**: an old client that imports a team export or re-saves a loaded team canonicalizes through its own `BOARD_CONTENT_KEYS` and permanently drops sections it doesn't know. Binary links have no such leniency — an old client rejects a link whose bitmap sets a bit it doesn't know, by design.

The same encoding, in a **canonical form** stripped of viewer state (`active` and `d`, boards rebuilt in fixed key order), is the payload of saved teams; see [Teams](./TEAMS.md). A saved team's `data` string is interchange data, not a link: sharing it goes through export files or the Copy Link action, which re-encodes it as binary.
