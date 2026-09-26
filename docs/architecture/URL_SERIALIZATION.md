# URL Serialization

Board state leaves the app in two formats. The binary link format (`src/utils/binaryEncoder.ts`) carries every `?g=` link, whether from the Arena, the Teams page or `/share`. It also stores the Arena autosave under `stargazer.arena`, the one binary value at rest. The JSON interchange format is url-safe base64 of a `MultiGridState`, and it holds the saved-team library, the per-mode autosave slots and backup files. Links never use JSON, and nothing exported uses binary.

The split follows what each format needs. Links must be short and are allowed to break. Stored teams must compare byte for byte and survive new app versions. `src/utils/urlStateManager.ts` holds one encode and one decode per format.

## Decisions

Every link uses one self-describing codec. The envelope names a mode (the Arena is mode 0 with one board), and each page routes on the decoded mode instead of owning a format.

The format has no version field. The app and its links deploy together, links are disposable, and only the Arena autosave outlives a deploy. Golden-string tests in `tests/unit/utils/binaryEncoder.test.ts` freeze the layout, so any change to field order, section order, bit width or the URL alphabet fails them.

Decoding is strict, so a payload decodes exactly or not at all. Unknown mode ids, unknown map ids and unknown bitmap bits reject it. So do a counted section with a zero count (the encoder never writes an empty section) and a map id on an Arena board. After the last board the stream must end cleanly, with fewer than 8 bits left and all of them zero. These rules exist because short payloads in other formats would otherwise read as plausible near-empty links, and the migration shim relies on them to probe formats in order.

## Binary wire format

All fields are written LSB-first. The board count comes from the mode, so it is never encoded.

```
Envelope, once (14 bits)
  mode id          3                    wire registry
  active board     3                    0-based, clamped to the board count
  display flags    8                    0 wrap, 1 skills, 2 perspective,
                                        3 inverted, 4 team view; 5-7 spare

Board header, once per board (14 bits)
  map id           6                    wire registry; 0 = no map
  section bitmap   8                    0 t, 1 c, 2 a, 3 s phantimals, 4 y,
                                        5 u, 6 s companions; 7 spare

Sections, in bitmap-bit order
  tiles            count 6 + 9 each     hex 6, state 3
  characters       count 6 + 23 each    hex 6, character id 16, team 1
  artifacts        12, no count         ally 6, enemy 6 (0 = none)
  phantimals       count 4 + 11 each    hex 6, local id 4, team 1
  synergy          count 4 + 23 each    hex 6, local id 16, team 1
  upgrades         count 6 + 27 each    team 1, character id 16,
                                        attr id 6, value 4
  phantimal        count 4 + 13 each    hex 6, owner local id 4,
  companions                            companion index N 2, team 1
```

Teams are written as `team - 1` and read back with `+ 1`. The flags byte is always present: a state without `d` encodes the unpack defaults, so skills and perspective do not switch off on decode. Grid Info visibility is a device preference (`useGridInfoPrefs`) and never travels in a link.

`encodeLink` throws on an unknown mode key. A board list that disagrees with the mode's board count is trimmed or padded with empty boards, with a warning, because the decoder takes the count from the mode. An Arena board's map key is stripped, since the decoder rejects one. A map key with no wire id encodes as 0: the board still restores from its tiles, and only the Maps tab loses its highlight. `decodeLink` returns null without logging, because a failed probe is normal traffic for the shim. `bytesToUrlSafe` turns the bytes into text with a base64 variant (alphabet `A-Za-z0-9-_`, no padding) that the JSON format shares, and the result goes into `?g=`.

In memory, a board keeps phantimals and their companions together in `s`, a phantimal as its local id L and a companion as `N × 10000 + L`. The encoder splits the companions into the bit 6 section so the phantimal entry keeps its fixed 4-bit id, and the decoder appends them back to `s` after the phantimals. A companion entry with index 0 rejects, because index 0 is the phantimal itself. A board without companions leaves bit 6 unset.

Synergy locals reuse the character field's id space (hero as its base id, a companion as `N × 10000 + base`), and restore adds the synergy band offset back. An upgrade row's character id 0 is reserved for a future team-wide row. The id ranges themselves are in [Grid & Characters](./GRID.md).

### Validation and limits

`validateGridState()` filters entries before encoding, with a console warning for each, so every count matches the entries written. `writeBits` truncates oversized and fractional values alike, which would alias them to a different id on decode, so every id field must be an integer in range:

