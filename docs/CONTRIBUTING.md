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
npm run build:ssg   # Explicit SSG build (same as build)
npm run type-check  # TypeScript validation
npm run format      # Code formatting
npm run preview     # Preview production build
```

Always run `type-check` and `build` before committing.

**Note:** Development mode always runs as SPA for hot reloading. Pre-rendering only happens during production builds.

## Project Structure

```
src/
├── lib/            # Domain logic (framework-agnostic)
│   ├── types/      # Type definitions
│   ├── skills/     # Skill implementations
│   └── arena/      # Map configurations
├── stores/         # Pinia state management
├── components/     # Vue UI components
├── content/        # Content components (localized, pre-rendered)
│   ├── skills/     # Skill descriptions (en/zh)
│   └── About.*.vue # About page content
├── composables/    # Vue composition functions
├── utils/          # Helper utilities
├── views/          # Page-level components
├── router/         # Vue Router configuration
│   ├── index.ts    # Router setup
│   └── routes.ts   # Shared route definitions
├── data/           # Static JSON data
├── assets/         # Images and styles
├── styles/         # Global CSS styles
├── main.ts         # SPA entry point
└── main.ssg.ts     # SSG entry point (pre-rendering)
```

## Architecture

- **Domain Layer** (`lib/`): Pure TypeScript, no framework dependencies
- **State Layer** (`stores/`): Reactive wrappers using Pinia
- **UI Layer** (`components/`): Vue 3 components with Composition API

See [Architecture Overview](./ARCHITECTURE.md) for details.

## Common Tasks

### Adding a Character

1. Add JSON: `src/data/characters/[name].json`
2. Add image: `src/assets/images/characters/[name].webp`
3. Character automatically appears in roster

### Adding Skill Content

1. Create content files: `src/content/skills/SkillName.en.vue` and `SkillName.zh.vue`
2. For shared data (like grid styles), create: `src/content/skills/SkillName.data.ts`
3. Content is automatically loaded by the `useContentComponent` composable

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
