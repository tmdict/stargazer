# Team Import

## Overview

The team import reads the game's match result screenshots on the device and saves what they show as a new team: both rosters with each hero's paragon and refinement, both artifacts, and the record name in the export convention. Recognition is pure TypeScript over RGBA buffers (`/src/lib/import/`) run in a web worker, and every reading passes through a review grid before anything reaches a board.

## Design Principles

1. **On-device, pure readers**: Screenshots are decoded to pixels on the main thread and read in a worker by canvas-free code that a Node script drives the same way
2. **Landmarks before templates**: The Ally and Enemy tabs place the card columns; template matching only settles exact positions and identities
3. **Geometry in one place**: `layout.ts` holds the result screen's nominal positions, sizes and their per-shot ranges; each reader owns its template searches and score floors
4. **Nothing silent**: Every cell carries a confidence, unsure cells are amber, unreadable ones red and empty, and the plan lists every issue before Save as New
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

## Core Components

### Readers (`/src/lib/import/`)

Pure, DOM-free code over `RgbaImage` (the shape of a canvas `ImageData`), shared by the worker and the check script:

- **`types.ts`**: `RgbaImage`, `ScreenshotReading`, `HeroReading` and the reference tables
- **`layout.ts`**: Geometry only, in the pixels of a shot normalised to `CANONICAL_WIDTH` (1150): card column and pitch, panel gap and their per-shot ranges, the face box inside a frame, header icons, tabs, summary bar, strip
- **`image.ts`**: Crop-and-resize with box sampling, flattening onto a colour, HSV, per-channel normalised vectors, alpha-masked normalised cross-correlation
- **`frames.ts`**: Frame references at three scales, the column anchor, the whole-height pair scan, the per-card match, the paragon reading, and their search ranges and floors
- **`heroes.ts`**: The descriptor table, ranking, per-side uniqueness
- **`stars.ts`**, **`strip.ts`**, **`artifacts.ts`**: The star row, the tabs and map strip, the header artifact icons
- **`learned.ts`**: The versioned descriptor format for browser learning, exports and curated references
- **`references.ts`**: Combines curated hero descriptors and browser learning with portrait references; shared by the worker and checker
- **`pipeline.ts`**: `readScreenshot`, one shot to one reading

```typescript
interface ScreenshotReading {
  mapIndex: number | null // 0-based, from the strip's green ring
  mapCount: number | null // the strip's circle count; null without a strip
  winner: Team | null // the Ally tab's colour
  mapResults: (Team | null)[] // per strip circle, the left player's result
  sides: Record<Team, HeroReading[]> // five cells each, top to bottom
  artifacts: Record<Team, ArtifactReading | null>
  warnings: ImportWarning[] // no-panel | no-strip | unrecognised
}
```

- **`HeroReading`**: `HeroIdentity` (candidates, recognised, margin, sure) plus the matched frame `box`, a `card` crop for the review, the face `descriptor` (kept so a correction can be learned), `paragon` (level, score, runner-up, sure) and `refinement` (level, stars, family)
- **Sides**: The top panel is the viewer's team, taken to be the left player's, as in the game's own history view; the header's two halves show the series result, not the map's, and are not read
- **Mode-independent**: The strip is always read, and which board a shot fills is settled at review time against the current mode

### Pipeline (`/src/lib/import/pipeline.ts`)

`readScreenshot(shot, refs)` in order:

