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

## Commands

```sh
npm run dev           # development server (SPA, hot reload)
npm run build         # type-check plus the pre-rendered production build
npm run build:ssg     # the pre-rendered build alone
npm run build:spa     # type-check plus a plain SPA build, no pre-rendering
npm run preview       # serve the last build
npm run prep          # format, type-check, lint and test: run before committing
npm run format        # Prettier over src/, docs/ and tests/
npm run lint          # ESLint (lint:fix to auto-fix)
npm run type-check    # vue-tsc
npm run test          # all tests (test:unit, test:it, test:watch)
npm run import:seasonal  # skills, charms, artifacts, phantimals from the data feed
npm run import:skills    # skill text only (also import:charms, :artifacts, :phantimals)
npm run check:import     # run the screenshot-import readers over a folder of images
```

The importers read an upstream data feed that is not part of this repo; see [Seasonal Content](./architecture/SEASONAL.md).

## Common tasks

### Adding a character

1. Add `src/data/character/<name>.json` and the portrait `src/assets/images/character/<name>.png` (converted to WebP at build time).
2. Add the display names in `src/locales/character/<name>.json`.
3. Run `npm run import:skills` to bring in the skill text for every language.

The roster, skill pages and search pick the character up from those files.

### Adding an arena map

Add `src/data/arena/<key>.json`; `src/lib/maps.ts` finds it by file name. A map that team links should be able to name also needs an id in `MAP_WIRE_IDS` (`src/lib/teams/wire.ts`); a season's preset maps take over the ids the previous season's presets free up. The per-board map lists of Supreme League and Guild Duel are the `TEAM_VARIANTS` rows in `src/lib/teams/modes.ts` ([Teams](./architecture/TEAMS.md)).

### Changing a placement rule

Placement, moves, swaps and removal live in `src/lib/characters/` and run inside `executeTransaction`, so a failed step undoes the earlier ones ([Grid](./architecture/GRID.md)).

### A new season

Follow the three-phase cutover in [Seasonal Content](./architecture/SEASONAL.md). Seasonal icons load from an image host that must send CORS headers, because the image export reads them into a canvas.

### Styles

Component styles are scoped in each `.vue` file, global styles are in `src/styles/`, and tile-state colors are in `src/utils/tileStateFormatting.ts`.

## Documentation

Architecture docs follow [the style guide](./architecture/STYLE_GUIDE.md). Update the relevant doc when a change alters how a system works, and check every name it mentions against the code.
