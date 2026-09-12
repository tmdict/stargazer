# Team Import

## Overview

The team import reads the game's match result screenshots on the device and saves what they show as a new team: both rosters with each hero's paragon and refinement, both artifacts, and the record name in the export convention. Recognition is pure TypeScript over RGBA buffers (`/src/lib/import/`) run in a web worker, and every reading passes through a review grid before anything reaches a board.

## Design Principles

1. **On-device, pure readers**: Screenshots are decoded to pixels on the main thread and read in a worker by canvas-free code that a Node script drives the same way
2. **Landmarks before templates**: The Ally and Enemy tabs place the card columns; template matching only settles exact positions and identities
3. **Geometry in one place**: `layout.ts` holds the result screen's nominal positions; each reader owns its own search ranges and score floors
4. **Nothing silent**: Every cell carries a confidence, unsure cells are amber, unreadable ones red and empty, and the plan lists every issue before Save as New
5. **Pure plan, engine apply**: Readings plus review edits become a `TeamImportPlan` with no store access; the grids store stamps it with its own primitives

## Architecture

```
┌─ components ─────────────┐        ┌─ TeamsView ───────────────┐
│ TeamImportButton         │  plan  │ handleImportMatch         │
│  └ TeamImportModal       │───────▶│  grids.applyRosters       │
│     ImageDropZone        │        │  teamLibrary.saveAsNew    │
│     TeamImportShotList   │        └───────────────────────────┘
│     TeamImportReview     │
└────────────┬─────────────┘
             │ useTeamImport (module state)
             ▼
┌─ composables/useTeamImport.ts ─┐  read   ┌─ workers/teamImport.worker ─┐
│ decode to 1150 px RgbaImage    │────────▶│ readScreenshot(shot, refs)  │
│ references from app + chaldea  │◀────────│ lib/import (pure TS):       │
│ overrides, learned icons       │ reading │ layout frames heroes stars  │
└────────────┬───────────────────┘         │ strip artifacts pipeline    │
             ▼                             └─────────────────────────────┘
┌─ lib/teams/teamImport.ts ──────┐
│ buildTeamImportPlan            │
│ boards · issues · record name  │
└────────────────────────────────┘
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
- **`learned.ts`**: The envelope for icons learned from corrections
- **`pipeline.ts`**: `readScreenshot`, one shot to one reading

```typescript
interface ScreenshotReading {
  mapIndex: number | null // 0-based, from the strip's green ring
  winner: Team | null // the Ally tab's colour
  mapResults: (Team | null)[] // per strip circle, the left player's result
  sides: Record<Team, HeroReading[]> // five cells each, top to bottom
  artifacts: Record<Team, ArtifactReading | null>
  warnings: ImportWarning[] // no-panel | no-strip | map-count | unrecognised
}

