# Team Import

## Overview

The team import reads the game's match result screenshots on the device and saves what they show as a new team: both rosters with each hero's paragon and refinement, both artifacts, and a record name in the export convention. Recognition is pure TypeScript over RGBA buffers (`/src/lib/import/`) run in a web worker; it produces evidence, the review turns evidence plus the user's edits into a plan, and only Save as New changes the boards.

## Design Principles

1. **On-device, pure readers**: Screenshots are decoded to pixels on the main thread and read in a worker by canvas-free code that a Node script drives the same way
2. **Landmarks before templates**: The Ally and Enemy tabs place the card columns; template matching only settles exact positions and identities
3. **Geometry in one place**: `layout.ts` holds the result screen's nominal positions, sizes and their per-shot ranges; each reader owns its template searches and score floors
4. **Evidence stays evidence**: A reading never changes; every review decision is an override beside it, so each cell shows a confidence, an edit is reversible, and corrections export with the original prediction
5. **Pure plan, engine apply**: Readings plus review edits become a `TeamImportPlan` with no store access; the grids store stamps it with its own primitives

## Architecture

```
┌─ TeamImportModal ─────────────┐  plan   ┌─ TeamsView ────────────────┐
│ ImageDropZone · ShotList      │────────▶│ handleImportMatch          │
│ Review · issues · Save as New │         │ grids.applyRosters         │
└──────────────┬────────────────┘         │ teamLibrary.saveAsNew      │
               ▼                          └────────────────────────────┘
┌─ useTeamImport (module state) ┐  read   ┌─ teamImport.worker ────────┐
│ decode to 1150 px RgbaImage   │────────▶│ readScreenshot(shot, refs) │
│ references from app + chaldea │◀────────│ lib/import: layout frames  │
│ overrides · learned icons     │ reading │ heroes stars strip artifact│
└──────────────┬────────────────┘         └────────────────────────────┘
               ▼
┌─ lib/teams/teamImport.ts ─────┐
│ buildTeamImportPlan           │
│ boards · issues · record name │
└───────────────────────────────┘
```

`scripts/check-import.ts` drives the same `lib/import` readers and reference assembly from Node (see References and Scripts).

## Recognition

### Readers (`/src/lib/import/`)

Pure, DOM-free code over `RgbaImage`, shared by the worker and the check script. Each field of a `ScreenshotReading` comes from its own visual signal, which is why the readers stay separate and a correction to one never moves another:

| Reading        | Evidence                                                    | Consequence                                                                                             |
| -------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Hero           | Face crop against portrait, bundled and learned descriptors | New face examples improve identity without touching any other reader                                    |
| Paragon        | The card frame against the six frame templates              | A wrong frame also displaces the face and star crops, so a doubtful frame puts the whole cell in review |
| Refinement     | Count and colour of the stars above the face                | Independent of the hero descriptor                                                                      |
| Artifact       | Header icon against the artifact images                     | Own references and margins; always offered for review                                                   |
| Map and result | Strip ring and badges; Ally tab colour                      | Mode-independent: which board a shot fills is settled in review                                         |

### Pipeline (`/src/lib/import/pipeline.ts`)

`readScreenshot(shot, refs)` in order:

1. **Normalise** (in the composable): shots under 600 px wide are rejected; the rest are drawn at `CANONICAL_WIDTH` (1150). The full screen width is the one invariant, since the game lays the panel out from it; a crop may lose height at either end
2. **Place the columns**: the Ally and Enemy tabs (`findTabs`) seed each card column and the frame comb (`findPanelAnchor`) settles it. Without tabs the crop positions are tried, then `scanForColumns` pairs columns anywhere in the shot. A column placed by a landmark is trusted down to `LANDMARK_FLOOR`, an unplaced one only to `ANCHOR_FLOOR`; below its floor a column's cells come back empty rather than with a stranger's face
3. **Read each card**: the best frame (`matchCard`) is both the paragon level and the card's exact box; the face (`artBoxOf`) is described at nine small alignments and ranked (`rankHeroes`), the star row is counted (`readStars`), and each side is settled so no hero is read twice (`assignUnique`)
4. **Strip, artifacts, winner**: the green ring around the current map places the strip (`readStrip`), the header icons are matched (`readArtifact`), and the Ally tab's colour is the map's winner

