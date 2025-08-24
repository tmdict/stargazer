# PROJECT GUIDELINES

## DEVELOPMENT STANDARDS

- Prioritize simplicity and readability
- Use TypeScript with proper types (avoid `any` types)
- Refactor repeated functionality (DRY principle)
- Keep comments concise and focused on design concepts
- Don't add comments if it just repeats a function name
- Use functional and stateless approaches when possible
- Test changes: `npm run build` and `npm run type-check`
- Update relevant architecture docs when making major changes

## DOCUMENTATION

For comprehensive project documentation, see:

### Core Documentation

- [Getting Started](./docs/CONTRIBUTING.md) - Setup and basic usage
- [Architecture Overview](./docs/ARCHITECTURE.md) - High-level design and principles
- [Style Guide](./docs/architecture/STYLE_GUIDE.md) - Documentation style guidelines

### Architecture Deep Dives

- [Grid & Character System](./docs/architecture/GRID.md) - Hexagonal grid and character management
- [Skills](./docs/architecture/SKILLS.md) - Character abilities and visual effects
- [Pathfinding](./docs/architecture/PATHFINDING.md) - Targeting and movement algorithms
- [Drag & Drop](./docs/architecture/DRAG_AND_DROP.md) - Multi-layer drag system
- [Event System](./docs/architecture/EVENT_SYSTEM.md) - Component communication
- [Map Editor](./docs/architecture/MAP_EDITOR.md) - Map creation tools
- [URL Serialization](./docs/architecture/URL_SERIALIZATION.md) - Binary state sharing

## BUILD COMMANDS

- `npm run dev` - Development server
- `npm run build` - Production build
- `npm run type-check` - TypeScript validation
- `npm run format` - Code formatting

## Vue Components Best Practices

- Name files consistently using PascalCase (`UserProfile.vue`)
- ALWAYS use PascalCase for component names in source code
- Compose names from the most general to the most specific: `SearchButtonClear.vue` not `ClearSearchButton.vue`
- ALWAYS define props with `defineProps<{ propOne: number }>()` and TypeScript types, WITHOUT `const props =`
- Use `const props =` ONLY if props are used in the script block
- Destructure props to declare default values
- ALWAYS define emits with `const emit = defineEmits<{ eventName: [argOne: type]; otherEvent: [] }>()` for type safety
- ALWAYS use camelCase in JS for props and emits, even if they are kebab-case in templates
- ALWAYS use kebab-case in templates for props and emits
- ALWAYS use the prop shorthand if possible: `<MyComponent :count />` instead of `<MyComponent :count="count" />` (value has the same name as the prop)
- ALWAYS Use the shorthand for slots: `<template #default>` instead of `<template v-slot:default>`
- ALWAYS use explicit `<template>` tags for ALL used slots
- ALWAYS use `defineModel<type>({ required, get, set, default })` to define allowed v-model bindings in components. This avoids defining `modelValue` prop and `update:modelValue` event manually

## Import Ordering Convention

Imports are automatically sorted by Prettier using @ianvs/prettier-plugin-sort-imports.

### Order Groups (top to bottom)

1. **Vue framework** - `vue`, `vue-router`, `pinia`, `@vue/*` packages
2. **Third-party & Node modules** - All other external dependencies and Node built-ins
3. **Local imports** - `@/` paths, parent (`../`), and sibling (`./`) imports
4. **Style imports** - CSS/SCSS files

### Rules

- **Blank lines** between groups 2→3 and 3→4
- **Alphabetical order** within each group
- Type imports are mixed with regular imports

# important-instruction-reminders

Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER run `npm run dev` as it starts a dev server which blocks the terminal and should be avoided in this environment
