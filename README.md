# Stargazer

AFK Journey arena simulator built with Vue 3 and TypeScript. Place characters on hex grids and experiment with team compositions.

## Features

- Character skills, companions, and the friend-assist (synergy) hero
- Drag & drop character placement on hexagonal grid
- Range-aware pathfinding and targeting, including artifact targeting arrows
- Teams page: 1v1 / 3v3 / 5v5 / Supreme League boards with a saved-team library
- Seasonal artifacts, phantimals, and charms
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
npm run dev         # Start development server
npm run build       # Production build
npm run test        # Run tests
```

See [Contributing](./docs/CONTRIBUTING.md) for all available commands.

## Project Structure

```
├── src/                # Source code
│   ├── lib/            # Domain logic
│   ├── stores/         # State management
│   ├── components/     # Vue components
│   ├── views/          # Page views
│   ├── data/           # Static data
│   └── assets/         # Images & styles
├── tests/              # Unit and integration tests
└── docs/               # Documentation
```

## Documentation

**Core:**

- [Getting Started](./docs/CONTRIBUTING.md) - Setup guide
- [Architecture](./docs/ARCHITECTURE.md) - System design

**Systems:**

- [Grid & Characters](./docs/architecture/GRID.md)
- [Teams](./docs/architecture/TEAMS.md)
- [Seasonal Content](./docs/architecture/SEASONAL.md)
- [Skills](./docs/architecture/SKILLS.md)
- [Pathfinding](./docs/architecture/PATHFINDING.md)
- [Drag & Drop](./docs/architecture/DRAG_AND_DROP.md)
- [Event System](./docs/architecture/EVENT_SYSTEM.md)
- [Map Editor](./docs/architecture/MAP_EDITOR.md)
- [URL Serialization](./docs/architecture/URL_SERIALIZATION.md)

## Contributing

See [Getting Started](./docs/CONTRIBUTING.md) for setup and guidelines.