- Hex ids 1 to 63, tile states 0 to 7, and at most 63 tiles and 63 characters.
- Character and synergy local ids 1 to 65535, with at most 15 synergy entries.
- Artifact ids 1 to 63 or null. An out-of-range id becomes null so the other side's artifact survives, and an `a` that is not a two-element array is dropped.
- Phantimal entries L from 1 to 15, or `N × 10000 + L` with N from 1 to 3, at most 15 across both sections.
- Upgrade rows with known attr ids only and character ids 0 to 65535. Values clamp to the registry range, duplicates keep the last row, default-valued rows drop (matching `canonicalAttrRows`), and at most 63 remain.
- Teams 1 or 2.

A section left empty is omitted, which the decoder's zero-count rule relies on.

### Capacity and headroom

A link is the envelope, then per board a header plus only the sections it uses, rounded up to whole bytes and written at 6 bits per URL character. An Arena link with 3 changed tiles, 2 heroes and 1 upgrade row is 14 + 14 + (6 + 3 × 9) + (6 + 2 × 23) + (6 + 27) = 146 bits, which is 19 bytes or 26 characters. A full board (20 changed tiles, 10 heroes at P4 and R4, both artifacts, a phantimal per side) is about 175 characters as an Arena link and about 855 as a five-board link, roughly a quarter of the same boards as JSON.

Contract tests (`tests/unit/lib/teams/wire.test.ts`, `tests/unit/characters/attributes.test.ts`) fail when a mode, map or attr outgrows its field, including an attr whose max would not fit the 4-bit value, so nothing truncates on the wire. The "In use" column is a snapshot for planning; the tests, not this table, enforce the limits.

| Field                  | Bits | In use                           | Capacity | Headroom                                           |
| ---------------------- | ---- | -------------------------------- | -------- | -------------------------------------------------- |
| Mode id                | 3    | 4 (the Arena and 3 board counts) | 8        | 4 more board counts (id 4 is held by the shim)     |
| Active board           | 3    | up to 5 boards                   | 8        | modes of up to 8 boards                            |
| Display flags          | 8    | 5 flags                          | 8        | 3 more toggles                                     |
| Map id                 | 6    | 21 maps, plus 0 for none         | 63       | 42 more maps; seasonal preset ids rotate           |
| Section bitmap         | 8    | 7 sections                       | 8        | 1 more section                                     |
| Hex id                 | 6    | 45 hexes                         | 63       | the grid can grow to 63 hexes                      |
| Tile state             | 3    | 7 states                         | 8        | 1 more state                                       |
| Character id           | 16   | heroes and companions            | 65,535   | companion index N up to 6 for base ids below 5,536 |
| Artifact id            | 6    | 6 permanent and 12 seasonal      | 63       | seasonal ids rotate, so the pool does not grow     |
| Phantimal local id     | 4    | 5 per season                     | 15       | 1 to 12 usable, 13 to 15 reserved for tests        |
| Attr id                | 6    | 2                                | 63       | 61 more upgrade kinds                              |
| Attr value             | 4    | max level 4                      | 15       | level caps can rise to 15                          |
| Upgrade rows per board | 6    | up to 20 (10 heroes × 2 attrs)   | 63       | 6 attrs per hero on a full board                   |

Adding content needs no format change: new heroes, maps, team types, board counts, artifacts, phantimal types and upgrade kinds, level caps up to 15, up to 3 more display toggles, and one more section in the spare bitmap bit. A team type does not touch the wire at all.

Changing the game's shape does need a new format: a grid beyond 63 hexes, an eighth tile state, more than 8 modes or 8 boards, a ninth section, 64 maps or upgrade kinds, or ids beyond 16 bits. A new format ships with new golden strings and a frozen copy of the old decoder in a temporary shim that converts the Arena autosave once. Every existing link breaks.

## Wire registries

`src/lib/teams/wire.ts` maps the string keys to small ids. Modes are `arena` 0, `1v1` 1, `3v3` 2 and `5v5` 3. A mode is a board count, so the table grows only for a new count, and a type such as Supreme League travels as the boards' map ids. Map id 0 means no map, which Arena boards always use because their serialized tiles are authoritative. `MAP_WIRE_IDS` gives every registered map key an id from 1.

The file imports no data and no Vue, because the codec imports it. Contract tests check it against `TEAM_MODES` and the map data instead.

An id stays fixed while its mode or map exists, since reassigning one that live data still carries would silently re-route those links. A retired id goes through a conversion window: a temporary migration converts it for as long as the migration lives, and the id is free once it is deleted. Seasonal preset maps rotate the same way. Id 4 belongs to the retired `5v5sl` mode until the shim is gone.

## Reading a link

