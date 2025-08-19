# Stargazer

AFK Journey arena simulator built with Vue 3 and TypeScript. Place characters on hex grids and experiment with team compositions.

## Features

- Character skills and team synergies
- Drag & drop character placement on hexagonal grid
- Range-aware pathfinding and targeting
- Map editor for custom arenas
- URL-based state sharing
- Responsive design seamlessly adapts to mobile, tablet, and desktop

## Quick Start

**Prerequisites:** Node.js 22+, Git

```bash
git clone <repository-url>
cd stargazer
npm install
npm run dev
```

Open http://localhost:5173

## Commands

```bash
npm run dev         # Development server
npm run build       # Production build (with pre-rendering)
npm run build:spa   # Traditional SPA build (no pre-rendering)
npm run type-check  # TypeScript validation
npm run format      # Code formatting
```

## Project Structure

```
src/
├── lib/            # Domain logic (framework-agnostic)
├── stores/         # State management (Pinia)
├── components/     # Vue components
├── content/        # Content components (i18n)
├── composables/    # Vue composition functions
├── data/           # Character/artifact data
├── assets/         # Images and styles
├── styles/         # Global styles
└── utils/          # Helper functions
```

## Documentation

**Core:**

- [Getting Started](./docs/CONTRIBUTING.md) - Setup guide
- [Architecture](./docs/ARCHITECTURE.md) - System design

**Systems:**

- [Grid & Characters](./docs/architecture/GRID.md)
- [Skills](./docs/architecture/SKILLS.md)
- [Pathfinding](./docs/architecture/PATHFINDING.md)
- [Drag & Drop](./docs/architecture/DRAG_AND_DROP.md)
- [Event System](./docs/architecture/EVENT_SYSTEM.md)
- [Map Editor](./docs/architecture/MAP_EDITOR.md)
- [URL Serialization](./docs/architecture/URL_SERIALIZATION.md)

## Contributing

See [Getting Started](./docs/CONTRIBUTING.md) for setup and guidelines.

---

_Built with the help of Claude Code 🤖⚔️_