### Hero Identity (`/src/lib/import/heroes.ts`)

- **Descriptor**: A 32×24 RGB face crop, each channel zero-mean and unit-norm, so the frame's warm tint cancels; 2,304 values, Int8 at ×400 in the table and in every stored descriptor
- **Table**: Every bundled portrait cut over a grid of crop windows, since the in-game card zooms the same painting slightly differently per hero; a costume reference gets a second, smaller grid for the game's skin card. About 8,600 rows for 125 heroes and 11 costumes, near 20 MB in the worker; bundled and learned descriptors join as extra rows
- **Sure**: A pick needs `HERO_SCORE_FLOOR` and a lead of `HERO_SURE_MARGIN` over the best candidate of any other hero, learned or bundled; `COSTUME_SURE_MARGIN` when its window came from a costume reference

### Confidence

Derived once by `cellState` and `reviewStates` (`lib/teams/teamImport.ts`) so the review grid and each card's "N to review" count agree:

- **Sure**: The top candidate fills the board unless changed
- **Review** (amber): Recognised but under the margin, or a doubtful frame match (`paragonFromMatch`), which puts the whole cell in review because the face and star crops are cut from that box
- **None** (red): No candidate over the floor; contributes nothing until picked
- **Duplicate** (red): The same hero on two cells of one side after edits; blocks Save as New
- **Artifact chip**: Always reviewable; the in-game icon carries a gold ring the references lack, so margins are thin. Not counted in the card's review count

## Session and Review

### Composable (`/src/composables/useTeamImport.ts`)

Module-level state, so the modal can close and reopen without losing the shots; Save as New clears them once the plan is handed up, and `TeamsView` calls `disposeTeamImport` on leave:

- **Reading plus overrides**: An `ImportShot` keeps the reading as read and every review decision beside it (`overrides`, `artifactOverrides`, `resultOverrides`); a card's map and winner derive from both (`shotMapIndex`, `shotWinner`), so a mode switch re-derives every card without rereading
- **Board sides**: `swapSides` puts every screenshot's Ally column on the enemy side of its board and the Enemy column on the ally side, since the game's Ally tab is the viewing player, whichever side of the board they fought from. One choice per match rather than per screenshot: a player keeps one side for every map, and the boards hold a hero once per side page-wide. A placement choice rather than a reader correction, so it stays out of the export and resets with the shots; while it is on, each review head says which board side its column fills
- **Worker**: One per page visit (`teamImport.worker.ts`). References (bundled portraits, the chaldea frames and costumes, artifact icons) are fetched on first open and posted once; shots dropped meanwhile queue until `ready`, and a failed worker or reference load is retried on the next open
- **Learning**: A correction teaches the face only when the hero was unsure and the frame match trustworthy, so a misplaced crop is never stored as an example; picking the reader's own top candidate, or no hero, retracts the lesson. Lessons persist in `stargazer.import.learned` (`LEARNED_ICONS_CAP` 100, oldest out) and the worker rebuilds its table on every change

### Plan, Apply and Save

