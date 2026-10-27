# Screenshot Import

The screenshot imports read the game's own screens on the device and turn what they show into app data: the team import ([Team Import](./IMPORT_TEAM.md)) reads match result screens, formation panels and replay frames into a new team, and the roster import ([Roster Import](./IMPORT_ROSTER.md)) reads the hero roster into a new roster. [Screenshots the Imports Read](./IMPORT_SCREENSHOTS.md) sums up what each screen gives and where the imports stop. Each import keeps its own plan and review. What lies under the screens is shared: the image code, the reading of hero cards, the worker that runs the readers, the references they match against and the faces learned from corrections.

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

The screen layer (`screens/`) has one reader per screen, each finding the screen's own landmark before reading its cards: the result screen's tabs, the formation panel's board outline, the replay frame's arena, and on the hero roster (the Resonating Hall) the cream gutters between the cards, which a comb of columns is fitted to. The match screens share their reading type, the green ring of their map strips and the artifact reader (`screens/match/`).

The review rules (`review.ts`) are what every import's review asks of a card: its state, the parts of it left to confirm (`doubtfulParts`), and the hero and levels it contributes once corrected. On top sit the reference assembly, the learned-face store and the sorter, which tells which import and kind a screenshot shows (`sort.ts`).

## The engine

`useImportEngine` is module-level state for one page visit. Each import composable holds it while the component using it is mounted, and the last to let go disposes it: leaving a page unmounts its import modal, which drops the workers and their references. The pages themselves never import it, so its code loads with the modal on first use.

A screenshot is decoded on the main thread at its own size, within its kind's width limits (`RESULT_MAX_WIDTH` and the like), and its pixels are handed to a worker. Decoded screenshots wait in the engine and go to the workers one at a time each, so an import that closes drops the reads it still has waiting, and a reading that arrives for a removed shot is dropped. An import hands the engine its shots as a session: the engine moves each through reading, ready and failed, and gives the import each reading to keep.

Every import adds its files through the engine's `addFiles`, one at a time. Each file is sorted first, then the import places it: the kind to read it as, or turned away. A file whose name and size match a shot's is skipped, and adding stops once the import's modal closes or the page is left. Until a file is placed it is not a shot yet, so the engine counts the files still being added (`adding`), and Save waits for them as it waits for the screenshots being read.

The references come in two parts (`lib/import/kinds.ts`): the hero part every kind reads with (the paragon frames, the portraits and costumes, the learned faces) and the match part the match screens add (artifacts, phantimals and companions, the arena), so a roster read never waits on the match part. Each part is fetched once per visit, on an import's first use, and each reading worker gets its own copy. A screenshot added while its parts load waits for them. When a part fails, the screenshots waiting on it fail too but stay queued, and the next one added retries the load. A reader that crashes, or fails to build a part's tables, is dropped with the screenshot it was reading. While other readers remain they carry on, and the pool grows no further that visit, since a device short of memory would fail a new reader the same way. With none left the references count as failed, and the next attempt starts a fresh reader.

One worker script serves every kind of screenshot, with a reader for each. One reads to begin with. While a roster screenshot waits with every reader busy, the engine starts another, so the several screenshots of a roster read in parallel, up to a limit set by the device's cores and reported memory. One more worker holds only the arena and sorts every screenshot added (`sortScreenshot`), so each is sorted at once while the readers work. Each import refuses a screenshot the sorter finds to be the other's, whether it was dropped, picked or pasted, and reads one the sorter cannot place as the kind of where it was added.

## Hero identity

A descriptor is a 32 × 24 RGB face crop with each channel normalised to zero mean and unit norm, which cancels the warm tint the frame casts. It is stored as Int8 at ×400 in the worker table and in every saved descriptor.

The table cuts every bundled portrait over a grid of crop windows, because the in-game card zooms the same painting differently per hero. A costume reference is captured from the game's skin card, where the face sits smaller, so it adds a second grid of smaller windows. Learned and bundled descriptors join as extra rows. Ranking scores the whole table at the centre offset, re-scores the leaders at the other offsets, and gives the top portrait candidates (`REFINE_KEEP`) a finer window search. Learned rows keep their scores and do not use up that budget.

A pick needs `HERO_SCORE_FLOOR` and a lead of `HERO_SURE_MARGIN` over the best candidate of any other hero, learned or bundled. The lead must reach `COSTUME_SURE_MARGIN` when the winning window came from a costume, since the looser costume framing fits strangers more easily.

## Reference descriptors

Three sources feed one hero table, assembled by `buildImportHeroTable` (`src/lib/import/references.ts`) for the worker and the offline checks alike. Portraits and costumes give general coverage. The data pack's `screenshot-import/hero-icons.json` holds approved face examples for cards the portraits cannot match, shipped with the app as ordinary data. Browser learning adds examples private to that browser. Geometry, ranking and confidence do not depend on which source a row came from.

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

`spec` pins how the descriptors were made, so data whose `spec` differs, or that is not an object with an `icons` array, reads as nothing learned.

Each descriptor appears once. A local lesson for identical descriptor bytes overrides the bundled label, and forgetting local learning restores it. Different crops of one hero stay separate examples, and nothing is averaged or voted. No client correction ever edits the bundled file. Every import teaches the one store. Each reader takes the store's new list into its hero table before its next read: a rebuild takes most of a second, and a review can send several corrections while screenshots still wait.

## Reference pictures

Every reference picture is built into the site from the data pack (`src/pack/`). The paragon frames `frame-p0` to `frame-p4-crown` sit in `screenshot-import/`, and a hero's outfits beside its portrait as `<hero>-skin<N>.png` (`src/lib/characters/outfit.ts`). Both are encoded at the settings the matching was tuned on. Portraits and phantimals load at 180 px, artifact references are every artifact's icon capped at 128 px, and the replay arena is `screenshot-import/replay-arena.png`. Without a pack the frames are missing, and the import says its reference images could not be loaded.

## Review pieces

An import's review is built from shared pieces (`src/components/import/`). A hero card's editor emits each correction for the import's plan to apply. The modals lay out alike from `src/styles/import.css`. Their colours are the `--import-*` tokens in `src/styles/variables.css`: the import modal's dark surfaces, and the game's result colours for what mirrors the result screen. A board side takes the app's ally and enemy colours, as on the boards.

## Related documentation

- [Team Import](./IMPORT_TEAM.md): the match screens, their review and their plan
- [Roster Import](./IMPORT_ROSTER.md): the hero roster screen, its review and its plan
- [Screenshots the Imports Read](./IMPORT_SCREENSHOTS.md): what each screen gives, what a screenshot needs, and the limits
- [Teams](./TEAMS.md): where each import lands