1. **Normalise** (in the composable): files under 600 px wide are rejected; the bitmap is drawn at 1150 px wide with its EXIF orientation applied. The full screen width is the one invariant, since the game lays the panel out from it; a crop may lose height at either end
2. **Place the columns** (`placeColumns`): `findTabs` finds the two tab blocks (x 10–180 at least 60% orange or blue, x 180–420 at most 25%, 40–100 px tall, the enemy's 400–1100 px below the ally's); each column's first card is seeded 8 px under its tab and settled by `findPanelAnchor`, the five-row comb of the 18 frame templates over y −60..40 and x −16..16 at step 4 (x −16..40 for the ally column, since a taller phone sets it further in; the enemy starts from the ally's x), then a pitch step of ±2 when it gains 0.01
3. **Without tabs**: the crop positions (`CARD_TOP` 237, `PANEL_GAP` 710) are tried; if either comb is under `ANCHOR_FLOOR` (0.35), `scanForColumns` profiles the whole height at one scale, scores combs of every pitch 95–104, pairs them a gap 620–900 apart, and takes the best pair with a solid summary bar under each fifth card (a tab matches a frame about as well as a card, so a comb one row too high scores like the real one). A column placed by a landmark is trusted down to `LANDMARK_FLOOR` (0.27), since a capture taken mid-fade scores its frames low
4. **Read each side** (`readSide`): `matchCard` searches ±6 rows and ±4 columns around the anchor row across all templates; the best frame is the paragon level and the card's exact box, the per-level bests give the runner-up. The face box (`ART_BOX`: 23% in, 20% down, 69% wide, 36:48) is described at nine small alignments and ranked by `rankHeroes`; `readStars` counts and colours the star row. A column under its floor gets empty rankings and a `no-panel` warning, so the picker offers blank cells rather than a stranger's face
5. **Settle each side** (`assignUnique`): cells settle in order of their lead and a hero already taken goes to the next candidate; a cell with no candidate over the floor is `unrecognised`
6. **Strip** (`readStrip`): the ring band of five nominal circles (pitch 0.0887 W about 0.49 W) is scored for green over the four pitches below the enemy panel, ±20 px sideways and at three radii; the best ring places the strip, and its position or the cream of the outer discs says three or five circles (`mapCount`). The badge under each circle is the left player's result on that map. No ring raises `no-strip`, which a one-map result also has
7. **Artifacts and winner**: `readArtifact` correlates the round header icons (masked to the disc, the badge corner excluded) over a 9×5 offset and 4 diameter search against every icon at four insets; the winner is the Ally tab's colour, or `readTab` above the anchor when no tabs were found

### Hero Identity (`/src/lib/import/heroes.ts`)

The in-game card is a head crop of the same painting the app bundles, at a zoom that varies slightly per hero:

