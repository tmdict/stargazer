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

The game's pictures and text come from a data pack kept outside this repo ([Architecture](./ARCHITECTURE.md#the-data-pack)). Without it the app runs with plain portraits and no skill text, and `npm run build` stops. To use one, copy `.env.example` to `.env.local` (gitignored) and set `DATA_PACK_DIR` to the pack's folder.

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
3. Run the data export. It adds the hero's portrait and skill text in every language to the data pack, and writes the hero's Korean display name, the game's own, into that file.
4. Run `npm run data:pin` so the build takes the pack version that holds the hero.

The hero list, skill pages and search pick the character up from those files.

### Adding an arena map

Add `src/data/arena/<key>.json` with a `name`, the tile lists and an `id` no other map uses; `src/lib/maps.ts` finds it by file name and refuses a duplicate `id`. Links carry the `id`, so it never changes while the map exists; a season's preset maps take over the ids the previous season's presets free up. The per-board map lists of Supreme League and Guild Duel are the `TEAM_VARIANTS` rows in `src/lib/teams/modes.ts` ([Teams](./architecture/TEAMS.md)).

### Changing a placement rule

Placement, moves, swaps and removal live in `src/lib/characters/` and run inside `executeTransaction`, so a failed step undoes the earlier ones ([Grid](./architecture/GRID.md)).

### A new season

Follow the three-phase cutover in [Seasonal Content](./architecture/SEASONAL.md).

### Styles

Component styles are scoped in each `.vue` file, global styles are in `src/styles/`, tile-state colors, tile outlines, wall strokes and the team colors that SVG drawing uses (`TEAM_COLORS`, `teamTint`) are in `src/utils/tileStateFormatting.ts`, and boards draw breakable walls with the shared hatch in `src/components/grid/TileHatchPatterns.vue`.

## Documentation

Architecture docs follow [the style guide](./STYLE_GUIDE.md). Update the relevant doc when a change alters how a system works, and check every name it mentions against the code.
