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
npm run test        # Run tests
npm run test:watch  # Run tests in watch mode
```

Always run `type-check` and `build` before committing.

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
│   │   ├── skills/     # Skill implementations
│   │   └── arena/      # Map configurations
│   ├── stores/         # Pinia state management
│   ├── components/     # Vue UI components
│   ├── content/        # Content components (localized, pre-rendered)
│   ├── composables/    # Vue composition functions
│   ├── utils/          # Helper utilities
│   ├── views/          # Page-level components
│   ├── router/         # Vue Router configuration
│   ├── data/           # Static JSON data (characters, artifacts)
│   ├── locales/        # i18n translations
│   ├── assets/         # Images and styles
│   ├── styles/         # Global CSS styles
│   ├── main.ts         # SPA entry point
│   └── main.ssg.ts     # SSG entry point (pre-rendering)
└── test/               # Test files
    ├── lib/            # Domain logic tests
    └── utils/          # Utility tests
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

### Adding a Character

1. Add JSON: `src/data/characters/[name].json`
2. Add image: `src/assets/images/characters/[name].webp`
3. Character automatically appears in roster

### Modifying Grid Logic

Edit `src/lib/grid.ts` - ensure transaction safety for complex operations.

### Changing Styles

- Component styles: `<style scoped>` blocks
- Global styles: `src/styles/`
- State colors: `src/utils/stateFormatting.ts`

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
