# Getting Started

## Setup

You need Node.js with npm, and Git.

```sh
git clone <repository-url>
cd stargazer
npm install
npm run dev
```

Then open http://localhost:5173.

The game's pictures and text come from a data pack kept outside this repo ([Architecture](./ARCHITECTURE.md#the-data-pack)). Without it the app runs with plain portraits and no skill text, and `npm run build` stops. To use one, copy `.env.example` to `.env.local` (gitignored) and set `DATA_PACK_DIR` to the pack's folder. The Supreme League generator's data file is read with the `VITE_SL_SEED` setting, which the file's writer keeps. Without it the generator's page cannot load its data, `npm run build` stops, and its two data tests are skipped ([Guide](./architecture/GUIDE.md)).

## Commands

```sh
npm run dev           # development server (SPA, hot reload)
npm run build         # type-check plus the pre-rendered production build
npm run build:ssg     # the pre-rendered build without the type-check
npm run build:spa     # type-check plus a plain SPA build, no pre-rendering
npm run preview       # serve the last build
npm run prep          # format, type-check, lint and test: run before committing
npm run format        # Prettier over src/, docs/ and tests/
npm run lint          # ESLint (lint:fix to auto-fix)
npm run type-check    # vue-tsc
npm run test          # all tests (test:unit, test:it, test:watch)
npm run data          # copy the data pack into src/pack/ (dev, test and prep run it first)
npm run data:pin      # pin the DATA_PACK_DIR folder's version in data.lock
```

## Common tasks

### Adding a character

1. Add `src/data/character/<name>.json`.
2. Add the English and Chinese display names in `src/locales/character/<name>.json`.
3. Run the image export and the data export. The image export adds the hero's portrait to the data pack; the data export adds its skill text in every language and writes its Korean display name, the game's own, into that file.
4. Run `npm run data:pin` so the build takes the pack version that holds the hero.

The hero list, skill pages and search pick the character up from those files.

### Adding an arena map

Add `src/data/arena/<key>.json` with a `name`, the tile lists and an `id` no other map uses; `src/lib/maps.ts` finds it by file name and refuses a duplicate `id`. A map with a tile on each side that buffs the unit standing on it lists them in `buffTiles` beside `grid`, the ally tile first, and the loader refuses one that is not an ally or enemy tile. The game moves buff tiles every few months, and the list moves with them. Links carry the `id`, so it never changes while the map exists; a season's preset maps take over the ids the previous season's presets free up. The per-board map lists of Supreme League and Guild Duel are in `src/data/maps.json`, which the `TEAM_VARIANTS` rows in `src/lib/teams/modes.ts` read ([Teams](./architecture/TEAMS.md)).

### Adding a skill

Add `src/lib/skills/characters/<slug>.ts`, or `seasonal/` for a unit that rotates. The block comment above `registerSkill` describing the in-game behavior is the skill's only documentation. Start from a builder ([Skills](./architecture/SKILLS.md#builders-and-composition)). If none fits, register a plain object and pair every paint, line or badge it adds with a removal (`paintTiles` and `clearPaintedTiles` handle the diff). Useful references are `himmel.ts` for a tile paint using `classOf`, `elijah-lailah.ts` for a companion with decorators, and `kulu.ts` for a custom lifecycle.

### Adding a screenshot screen

A new screen keeps the import's layers ([Screenshot Import](./architecture/IMPORT.md#layers)): a reader under `src/lib/import/screens/` that finds its own landmark, reads its cards with the card layer and gives every field a sure flag; a kind in `src/lib/import/kinds.ts` with the reference parts it waits for, its decode widths in the engine and its reader in the worker; a case in the sorter when one import takes it beside other screens or another import must turn it away; and an import that hands the engine its session, with a plan as pure data and a review built from the shared pieces. What it marks sure must never be wrong on the labelled samples.

### Changing a placement rule

Placement, moves, swaps and removal live in `src/lib/characters/` and run inside `executeTransaction`, so a failed step undoes the earlier ones ([Grid](./architecture/GRID.md)).

### A new season

A season ships in three phases ([Seasonal Content](./architecture/SEASONAL.md#season-cutover)). At the game's flip:

1. Run the data export for the new season. It retires the previous season's text and writes the season's artifact and phantimal data files and names, reusing the freed ids. The image export adds the season's icons, companions included, to the data pack, and the previous season's icons are removed from it by hand. A new artifact stat needs an `ArtifactStatKey` and a label in `src/locales/game/`.
2. Pin the pack version that holds the season with `npm run data:pin`, and review the changes the export made here.
3. Replace `src/lib/skills/seasonal/phantimal.ts` (one companion skill per phantimal that has a companion), delete the old season's `ARTIFACT_TARGETING` entries with their tests, and replace the `season N` block in `tests/unit/skills/phantimal.test.ts`.
4. If the Supreme League map list changed, give the new preset maps the ids the old ones free and edit the `sl` list in `src/data/maps.json`. The list also changes mid-season, every couple of months, and the replay-frame reader then needs checking against frames of the new maps ([Team Import](./architecture/IMPORT_TEAM.md#replay-frames)).
5. Run the tests and the build, commit the export's changes with `data.lock`, and deploy.

When the feed carries the season's text, run the data export again, pin its pack version and deploy. Once the text is in, write the season's charm `tags.json` and each phantimal's and artifact's `tags`. A failed check means a phase 1 value is wrong, so fix the data file, not the check.

Add an artifact rule whenever its mechanic is known. Set a phantimal's `"targeting": true` once its Spirit Mark is live in the game.

### Styles

Component styles are scoped in each `.vue` file and global styles are in `src/styles/`. Tile colors are tokens in `src/styles/variables.css`, and `src/utils/tileStateFormatting.ts` picks them for each tile state and holds the team colors that SVG drawing uses (`TEAM_COLORS`, `teamTint`). Boards draw wall hatching with `src/components/grid/TileHatchPatterns.vue` and `TileHatch.vue`: breakable walls in the light look, every wall in the dark look. In the dark look `TileBevel.vue` adds an inner line to every tile but open ground, as the preview board does.

## Documentation

Architecture docs follow [the style guide](./STYLE_GUIDE.md).