Every page calls `decodeLinkFromUrl` and routes on the payload's mode. The Arena accepts only mode `arena`, so a Teams link pasted there fails cleanly instead of rendering one board. The Teams page accepts team modes and falls back to the saved slot for anything else ([Teams](./TEAMS.md) owns that sequence). `/share` renders either kind as it is, and its Edit action reopens the same payload on `/` or `/teams`. A link that fails to decode counts as absent, so a bad link can never overwrite an autosave.

Display flags travel with every link, and a `?g=` restore applies them, since showing the sharer's view is the reason for a link. Multi-board restores report `hasDisplayFlags`, so a payload without `d` (canonical saved-team data) leaves the viewer's toggles alone.

The temporary shim in `src/utils/upgradeMigration.ts` catches what strict decoding rejects. `decodeLegacyLink` re-reads a link whose mode id is 4 (the retired `5v5sl` mode) as 5v5 on a patched copy of its bytes, then tries pre-binary JSON Teams links, then a frozen copy of the previous binary decoder, and converts each to the current shape. Two startup passes in the same file rewrite stored values, each under its own marker. `runUpgradeStoragePass` converts the library records, the mode slots and the Arena autosave to the current formats. `runModeStoragePass` moves the retired `5v5sl` slot into the 5v5 slot when it was the last-used mode, rewrites library records, and drops the old key. The whole file is meant to be deleted on one date, and its header holds the removal steps.

## Restoring a board

`applyGridState` (`src/stores/urlState.ts`) first picks the map. A payload without `m` (Arena links and the autosave) adopts the preset its tiles reproduce, found by `findMapByTiles`, and otherwise every tile resets. Multi-board restores build each board on `resolveBoardMap`, the same rule canonicalization uses. It then restores in this order, each step for a reason:

1. Tiles.
2. Characters. Each main is placed (its skill spawns its companions), and those companions move to their saved hexes before the next main, so a spawned companion never takes a tile a later main needs.
3. Synergy units, with the same main and companion handling. They come before phantimals so a phantimal whose faction count depends on the synergy hero still qualifies.
4. Upgrade attributes, then artifacts.
5. Phantimals and their companions, through the phantimal placement checks.
6. `seedPhantimalBaseline()`, so the bulk restore does not look like a team starting to qualify.

A phantimal-band or synergy-band value found inside `c` or `y` is dropped. The JSON codec has no validation pass, and `200050 % 10000` would otherwise match hero 50's companions.

A multi-board restore caps the boards at `MAX_GRID_COUNT` (5) and then runs `grids.dedupeCharacters()`, because per-board checks cannot see the same hero on one team across two boards. Every restore ends with `grids.deriveSynergy()`, since the Syn toggle is never serialized.

## JSON interchange format

The payload is url-safe base64 (the same alphabet as links, no padding) of UTF-8 JSON:

| Field    | Holds                                                                           |
| -------- | ------------------------------------------------------------------------------- |
| `boards` | one object per board: sections `t`, `c`, `s`, `y`, `u`, `a` as above, plus `m`  |
| `active` | the active board index, omitted when 0                                          |
| `d`      | the display flags byte, absent from canonical saved-team data                   |
| `mode`   | the team mode key                                                               |
| `season` | the season the content came from, 0 to 9999 ([Seasonal Content](./SEASONAL.md)) |

`m` is the board's map key. `t` lists only tiles whose state differs from the default, and `u` rows are sorted with default values dropped. The serializer always writes `season`, and canonicalization keeps it instead of re-stamping. An absent `season` means no provenance, so readers treat the content as current. `decodeMultiGridStateFromUrl` rejects a payload unless every board is a plain object whose sections have these shapes, and it drops an invalid `season`. A payload with no mode, or a mode that disagrees with its board count, resolves to the smallest mode that fits (`resolveTeamMode`). Team types are never written: they are derived from the maps. The canonical form used by saved teams drops `active` and `d`, writes board keys in `BOARD_CONTENT_KEYS` order and normalizes `u` rows ([Teams](./TEAMS.md)). A saved team's data is interchange JSON, not a link: sharing goes through an export file or Copy Link, which re-encodes it as binary (`encodeMultiGridStateToLinkUrl`).

Adding a section is forward-compatible for rendering: an older client ignores the unknown key and shows the rest. It is not compatible for saving. An older client that imports an export or re-saves a loaded team canonicalizes through its own `BOARD_CONTENT_KEYS` and drops the new section for good. Binary links have no such leniency: an older client rejects a bitmap bit it does not know.

## Related documentation

- [Teams](./TEAMS.md): mode slots, the saved-team library, canonical data and restore sequences
- [Seasonal Content](./SEASONAL.md): season stamps and what loading strips
- [Grid & Characters](./GRID.md): unit id ranges, companions and the multi-board store
