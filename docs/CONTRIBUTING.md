# Getting Started

## Prerequisites

- **Node.js 22+** - [Download](https://nodejs.org/)
- **Git** - [Download](https://git-scm.com/)
- **VS Code** (recommended) with Volar extension

## Setup

```bash
git clone <repository-url>
cd stargazer
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

## Commands

```bash
npm run dev         # Development server
npm run build       # Production build (SSG - pre-renders content pages)
npm run build:spa   # Traditional SPA build (no pre-rendering)
npm run preview     # Preview production build
npm run type-check  # TypeScript validation
npm run format      # Code formatting (Prettier)
npm run lint        # ESLint checks
npm run lint:fix    # ESLint with auto-fix
npm run test        # Run all tests
npm run test:unit   # Unit tests only
npm run test:it     # Integration tests only
npm run test:watch  # Run tests in watch mode
npm run prep        # format + type-check + lint + test
npm run import:seasonal  # Regenerate seasonal data/locales (see below)
```

Always run `npm run prep` (or at least `lint` and `type-check`) before committing.

## Build Modes

The application supports two build modes:

- **SSG Mode** (`npm run build`): Pre-renders content pages at build time for SEO and performance. The interactive game remains client-side.
- **SPA Mode** (`npm run build:spa`): Traditional single-page application without pre-rendering.

Development always runs in SPA mode for hot module replacement.

## Project Structure

```
├── src/                # Source code
│   ├── lib/            # Domain logic (framework-agnostic)
│   │   ├── types/      # Type definitions
│   │   ├── characters/ # Placement, companions, synergy, phantimals
│   │   ├── skills/     # Skill implementations
│   │   ├── teams/      # Team modes, saved-team records, previews, backup files
│   │   └── maps.ts     # Arena map registry (parses data/arena/*.json)
│   ├── stores/         # Pinia state management
│   ├── components/     # Vue UI components
│   ├── content/        # Content components (localized, pre-rendered)
│   ├── composables/    # Vue composition functions
│   ├── directives/     # Custom Vue directives
│   ├── utils/          # Helper utilities
│   ├── views/          # Page-level components
│   ├── router/         # Vue Router configuration
│   ├── data/           # Static JSON data (arena, character, artifact, seasonal)
│   ├── locales/        # i18n translations
│   ├── assets/         # Images and styles
│   ├── styles/         # Global CSS styles
│   ├── main.ts         # SPA entry point
│   └── main.ssg.ts     # SSG entry point (pre-rendering)
├── scripts/            # Seasonal data importers
└── tests/
    ├── unit/           # Mirrors src/ (lib, stores, composables, utils, skills, ...)
    └── integration/
```

## Architecture

- **UI Layer** (`components/`): Vue 3 components with Composition API
- **Composables** (`composables/`): Shared reactive state and Vue logic
- **State Layer** (`stores/`): Reactive wrappers using Pinia
- **Domain Layer** (`lib/`): Pure TypeScript, no framework dependencies
- **Dependency Flow**: Components → Composables → Stores → Domain (one-way)

See [Architecture Overview](./ARCHITECTURE.md) for details.

## Common Tasks

### Sharing a Grid

1. Set up your grid with characters and settings
2. Click the "Link" button in grid controls
3. The share URL is copied to clipboard and you're redirected to the Share page
4. Share the URL with others - they'll see a read-only view of your exact grid setup

The Teams page shares the same way for all of its boards; see [TEAMS.md](./architecture/TEAMS.md).

### Adding a Character

1. Add JSON: `src/data/character/[name].json`
2. Add image: `src/assets/images/character/[name].png` (vite-imagetools converts to WebP at build time)
3. Character automatically appears in roster

### Updating Seasonal Content (Artifacts / Phantimals / Charms)

Seasonal text is sourced from **afkj-data-viewer**'s exported API
(`/api/<locale>/{artifacts,phantimals,charms}.json`) via the importers; see
[SEASONAL.md](./architecture/SEASONAL.md) for the full architecture and the
ownership rule (scripts own feed-derivable text, humans own judgment).

- **Data (hand-curated):** pre-season artifacts in `src/data/artifact/`,
  seasonal artifacts in `src/data/seasonal/artifact/`, phantimals in
  `src/data/seasonal/phantimal/`. `name` is the slug (artifact name minus
  " Spell"); artifact `id` must be globally unique (URL serialization keys on
  it); stat keys map to `ArtifactStatKey` (`src/lib/types/artifact.ts`). The
  charm map `src/data/seasonal/charm/charms.json` is importer-generated.
- **Locales:** display names are hand-curated (`src/locales/artifact/` and
  `src/locales/seasonal/artifact/`); effect text, phantimal content, and
  charm text are importer-generated.
- **Icons:** pre-season artifacts ship local images; seasonal artifacts and
  phantimals load **remotely** from
  `chaldea.tmdict.com/img/seasonal/{artifact,phantimal}/<name>.webp`
  (`utils/artifactImage.ts`). The chaldea repo's `_redirects` exempts `/img/*`
  from its catch-all redirect and its `_headers` sends the CORS header the
  `crossorigin="anonymous"` consumers require.
- **Each new season:** update the hand-curated structural/name files, then run
  `npm run import:seasonal` (against a rebuilt afkj-data-viewer). The
  importers generate all text, lint the hand-curated files against the feed,
  and prune retired entries.

### Adding an Arena Map

Add `src/data/arena/<key>.json`; `src/lib/maps.ts` discovers it by filename. The
Supreme League per-board defaults are `FIVE_V_FIVE_DEFAULT_MAPS` in the same file
(editing that list hard-resets visitors' active 5v5 SL boards; see
[TEAMS.md](./architecture/TEAMS.md), Team Modes).

### Modifying Grid Logic

Edit `src/lib/grid.ts` - ensure transaction safety for complex operations.

### Changing Styles

- Component styles: `<style scoped>` blocks
- Global styles: `src/styles/`
- Tile state colors: `src/utils/tileStateFormatting.ts`

## Troubleshooting

**Clean install:** Delete `node_modules` and `package-lock.json`, then `npm install`

**Clear Vite cache:** Delete `node_modules/.vite`

**Type errors:** Check imports have proper extensions and types are exported correctly.

**Build failures:** Run `type-check` first to identify issues.

## Contributing Guidelines

- Follow existing patterns and TypeScript best practices
- Test manually before committing
- Keep commits focused and descriptive
- Update architecture docs for major changes

## Resources

- [Architecture Docs](./ARCHITECTURE.md)
- GitHub Issues for bug reports