- **Plan** (`lib/teams/teamImport.ts`): Pure data mapping, a sibling of `sideLoad.ts`: readings plus overrides, on the swapped sides when chosen, to per-board rosters, `issues` (named by board side) and the record name (`S7 - GNX > 10 (1,3,4,5 > 2)`: left player, `>` when they won more maps, each player's map numbers, unmoved by the swap). `isBlockingIssue` separates what would put a wrong roster on a board from what merely leaves something out
- **Apply and save**: Owned by the Teams page (`grids.applyRosters`, its read-only mirrors `rostersWouldReplace` and `rosterConflicts`, and `TeamsView.handleImportMatch`); see [TEAMS.md](./TEAMS.md), Team Import. Apply and save are not one transaction: a full library leaves the boards as an unsaved team carrying the name, and skipped placements are reported rather than claimed

## Reference Descriptors

Three sources of hero evidence feed one table, assembled by `buildImportHeroTable` in `references.ts` for the worker and the checker alike; the readers' geometry, ranking and confidence rules do not depend on which source a row came from:

- **Portraits and costumes**: General coverage, cut into descriptors when the worker builds its table
- **Bundled descriptors** ([`hero-icons.json`](../../src/data/import/hero-icons.json)): Approved face examples for cards the portraits cannot match, loaded with the app as ordinary versioned data
- **Browser learning**: Examples from eligible corrections, private to that browser

```json
{
  "v": 1,
  "spec": { "descriptor": [32, 24], "box": [0.23, 0.2, 0.69] },
  "icons": [
    { "characterId": 104, "descriptor": "<Int8 × 2304, base64>", "learnedAt": 1757800000000 }
  ]
}
```

- **Envelope**: The same shape for the bundled file, browser storage and the corrections export, validated by `readLearnedIcons`. `spec` pins the descriptor size and face box, so a crop change discards stale data; a normalisation or quantisation change bumps `v`. The reference-file test rejects unknown ids, invalid envelopes and duplicate descriptors
- **Precedence**: Each descriptor appears once; a local correction for identical descriptor bytes wins over the bundled label, and forgetting local learning restores it. Different crops of one hero stay separate examples; nothing is averaged or voted
- **Boundary**: The app, build and tests consume the bundled file directly; producing its values needs no runtime integration, and no client correction ever edits it. Screenshot SHA-256 values identify source files for review, never faces

### Export Contract

`exportCorrections` produces `stargazer-import-corrections` version 2:

```typescript
{
  format: 'stargazer-import-corrections', version: 2, createdAt,
  learnedIcons, // the envelope above: this browser's learning, without image provenance
  shots: [{
    source: { name, size, sha256 },
    context: { season, mapCount, imageWidth },
    predicted: ScreenshotReading, // card pixels and descriptor buffers omitted
    labels: { cells, artifacts, mapIndex?, winner? }, // sparse explicit edits
  }],
}
```

- **Absent versus null**: A missing label is unreviewed; `null` is an explicit removal
- **Provenance**: Learned descriptors carry no source image, so verifying or regenerating an example needs the original screenshots, which the download does not contain
- **Handoff only**: A user-controlled download, never an upload or a change to shared defaults

## References and Scripts

- **chaldea `dist/img/import/`**: The references the app fetches from chaldea.tmdict.com (`importReferenceUrl`): `frame-p0` … `frame-p4-crown` (the paragon frames), `star-r*` (star rows, reference material only), `skins.json` (`{ "<hero slug>": ["<file>", …] }`) and `skin/<hero slug>-<name>` costume captures; a missing manifest means no costumes
- **Artifacts**: The bundled permanent icons plus the seasonal set on chaldea (`seasonArtifactImageUrl`), capped at 128 px before the table is built
- **Checker**: The only regression check on real images, and the first thing to run when the game changes its result screen. `scripts/lib/importTooling.ts` decodes references the way the app does (EXIF applied, portraits re-encoded as the shipped WebP, icons capped at 128 px) from chaldea.tmdict.com, or from a local copy of the published `img/` tree with `--references`

```sh
npm run check:import -- --samples <dir> [--truth <json>] [--references <dir>] [--maps 5]
```

```json
{
  "match-1.png": {
    "maps": 5,
    "cells": {
      "a1": { "hero": "gunnar", "p": 4, "r": 4 },
      "e1": { "hero": "phraesto", "p": 2, "r": 0 }
    },
    "artifacts": { "a": "<artifact slug>", "e": null }
  }
}
```

- **Truth**: `truth.json` beside the samples by default; cells `a1`–`a5` and `e1`–`e5` score hero, paragon and refinement independently (a confidently wrong hero counts as wrong), `artifacts` is optional and scored only where labelled, and a strip count that disagrees with `maps` is flagged
- **Truth versus references**: Truth data measures the reader; reference data changes it. Fixing a wrong expected label changes the evaluation, not the matcher; a descriptor update is judged by which cells it fixes and which it newly breaks, never by its aggregate score alone

## Related Documentation

- [`/docs/architecture/TEAMS.md`](./TEAMS.md) - The Teams page the import lands on: apply, save, boards, saved-team library
- [`/docs/architecture/GRID.md`](./GRID.md) - The on-grid pickers whose palettes the review reuses, page-wide uniqueness
- [`/docs/architecture/SEASONAL.md`](./SEASONAL.md) - Seasonal artifact icons and their remote hosting