- **Descriptor**: A 32×24 RGB crop, each channel zero-mean and unit-norm, so a dot product is the mean of the three per-channel correlations (the frame's warm tint cancels); stored Int8 at ×400
- **Table**: Each bundled portrait (`loadMatcherPortraits`, 180 px WebP, fetched on first open) is flattened onto the card's cream and halved to 90×124, then cut over the art grid (4 widths × 3 centres × 5 tops); a costume reference is kept at full size and cut over the art grid plus a smaller, higher card grid, since the game's skin card frames the face differently. About 8,600 rows for 125 heroes and 11 costumes, near 20 MB in the worker; learned icons join as extra rows
- **Ranking**: The centre alignment against every row keeps the best per hero, the top 60 are re-scored at the other eight alignments, the top 15 are refined over a 5×5×5 window grid around their winning window, and the top 5 are the candidates
- **Sure**: A pick needs a score of 0.35 and a margin of 0.10 over the best candidate of any other hero, learned or bundled, 0.15 when its window came from a costume reference

### Confidence

What the review grid shows per cell:

- **Sure**: Plain; the top candidate fills the board unless changed
- **Review** (amber): Recognised but under the margin; the reader's candidates are pinned first in the picker
- **None** (red): No candidate over the floor; contributes nothing until picked
- **Edited**: The hero was changed in review (derived from the override, never stored)
- **Paragon**: Amber when the frame score is under 0.5, or under 0.65 with the runner-up level within 0.05; a doubtful frame puts the whole cell in review, since the box (and so the face and star row) may be off
- **Picked twice** (red): The same hero on two cells of one side after edits; blocks Save as New
- **Artifact chip**: Amber under a margin of 0.1 and labelled for review; the in-game icon carries a gold ring the references lack, so margins are thin. Not counted in the card's "N to review", which covers hero cells only
- **One derivation**: `cellState` and `reviewStates` in `lib/teams/teamImport.ts` drive both the grid and the card's count, so an edit settles its cell in both

### Worker (`/src/workers/teamImport.worker.ts`)

Holds the reference tables and reads shots:

```typescript
type TeamImportRequest =
  | ({ type: 'references' } & ReferenceImages) // frames, portraits, artifacts, learned
  | { type: 'learned'; learned: LearnedIcon[] }
  | { type: 'read'; id: string; image: RgbaImage }

type TeamImportResponse =
  | { type: 'ready' }
  | { type: 'reading'; id: string; reading: ScreenshotReading }
  | { type: 'error'; id: string | null; message: string }
```

- **Transfer**: Pixel buffers cross as transferables both ways
- **Errors**: A `null` id means the tables failed to build and fails the references; a read that throws fails only its shot
- **Learned before ready**: A `learned` message before the tables exist is dropped, since the pending references post carries the current list

### Composable (`/src/composables/useTeamImport.ts`)

Module-level state, so the modal can close and reopen without losing the shots; Save as New clears them once the plan is handed up, and `TeamsView` disposes it on leave:

```typescript
interface ImportShot {
  id: string
  thumb: string // object URL for the card thumbnail
  status: 'reading' | 'ready' | 'failed'
  error: ShotError | null // too-small | unsupported | references | worker | read
  reading: ScreenshotReading | null
  overrides: Record<string, CellOverride> // keyed `${team}:${row}`
  artifactOverrides: Partial<Record<Team, number | null>>
  resultOverrides: { mapIndex?: number | null; winner?: Team | null } // chosen in review
  cards: Record<string, string> // card crops as data URLs
}
```

Key features:

- **Reading plus overrides**: The reading is what the screenshot says and never changes; every review decision is an override beside it, so a choice made while the shot was still reading stands
- **Derived map and winner**: `shotMapIndex(shot, boardCount)` is the chosen map, else the strip's map when the current mode has that many boards, else the sole board of a one-board mode; `shotWinner` is the chosen winner, else the tab's. A mode switch re-derives every card, and the card's "wrong map count" status reads `reading.mapCount` live
- **References**: Loaded on first open and posted once; shots dropped meanwhile queue in `pending` and are read on `ready`. A worker that fails to start is dropped, and a shot that failed for want of references keeps its pixels queued, so the next open retries both. One artifact icon failing to load is skipped, like a costume
- **Sessions**: Leaving the page bumps a session counter; a decode or reference fetch still in flight from the previous visit checks it before touching state
- **Learned icons**: Correcting a cell the reader was unsure about, when the frame match was trustworthy and the pick was not already its top candidate, stores the face descriptor under the picked hero in `stargazer.import.learned` (a versioned envelope with the descriptor size and face box written in, so a crop change discards the store; capped at 100, oldest out) and the worker rebuilds its table. Correcting the same cell again replaces that lesson; picking the reader's own top candidate or no hero takes it back. "Forget learned icons" clears the store
- **Names**: The record prefix and the two player names persist in `stargazer.import.names`

### Plan (`/src/lib/teams/teamImport.ts`)

Pure data mapping, a sibling of `sideLoad.ts`: readings plus review decisions to per-board rosters (`boards`, null where a board stays untouched), `issues` and the `suggestedName`:

```typescript
type PlanIssue =
  | { kind: 'duplicate-map'; mapIndex: number }
  | { kind: 'unmapped'; count: number } // no map, or one beyond the mode's boards
  | { kind: 'empty'; count: number } // mapped, but no hero on either side
  | { kind: 'duplicate-hero'; team: Team; characterId: number; mapIndex: number }
  | { kind: 'cross-board-duplicate'; team: Team; characterId: number; maps: number[] }
  | { kind: 'cross-board-artifact'; team: Team; artifactId: number; maps: number[] }
  | { kind: 'result-undecided' } // map wins equal or unread
  | { kind: 'retained-hero'; team: Team; characterId: number; mapIndex: number } // store-found
  | { kind: 'retained-artifact'; team: Team; artifactId: number; mapIndex: number }
```

- **Cells**: `cellCharacterId` and `cellArtifactId` apply an override (null = removed) over the top candidate; the same hero on two cells can only come from edits, so the first cell keeps it and `duplicate-hero` blocks
- **Blocking**: `isBlockingIssue` marks what would put a wrong roster on a board (a map claimed twice, a hero picked twice, the same hero or artifact on the same side of two maps); the others only leave something out and say so
- **Record name**: `suggestRecordName` builds `S7 - GNX > 10 (1,3,4,5 > 2)`: prefix, left player, `>` when they won more maps, each side's map numbers in the brackets (dropped for a one-map mode); names may contain spaces but never `<>()`
- **Map winners**: Each mapped screenshot's own winner, else the majority of the strip badges (`mapResultsFrom`); equal or unread wins keep the typed order and raise `result-undecided`

### Apply and Save

- **`grids.applyRosters(plan)`**: Clears both sides of every mapped board first (so a hero moving between boards never trips page-wide uniqueness against its own old copy), re-seeds each board's phantimal baseline (the `swapBoards` idiom), then auto-places each hero with its attribute record and sets the artifacts, skipping and counting anything page-wide uniqueness already claims; maps and display flags are untouched
- **Read-only mirrors**: `rostersWouldReplace` backs the two-step confirm; `rosterConflicts` lists the heroes and artifacts already on the same side of a board the plan leaves untouched, shown as `retained-*` issues before anything is cleared
- **`TeamsView.handleImportMatch`**: Applies the plan, waits a tick for the phantimals, saves the boards as a new library record under the record name and loads it as their source; a full library leaves an unsaved team carrying the name (`pendingName`). Anything skipped is reported in a second toast

### UI (`/src/components/modals/TeamImportModal.vue`, `/src/components/teams/TeamImport*.vue`)

- **Modal**: Sets the `--import-*` palette on its root for the dark glass; renders the drop zone, the cards, the name fields and record name, the review of the selected card, the issues (the plan's plus the store's retained-board conflicts), and Save as New with an armed confirm when a target board has content. Save as New is disabled while a card is still reading, or while the record name would exceed `MAX_TEAM_NAME_LENGTH`
- **Shot list**: A card per screenshot on the review grid's five columns, with a thumbnail (`ImageLightbox` on click), Map and Winner segmented controls, and one status by priority: reading, failed, cards not recognised, wrong map count, choose a map, N to review, ready. The card selects on click; its name is a pressed-state button and the keyboard handle, so the nested buttons keep their own activation
- **Review grid**: Both sides, five cells each, with the card as located, the matched portrait, the editable paragon and refinement pill (`UpgradePill`), and the cell's state. The name opens `CharacterSelectionPalette` and the artifact chip `ArtifactSelectionPalette` in a `SelectionPopup` layered over the modal; the popup stops clicks and Escape, one picker is open at a time, the grid is keyed by shot, and a tap elsewhere on the grid closes the picker
- **Button**: `TeamImportButton`, icon-only after the Load menu, mounts the modal on first use and keeps it. The modal and the worker are their own chunks; the Teams chunk carries the composable (for `disposeTeamImport`) and the readers it imports
- **Download corrections**: A footer link exports loaded screenshot edits and saved browser learning for calibration; screenshot labels live only while their cards do

## Calibration Boundary

Routine hero calibration changes reference data in [`/src/data/import/hero-icons.json`](../../src/data/import/hero-icons.json). `buildImportHeroTable` in `references.ts` is the entry point for both the worker and `check:import`; it combines portrait images, approved descriptors and browser learning without changing ranking or confidence rules. The curated file is empty until reviewed examples are promoted.

| Layer                                               | Owns                                                         | Changes during routine calibration                |
| --------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------- |
| Capture and export (`useTeamImport`)                | Explicit edits, diagnostics, browser learning                | None                                              |
| Private calibration workspace                       | Screenshots, labels, crop review, experiments and evaluation | Review and evaluate new examples outside the repo |
| Curated references (`hero-icons.json`)              | Approved hero descriptors                                    | Add, replace or remove reviewed examples          |
| Reference assembly (`references.ts`)                | Compatible examples for known heroes, exact deduplication    | None                                              |
| Readers (`layout`, `frames`, `heroes`, `artifacts`) | Crop geometry, descriptors, scoring and confidence           | Separate algorithm work when evidence requires it |

### Export and Descriptor Contract

- **Correction export**: `format: "stargazer-import-corrections"`, `version: 2`, `createdAt`, `shots` and `learnedIcons`; `shots` is an array of `{ source, context, predicted, labels }` records (the file's name, size and SHA-256; the season, board count and image width the labels were made under; the original reading; the explicit edits). A missing label means unreviewed, `null` an explicit removal; image buffers and per-shot descriptors are excluded
- **Saved learning**: `learnedIcons` is a snapshot of the browser's saved hero descriptors, downloadable with no screenshots loaded; it has no source-image provenance and no artifact learning, so original screenshots are kept for crop review
- **Descriptor data**: A 32×24 RGB face crop becomes 2,304 normalised values, quantised to Int8 at ×400 and base64 encoded; SHA-256 only identifies source files
- **Shared envelope**: Browser storage, `learnedIcons` and `hero-icons.json` use `{ v: 1, spec: { descriptor: [32, 24], box: [0.23, 0.2, 0.69] }, icons: [{ characterId, descriptor, learnedAt }] }`; `learned.ts` validates the version, geometry and encoded length. Bump `v` when normalisation or quantisation changes; other face-crop changes regenerate descriptors from source images
- **Reference lifetime**: Curated defaults ship with the app; browser learning is capped at 100 entries and stays separate, so forgetting it preserves the defaults. Exact duplicates for the same hero are included once; promoted examples use the learned-match confidence rules. Downloads are review input, never promoted or uploaded automatically

### Promoting a Calibration Round

1. Download corrections and retain their original screenshots; verify hashes before associating labels with pixels
2. Outside the repository, confirm hero labels and crop quality, then select or regenerate descriptors with `heroes.ts` and the current envelope; a wrong crop needs localization work, not a new portrait
3. Evaluate candidate references on labelled screenshots reserved from training, checking per-hero errors and confidently wrong readings as well as totals
4. Promote approved entries to `hero-icons.json`, run `check:import` against the private regression set plus lint, type-check and tests, then deploy; a routine hero reference update needs no reader, UI or export change

Artifacts use reference images from the app and Chaldea, not the hero descriptor file; in-game artifact examples or badge localization would be a separate reader change with its own evaluation.

## References and Scripts

- **chaldea `img/import/`**: Each reference as a PNG (the source of truth, never fetched) beside the WebP the app fetches: `frame-p0` … `frame-p4-crown` (the paragon frames), `star-r*` (the star rows, reference material only), `skins.json` (`{ "<hero slug>": ["<file>", …] }`) and `skin/<hero slug>-<name>` for costume captures. Fetched through `importReferenceUrl` and `importSkinsManifestUrl`; a missing manifest means no costumes
- **Artifacts**: The bundled permanent icons plus the seasonal set already on chaldea (`seasonArtifactImageUrl`), resized to 128 px before the table is built
- **`npm run import:refs -- --chaldea <checkout>`**: Rewrites every WebP from its PNG and regenerates `skins.json` from the skin folder (left as is when the folder is absent). Adding a costume is: drop the PNG, run it, commit chaldea
- **`npm run check:import -- --samples <dir> --frames <checkout>/img/import [--artifacts <checkout>/img/seasonal/artifact] [--maps 5] [--truth <json>]`**: Runs the readers over a folder of screenshots and prints every reading, scored against a truth file when given (`{ "<file>": { "maps": 3, "cells": { "a1": { "hero": "gunnar", "p": 4, "r": 4 }, … } } }`) and flagging a strip count that disagrees with the expected maps. The only regression check on real images, and the first thing to run when the game changes its result screen. On the maintainer's sample set (15 screenshots, 110 graded hero cells) it reads 103 of the 110 heroes (every sure cell right), 108 paragon and 104 refinement levels

## Testing

Unit tests (`/tests/unit/lib/import/`, `/tests/unit/lib/teams/teamImport.test.ts`, `/tests/unit/composables/useTeamImportCorrections.test.ts`) run the readers on synthetic pixels, the plan on hand-built readings, and the composable's edits, learning and export on a hand-built shot; no image fixtures by decision. The check script is the image regression, driven over a private sample folder.

## Performance Considerations

- **Worker**: Every read runs off the main thread; pixel buffers cross as transferables, and the card crops come back as transferables too
- **Coarse then refine**: Ranking scores the whole table once at the centre alignment and spends the alignments and the finer window grid on the leaders only, which keeps a screenshot to about a second
- **Int8 table**: Descriptors are quantised at ×400, keeping about 8,600 rows near 20 MB and the dot products integer-friendly
- **Sampled correlation**: The frame match samples every second pixel of the template's opaque area; the whole-height scan profiles one scale at a 4 px step and lets combs and pairs be sums over that profile
- **Lazy references**: Portraits, frames, costumes and artifact icons are fetched on the first open, once per page visit

## Related Documentation

- [`/docs/architecture/TEAMS.md`](./TEAMS.md) - The Teams page the import lands on: boards, saved-team library, side loading
- [`/docs/architecture/GRID.md`](./GRID.md) - The on-grid pickers whose palettes the review reuses, page-wide uniqueness
- [`/docs/architecture/SEASONAL.md`](./SEASONAL.md) - Seasonal artifact icons and their remote hosting
