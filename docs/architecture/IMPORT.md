# Screenshot Import

The screenshot imports read the game's own screens on the device and turn what they show into app data: the team import ([Team Import](./IMPORT_TEAM.md)) reads match result screens, formation panels and replay frames into a new team. Each import keeps its own plan and review. What lies under the screens is shared: the image code, the reading of hero cards, the worker that runs the readers, the references they match against and the faces learned from corrections.

Recognition is pure TypeScript over RGBA buffers (`src/lib/import/`). It runs unchanged in the worker, in unit tests and in offline checks against labelled screenshots kept outside this repo, so nothing under it touches the DOM.

## How it fits together

```
┌─ import modal ───────────┐            ┌─ import composable ──────┐
│ drop areas, review,      │───────────▶│ its shots and edits      │
│ save                     │files, edits│ its plan                 │
│                          │◀───────────│                          │
└──────────────────────────┘  readings  └────────────────────┬──▲──┘
                                                       files │  │ readings
                                                             ▼  │
┌─ import.worker ──────────┐            ┌─ useImportEngine ──┴──┴──┐
│ a reader per kind        │◀───────────│ decoding, read queue     │
│ hero and unit tables     │   images   │ references               │
│ artifacts, arena         │───────────▶│ learned faces            │
└──────────────────────────┘  readings  └──────────────────────────┘
```

## Layers

`src/lib/import/` is built in layers, and a layer imports only those below it, so a new screen is a reader on top of what the others share.

The pixel layer (`core/`) holds the RGBA and rectangle types and the image primitives: crop and resample, HSV, per-channel normalised descriptors and alpha-masked correlation.

The card layer (`card/`) reads a hero card wherever a screen shows one. The frame match names the paragon level and pins the card's box, the face inside it is ranked against the hero table, and the star row above the face gives the refinement. `readCards` reads each card on its own, then settles the cards shown together (`assignUnique`), since they show different heroes.

The screen layer (`screens/`) has one reader per screen, each finding the screen's own landmark before reading its cards: the result screen's tabs, the formation panel's board outline, the replay frame's arena. The match screens share their reading type, the green ring of their map strips and the artifact reader (`screens/match/`).

The review rules (`review.ts`) are what every import's review asks of a card: its state, and the hero and levels it contributes once corrected. On top sit the reference assembly, the learned-face store and the paste sorter.

## The engine

`useImportEngine` is module-level state for one page visit. Each import composable holds it while the component using it is mounted, and the last to let go disposes it: leaving a page unmounts its import modal, which drops the workers and their references. The pages themselves never import it, so its code loads with the modal on first use.

A screenshot is decoded on the main thread at its own size, within its kind's widths (a result screen or replay frame from 600 px wide up to `RESULT_MAX_WIDTH`, a formation panel from `FORMATION_MIN_WIDTH` up to `FORMATION_MAX_WIDTH`), and its pixels are handed to the worker. Decoded screenshots wait in the engine and go to the worker one at a time, so an import that closes drops the reads it still has waiting, and a reading that arrives for a removed shot is dropped. An import hands the engine its shots as a session: the engine moves each through reading, ready and failed, and gives the import each reading to keep.

The references are fetched on first use and posted to the worker once. A screenshot added while they load waits for them. When they fail, the waiting screenshots fail too but stay queued, and the next one added retries the load. A worker that fails to start fails the screenshots being read, and the next attempt starts a fresh one.

One worker script serves every kind of screenshot, with a reader for each. Two run per page visit: one reads, and the other holds only the arena and sorts pasted screenshots (`sortScreenshot`), so a paste is sorted at once while the first reads.

## Hero identity

A descriptor is a 32 × 24 RGB face crop with each channel normalised to zero mean and unit norm, which cancels the warm tint the frame casts. It is stored as Int8 at ×400 in the worker table and in every saved descriptor.

The table cuts every bundled portrait over a grid of crop windows, because the in-game card zooms the same painting differently per hero. A costume reference is captured from the game's skin card, where the face sits smaller, so it adds a second grid of smaller windows. Learned and bundled descriptors join as extra rows. Ranking scores the whole table at the centre offset, re-scores the leaders at the other offsets, and gives the top portrait candidates (`REFINE_KEEP`) a finer window search. Learned rows keep their scores and do not use up that budget.

A pick needs `HERO_SCORE_FLOOR` and a lead of `HERO_SURE_MARGIN` over the best candidate of any other hero, learned or bundled. The lead must reach `COSTUME_SURE_MARGIN` when the winning window came from a costume, since the looser costume framing fits strangers more easily.

## Reference descriptors

Three sources feed one hero table, assembled by `buildImportHeroTable` (`src/lib/import/references.ts`) for the worker and the offline checks alike. Portraits and costumes give general coverage. The bundled [`hero-icons.json`](../../src/data/import/hero-icons.json) holds approved face examples for cards the portraits cannot match, shipped with the app as ordinary data. Browser learning adds examples private to that browser. Geometry, ranking and confidence do not depend on which source a row came from.

The bundled file and browser storage (`stargazer.import.learned`) share one object, validated by `readLearnedIcons`:

```json
{
  "spec": {
    "descriptor": [32, 24],
    "box": [0.23, 0.2, 0.69]
  },
  "icons": [
    {
      "characterId": 104,
      "descriptor": "<base64 of 2304 bytes>",
      "learnedAt": 1789347604297
    }
  ]
}
```

| Field                 | Type      | Rule                                                                                                        |
| --------------------- | --------- | ----------------------------------------------------------------------------------------------------------- |
| `spec.descriptor`     | [w, h]    | Must equal the app's descriptor size, `[32, 24]`.                                                           |
| `spec.box`            | [x, y, w] | Must equal the app's face box, as fractions of the card.                                                    |
| `icons`               | array     | Must be an array. At most `LEARNED_ICONS_CAP` (100) entries in browser storage, oldest dropped first.       |
| `icons[].characterId` | integer   | The hero. Not an integer: that face is dropped.                                                             |
| `icons[].descriptor`  | string    | The face descriptor: 2304 signed bytes, base64 encoded. Not decodable to that length: that face is dropped. |
| `icons[].learnedAt`   | number    | Milliseconds since the epoch. Not a finite number: that face is dropped.                                    |

`spec` pins how the descriptors were made, so data whose `spec` differs, or that is not an object with an `icons` array, reads as nothing learned. The reference-file test rejects unknown hero ids, invalid files and duplicate descriptors.

Each descriptor appears once. A local lesson for identical descriptor bytes overrides the bundled label, and forgetting local learning restores it. Different crops of one hero stay separate examples, and nothing is averaged or voted. No client correction ever edits the bundled file. Every import teaches the one store, and the worker rebuilds its table on every change.

## Hosted references

`importReferenceUrl` fetches the import references from the image host under `img/import/`: the paragon frames `frame-p0` to `frame-p4-crown`, a `skins.json` manifest shaped `{ "<hero slug>": ["<file>", …] }`, and the costume captures under `skin/`. A missing manifest means no costumes. Artifact references are the bundled permanent icons plus the hosted seasonal set, capped at 128 px.

## Review pieces

An import's review is built from shared pieces (`src/components/import/`): a card cell with its state, the grid and section head around it, a hero card's editor that emits each correction for the import's plan to apply, and a screenshot's card with its thumbnail, status and remove button, which leaves room for the import's own rows. Their colours are the `--import-*` tokens in `src/styles/variables.css`, the import modal's dark surfaces and the game's result colours.

## Related documentation

- [Team Import](./IMPORT_TEAM.md): the match screens, their review and their plan
- [Teams](./TEAMS.md): where an import lands