interface HeroReading extends HeroIdentity {
  // candidates, recognised, margin, sure
  box: Rect // the matched frame
  card: RgbaImage // crop for the review grid
  descriptor: Float32Array // kept so a correction can be learned
  paragon: ParagonReading // level, score, runnerUp, sure
  refinement: RefinementReading // level, stars, family
}
```

The top panel is the viewer's team, taken to be the left player's, as in the game's own history view. The header's two halves show the series result, not the map's, and are not read.

### Pipeline (`/src/lib/import/pipeline.ts`)

`readScreenshot(shot, refs, mapCount)` in order:

1. **Normalise** (in the composable): files under 600 px wide are rejected; the bitmap is drawn at 1150 px wide with its EXIF orientation applied. The one invariant is the full screen width, since the game lays the panel out from it; a crop may lose height at either end and a raw capture qualifies.
2. **Place the columns** (`placeColumns`): `findTabs` scans rows for the two tab blocks (x 10–180 at least 60% orange or blue, x 180–420 at most 25%, a run 40–100 px tall, the enemy's 400–1100 px below the ally's). Each column's first card is seeded 8 px under its tab and settled by `findPanelAnchor`: the five-row comb (best of the 18 frame templates per row, averaged over the rows) over y −60..40 and x −16..16 at step 4 (x −16..40 under a tab, since a taller phone puts the column further from the panel's edge), then a pitch step of ±2 when it gains 0.01. Without tabs the crop positions (`CARD_TOP` 237, `PANEL_GAP` 710) are tried; if either comb is under `ANCHOR_FLOOR` (0.35), `scanForColumns` profiles the whole height at one scale, scores combs of every pitch 95–104 and pairs them a panel gap 620–900 apart, and takes the best pair with a solid summary bar under each fifth card (the tab above a column matches a frame about as well as a card, so a comb one row too high scores like the real one). A column placed by a landmark is trusted down to `LANDMARK_FLOOR` (0.27), since its position is settled by structure and a capture taken while the panel was still fading in scores its frames low.
3. **Read each side** (`readSide`): `matchCard` searches every offset within ±6 rows and ±4 columns of the anchor row across all templates; the best frame is the paragon level and the card's exact box, and the per-level bests give the runner-up. The face box (`ART_BOX`: 23% in, 20% down, 69% wide, 36:48, the badges and the frame's swirl cover the rest) is described at nine small alignments and ranked by `rankHeroes`; `readStars` counts and colours the star row. A column under its floor is built with empty rankings and a `no-panel` warning, so the picker offers its cells blank rather than with a stranger's face.
4. **Settle each side** (`assignUnique`): a side fields five different heroes, so cells are settled in order of their lead and a hero already taken goes to the next candidate; a cell with no candidate over the floor is `unrecognised`.
5. **Strip** (`readStrip`, skipped when the mode has one board): the ring band of each of five nominal circles (pitch 0.0887 W about 0.49 W) is scored for green over the four pitches below the enemy panel, ±20 px sideways and at three radii; the best ring places the strip, and its position or the cream of the outer discs says whether there are three or five circles. The tick or cross under each circle is the left player's result on that map. No ring raises `no-strip`; a count other than the mode's raises `map-count`.
6. **Artifacts and winner**: `readArtifact` correlates the round header icons (masked to the disc, the badge corner excluded) over a 9×5 offset and 4 diameter search against every icon at four insets; the winner is the Ally tab's colour, or `readTab` on the region above the anchor when no tabs were found.

### Hero Identity (`/src/lib/import/heroes.ts`)

The in-game card is a head crop of the same painting the app bundles, at a zoom that varies slightly per hero:

- **Descriptor**: A 32×24 RGB crop, each channel zero-mean and unit-norm, so a dot product is the mean of the three per-channel correlations (the frame's warm tint cancels); stored Int8 at ×400
- **Table**: Each bundled portrait (`loadMatcherPortraits`, 180 px WebP, fetched on first open) is flattened onto the card's cream and halved to 90×124, then cut over the art grid (4 widths × 3 centres × 5 tops); a costume reference is kept at full size and cut over the art grid plus a smaller, higher card grid, since the game's skin card frames the face differently. About 8,600 rows for 125 heroes and 11 costumes, near 20 MB in the worker; learned icons join as extra rows
- **Ranking**: The centre alignment against every row keeps the best per hero, the top 60 are re-scored at the other eight alignments, the top 15 are refined over a 5×5×5 window grid around their winning window against the stored portrait, and the top 5 are the candidates
- **Sure**: A pick needs a score of 0.35 and a margin of 0.10 over the next hero, 0.15 when its window came from a costume reference; a learned match must also lead the best bundled candidate of another hero

### Confidence

What the review grid shows per cell:

- **Sure**: Plain; the top candidate fills the board unless changed
- **Review** (amber): Recognised but under the margin; the reader's candidates are pinned first in the picker
- **None** (red): No candidate over the floor; contributes nothing until picked
- **Edited**: The hero was changed in review (derived from the override, never stored)
- **Paragon**: Amber when the frame score is under 0.5, or under 0.65 with the runner-up level within 0.05
- **Artifact chip**: Amber under a margin of 0.1; the in-game icon carries a gold ring the references lack, so margins are thin and every reading is offered for review

### Worker (`/src/workers/teamImport.worker.ts`)

Holds the reference tables and reads shots:

```typescript
type TeamImportRequest =
  | ({ type: 'references' } & ReferenceImages) // frames, portraits, artifacts, learned
  | { type: 'learned'; learned: LearnedIcon[] }
  | { type: 'read'; id: string; image: RgbaImage; mapCount: number }

type TeamImportResponse =
  | { type: 'ready' }
  | { type: 'reading'; id: string; mapCount: number; reading: ScreenshotReading }
  | { type: 'error'; id: string | null; message: string }
```

Pixel buffers are transferred both ways. An error with a `null` id means the tables failed to build and fails the references; a read that throws fails only its shot.

### Composable (`/src/composables/useTeamImport.ts`)

Module-level state, so the modal can close and reopen without losing the shots; `TeamsView` disposes it on leave:

```typescript
interface ImportShot {
  id: string
  thumb: string // object URL for the card thumbnail
  status: 'reading' | 'ready' | 'failed'
  error: ShotError | null // too-small | unsupported | references | worker | read
  reading: ScreenshotReading | null
  mapIndex: number | null // from the strip, editable
  winner: Team | null // from the Ally tab, editable
  overrides: Record<string, CellOverride> // keyed `${team}:${row}`
  artifactOverrides: Partial<Record<Team, number | null>>
  cards: Record<string, string> // card crops as data URLs
}
```

Key features:

- **References**: Loaded on first open and posted once; shots dropped meanwhile queue in `pending` and are read on `ready`. A worker that fails to start is dropped, so the next open retries with a fresh one
- **Map clamp**: A map beyond the mode's boards (a five-map result read in a three-map mode) stays unmapped and the card says why
- **Learned icons**: Correcting a cell the reader was unsure about, when the frame match was trustworthy and the pick was not already its top candidate, stores the face descriptor under the picked hero in `stargazer.import.learned` (`learned.ts`: a versioned envelope with the descriptor size and face box written in, so a crop change discards the store; capped at 100, oldest out) and the worker rebuilds its table. "Forget learned icons" clears it
- **Names**: The record prefix and the two player names persist in `stargazer.import.names`

### Plan (`/src/lib/teams/teamImport.ts`)

Pure data mapping, a sibling of `sideLoad.ts`: readings plus review decisions to per-board rosters and the record name:

```typescript
type PlanIssue =
  | { kind: 'duplicate-map'; mapIndex: number }
  | { kind: 'unmapped'; count: number }
  | { kind: 'empty'; count: number } // mapped, but no hero on either side
  | { kind: 'cross-board-duplicate'; team: Team; characterId: number; maps: number[] }

