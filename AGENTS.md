# PROJECT GUIDELINES

## DEVELOPMENT STANDARDS

- Prioritize simplicity and readability
- Use TypeScript with proper types (avoid `any` types)
- Refactor repeated functionality (DRY principle)
- Use functional and stateless approaches when possible
- Test changes: `npm run lint` and `npm run type-check`
- Update relevant architecture docs when making major changes

### Comments

Add a comment only when the code can't tell the story itself: a non-obvious mechanic, something that looks wrong but is intentional, a cross-file contract, or a real gotcha. If a competent reader could already know it from the code, omit it.

- Navigation aids are welcome: a short file-level header (overall purpose/architecture), and section markers that group related code.
- Don't narrate what the code already shows: a name, a type, what the CSS/markup renders, or what a line or branch plainly computes.
- Lead with the _why_, not the _what_, so a later edit doesn't undo the decision and reintroduce a bug. A comment that opens by restating the mechanism is still narration even with a reason tacked on: `// adds a unit, so it needs capacity` over a `canPlaceCharacterOnTeam(...)` call says nothing the call doesn't. Give the reason or the non-obvious constraint instead, and if a line or branch is self-evident, leave it bare.
- One comment per idea, not per branch: when branches share a rule or only one case is subtle, write a single comment for that rule or case instead of tagging each branch.
- Keep comments concise, neutral, and current-state: no editorializing, and no past-state or migration notes ("now", "previously", "replaces", "hoisted from", etc.).

### Commit Messages

- Keep them concise: a short imperative subject line, plus a brief body only when the why isn't visible in the diff. The comment guidelines above apply: lead with the why, no editorializing, no narrating the diff.
- No attribution or tool metadata: omit Co-Authored-By trailers, AI session links, and similar boilerplate.

## DOCUMENTATION

This is the one index of the project docs.

- [Getting Started](./docs/CONTRIBUTING.md) - Setup, commands, common tasks
- [Architecture](./docs/ARCHITECTURE.md) - Layers, the board object, how input reaches the screen, where state is stored
- [Style Guide](./docs/architecture/STYLE_GUIDE.md) - How to write these docs

System docs:

- [Grid](./docs/architecture/GRID.md) - The grid engine, boards, placement rules, unit ids, map editor
- [Board Input](./docs/architecture/DRAG_AND_DROP.md) - Drag, tap, drop routing, the event bus
- [Pathfinding](./docs/architecture/PATHFINDING.md) - Closest-target search and tie-breaking
- [Skills](./docs/architecture/SKILLS.md) - The skill engine on the grid, artifact targeting
- [Companions](./docs/architecture/skills/COMPANION.md) - Skill-spawned companion units
- [Skill Targeting](./docs/architecture/skills/TARGETING.md) - Targeting helpers for skills
- [Skill Pages](./docs/architecture/SKILL_PAGES.md) - Skill pages, skill text loading, search
- [Teams](./docs/architecture/TEAMS.md) - Teams page: modes, storage, saved-team library
- [Team Import](./docs/architecture/IMPORT_TEAM.md) - Match screenshot import
- [Seasonal Content](./docs/architecture/SEASONAL.md) - Phantimals, seasonal artifacts, charms, season cutover
- [URL Serialization](./docs/architecture/URL_SERIALIZATION.md) - Link and storage formats
- [Guide](./docs/architecture/GUIDE.md) - Guide pages, season summaries, counter ladder
- [Pre-Rendering](./docs/architecture/PRE_RENDERING.md) - Static-site build, meta, hosting

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
