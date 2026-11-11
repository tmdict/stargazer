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

The game's pictures and text come from a data pack, put together outside this repo from several sources. Without it the app runs with plain portraits and no skill text, and `npm run build` stops. To use one, copy `.env.example` to `.env.local` (gitignored) and set `DATA_PACK_DIR` to the pack's folder. The PvP reports and the team generator's data file come with the pack too. Without them the guide index lists no reports, the generator's page cannot load its data, and the tests of that data are skipped.

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
npm run data:pin      # record in data.lock the data pack version the build uses
```

## Common tasks

### Adding a character

1. Add `src/data/character/<name>.json`.
2. Add the English and Chinese display names in `src/locales/character/<name>.json`. The Korean name, the game's own, is filled in by a pack update.
3. Once the data pack holds the hero's portrait and skill text, run `npm run data:pin` so the build takes that version.

The hero list, skill pages and search pick the character up from those files.

### Adding an arena map

Add `src/data/arena/<key>.json` with a `name`, the tile lists and an `id` no other map uses; `src/lib/maps.ts` finds it by file name and refuses a duplicate `id`. A map file holds the layout alone. Links carry the `id`, so it never changes while the map exists; a season's preset maps take over the ids the previous season's presets free up. The per-board map lists of Supreme League and Guild Duel are in `src/data/maps.json`, which the `TEAM_VARIANTS` rows in `src/lib/teams/modes.ts` read, with each board's buff tiles and the name of each buff's text under `src/locales/buff/` ([Teams](/docs/architecture/TEAMS.md)). A rotation edits a list's maps and buffs together, and the replay-frame reader then needs checking against frames of the new maps ([Screenshot Import](/docs/architecture/IMPORT.md#replay-frames)).

### Adding a skill

Add `src/lib/skills/characters/<slug>.ts`, or `seasonal/` for a unit that rotates. The block comment above `registerSkill` describing the in-game behavior is the skill's only documentation. Start from a builder ([Skills](/docs/architecture/SKILLS.md#builders-and-composition)). If none fits, register a plain object and pair every paint, line or badge it adds with a removal (`paintTiles` and `clearPaintedTiles` handle the diff). Useful references are `himmel.ts` for a tile paint using `classOf`, `elijah-lailah.ts` for a companion with decorators, and `kulu.ts` for a custom lifecycle. A skill whose effect acts when the battle starts also takes a placement rule in its unit's data file ([Changing a unit's placement rule](#changing-a-units-placement-rule)).

### Adding a skill note

A hero's skill note is one file per app locale, `src/content/skill/<slug>/<HeroNameCamelCase>.<lang>.vue` ([Skill Pages](/docs/architecture/SKILL_PAGES.md#commentary-snippets)), and its boards are `GridSnippet`s. A board that shows which units a skill takes puts a hero on every candidate, dims the ones it passes over (`dimmed`) and lights the border of the ones it takes (`outlined`). A board that shows an order numbers the tiles instead, since a number on a portrait is hard to read.

### Adding a screenshot screen

A new screen keeps the import's layers ([Screenshot Import](/docs/architecture/IMPORT.md#layers)): a reader under `src/lib/import/screens/` that finds its own landmark, reads its cards with the card layer and gives every field a sure flag; a kind in `src/lib/import/kinds.ts` with the reference parts it waits for, its largest decode width in the engine and its reader in the worker; a case in the sorter when one import takes it beside other screens or another import must turn it away; and an import that hands the engine its session, with a plan as pure data and a review built from the shared pieces. What it marks sure must never be wrong on the labelled samples.

### Changing what a board allows

Placement, moves, swaps and removal live in `src/lib/characters/` and run inside `executeTransaction`, so a failed step undoes the earlier ones ([Grid](/docs/architecture/GRID.md)).

### Changing a unit's placement rule

A unit's placement rule is in `rules` in its data file, and its words are defined in `src/lib/types/rule.ts` ([Placement](/docs/architecture/PLACEMENT.md)). After a change, run `npx vitest run tests/unit/rules.test.ts tests/unit/placement`. A new goal word or field also goes in the scorer (`src/lib/placement/score.ts`) and in a unit test of its own, and a new goal word in the goal table in [Placement](/docs/architecture/PLACEMENT.md#scoring).

To see how a change moves real teams, run the measuring test, `tests/placement/engine.test.ts`, whose header lists its settings. The lists, leans and weights come in the PvP data file, so a change to them arrives with the next copy of it.

### Styles

Component styles are scoped in each `.vue` file and global styles are in `src/styles/`. Tile colors are tokens in `src/styles/variables.css`, and `src/utils/tileStateFormatting.ts` picks them for each tile state and holds the team colors that SVG drawing uses (`TEAM_COLORS`, `teamTint`).

## Documentation

Architecture docs follow [the style guide](/docs/STYLE_GUIDE.md).