interface TeamImportPlan {
  boards: (BoardRoster | null)[] // one per board; null leaves it untouched
  issues: PlanIssue[]
  suggestedName: string
}
```

Key features:

- **Cells**: `cellCharacterId` and `cellArtifactId` apply an override (null = removed) over the top candidate; a hero read twice on a side keeps its first cell
- **Blocking**: `isBlockingIssue` marks the two issues that would put a wrong roster on a board (a map claimed twice, the same hero on the same side of two maps, which the game never allows); unmapped and empty screenshots are simply left out
- **Record name**: `suggestRecordName` builds `S7 - GNX > 10 (1,3,4,5 > 2)`: prefix, left player, `>` when they won more maps, each side's map numbers in the brackets (dropped for a one-map mode). Names may contain spaces but never `<>()`. Map winners come from each mapped screenshot's own winner, else from the majority of the strip badges (`mapResultsFrom`)

### Apply and Save

- **`grids.applyRosters(plan)`**: Clears both sides of every mapped board first (so a hero moving between boards never trips page-wide uniqueness against its own old copy), re-seeds each board's phantimal baseline (the `swapBoards` idiom), then auto-places each hero with its attribute record and sets the artifacts, skipping anything page-wide uniqueness already claims; maps and display flags are untouched. `rostersWouldReplace` is its read-only mirror for the two-step confirm
- **`TeamsView.handleImportMatch`**: Applies the plan, waits a tick for the phantimals, saves the boards as a new library record under the record name and loads it as the boards' source. A full library leaves the boards as an unsaved team that still carries the name as its title and Save as New prefill

### UI (`/src/components/modals/TeamImportModal.vue`, `/src/components/teams/TeamImport*.vue`)

- **Modal**: Sets the `--import-*` palette (white at a few opacities, the game's orange and blue) on its root for the dark glass; renders the drop zone, the cards, the name fields and record name, the review of the selected card, the issues, and Save as New (armed confirm when a target board has content)
- **Shot list**: A card per screenshot with a thumbnail (`ImageLightbox` on click), Map and Winner segmented controls (the winner segments carry the typed player names), and one status by priority: reading, failed, cards not recognised, wrong map count, choose a map, N to review, ready
- **Review grid**: Both sides, five cells each, with the card as located, the matched portrait, the editable paragon and refinement pill, and the cell's state. The name opens `CharacterSelectionPalette` and the artifact chip `ArtifactSelectionPalette`, the on-grid popups' own palettes, in a `SelectionPopup` layered over the modal; the popup stops clicks and Escape so the modal's own close listeners never see them
- **Button**: `TeamImportButton`, icon-only in the control row after the Load menu; the modal is an async component so the Teams chunk stays small

## References and Scripts

- **chaldea `img/import/`**: Each reference as a PNG (the source of truth, never fetched) beside the WebP the app fetches: `frame-p0` … `frame-p4-crown` (the paragon frames), `star-r*` (the star rows, reference material only), `skins.json` (`{ "<hero slug>": ["<file>", …] }`) and `skin/<hero slug>-<name>` for costume captures. Fetched through `importReferenceUrl` and `importSkinsManifestUrl`; a missing manifest means no costumes
- **Artifacts**: The bundled permanent icons plus the seasonal set already on chaldea (`seasonArtifactImageUrl`), resized to 128 px before the table is built
- **`npm run import:refs -- --chaldea <checkout>`**: Rewrites every WebP from its PNG and regenerates `skins.json` from the skin folder. Adding a costume is: drop the PNG, run it, commit chaldea
- **`npm run check:import -- --samples <dir> --frames <checkout>/img/import [--artifacts <checkout>/img/seasonal/artifact] [--maps 5] [--truth <json>]`**: Runs the readers over a folder of screenshots and prints every reading, scored against a truth file when given (`{ "<file>": { "maps": 3, "cells": { "a1": { "hero": "gunnar", "p": 4, "r": 4 }, … } } }`). The only regression check on real images, and the first thing to run when the game changes its result screen. On the maintainer's graded set of 15 screenshots it reads 103 of 110 heroes (every sure cell right), 108 paragon and 104 refinement levels

## Testing

Unit tests (`/tests/unit/lib/import/`, `/tests/unit/lib/teams/teamImport.test.ts`) run the readers on synthetic pixels and the plan on hand-built readings; no image fixtures by decision. The check script is the image regression, driven over a private sample folder.

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
