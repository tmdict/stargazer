# Documentation Style Guide

The format and content rules for the architecture documents under `docs/architecture/` and the overview in `docs/ARCHITECTURE.md`. A doc exists to tell a reader what the code cannot: contracts that span files, invariants, the reasons behind decisions, and the formats that cross the app's boundary. Everything else belongs in the code, and the doc points at it.

## What Belongs in a Doc

### Keep

- **Cross-file contracts**: who calls what, in what order, and what each side may assume (a store that never toasts, a codec that never carries a map for Arena boards)
- **Invariants and rules**: uniqueness, capacity, ordering, precedence, what blocks versus what only warns
- **Design decisions with their reasons**: why a layer exists, why an operation clears first, why a threshold sits where it does
- **Non-obvious mechanics**: races, capture-phase handlers, memoization keys, tie-breaks, fallbacks
- **External formats**: storage keys and envelopes, wire and file formats, URL shapes, CLI usage, JSON the app reads or writes for others
- **Thresholds by name**: cite the constant (`ANCHOR_FLOOR`) with its meaning; add the value only when the meaning needs it

### Remove

- Type, interface, class or function listings copied from source: the reader has the file
- Per-file inventories that mirror the directory
- Narration of what a component renders or what a function plainly does
- Restated code comments
- Generic performance bullets (O(1) lookups, "efficient") and browser-compatibility boilerplate
- Testing sections: the tests document themselves
- "How to add X" walkthroughs beyond a short numbered list that points at the builders and one representative file
- Counts that drift with data (hero counts, page counts): state the formula or omit

The test for a sentence: would a reader with the file open learn anything from it? If not, cut it or replace it with a pointer.

## Verification

Every path, identifier, constant, number and behavioural claim is checked against the current source before it lands in a doc, and again whenever the doc is touched:

- Grep every identifier the doc names; a name that does not exist is a wrong claim
- Fix a wrong claim to match the code; drop a claim that cannot be verified. Never guess
- A diagram must match the import direction or data flow in the code; redraw an inaccurate one rather than keep it
- Prefer a pointer (`src/stores/grids.ts`, `applyRosters`) to a description; name at most one file or symbol per sentence
- Every relative link must resolve; run `npx prettier --write` on the file (it aligns tables)

## Document Structure

### 1. Title

`# System Name`, no "Architecture" suffix (`# Grid & Character`, `# Teams`).

### 2. Overview (2 to 3 sentences)

First sentence: what the system does. Then one or two key technical characteristics. No justification.

### 3. Design Principles (optional)

```markdown
## Design Principles

1. **Key Concept**: One line, a technical decision the code enforces
```

- Bold the concept, colon, one line
- Each principle must be verifiable in the code (an import rule, a single restore path, an atomic operation)
- As many as the system has: list the real ones, and omit the section when there are none; never pad to a count
- Order from most fundamental to most specific

### 4. Architecture (optional)

An ASCII diagram (┌ ─ ┐ │ └ ┘ ▶ ▼, under 80 columns) when it shows data flow or import direction between three or more parts. Skip it for a linear flow. Label the one arrow that breaks the general direction.

### 5. Component Sections

```markdown
### Component Name (`/path/to/file.ts`)

One sentence on the responsibility, then bullets:

- **Contract**: what other files rely on
- **Invariant**: what always holds, and why
```

- File path in the heading, so the reader can jump
- Bullets with a bold key term; one or two lines each
- A table when several parallel items share the same columns (reading, evidence, consequence; route, view, role)
- Group related small components under one heading rather than one heading each

### 6. Code Excerpts

An excerpt earns its place only when it shows a contract shared across files or an external format:

```typescript
// The messages the worker accepts, as the composable posts them
type TeamImportRequest =
  | ({ type: 'references' } & ReferenceImages)
  | { type: 'learned'; learned: LearnedIcon[] }
  | { type: 'read'; id: string; image: RgbaImage }
```

- Under 15 lines; only the essential members
- Real code or real shapes, never pseudocode when real code exists
- Language tag on every fence: `typescript`, `json` for external files, `sh` for commands
- Not for a type the reader can open, a function body, or a "how to call it" sample

### 7. Operations

Sequential behaviour as a numbered list, each step naming the function that owns it. A step that only restates a function's own comment is dropped.

### 8. Optional Sections

- **Integration Points**: only for non-obvious cross-system coordination; bullets, no code
- **Performance**: only for a measured constraint or a deliberate trade-off the code cannot explain (a table size, a worker boundary, a sampling step); never generic
- **Related Documentation**: relative links with a one-line description; link what adds context, not every doc

## Writing Style

- Concise, neutral, current-state; state facts, with a reason only where a decision needs one
- Lead with the why: "clears both sides first, so a hero moving between boards never trips uniqueness against its own copy", not "clears both sides, then places"
- Present tense, present state: no "now", "previously", "replaces", "was moved" or other migration notes
- No em dashes anywhere; use commas, colons, periods or parentheses
- Bullets and tables over paragraphs; a paragraph only for a line of argument
- Bold the key term at the start of a bullet, never a whole sentence
- Short sentences, one idea each

## Length

Shorter is better; a doc is as long as its non-obvious content:

- **Leaf docs** (one helper family, one tool): 50 to 120 lines
- **Typical systems**: 120 to 220 lines
- **Core docs** (`GRID.md`, `SKILLS.md`): up to 250 lines
- Overview 2 to 3 sentences; diagram 10 to 20 lines; each component section under 30 lines; excerpts under 15 lines

## Layout of `docs/`

- `docs/ARCHITECTURE.md`: layer rules, dependency direction, the entity pattern, and a pointer to every deep dive; it never duplicates them
- `docs/architecture/<SYSTEM>.md`: one doc per system
- `docs/architecture/<system>/<TOPIC>.md`: leaf docs a system doc points to (`skills/COMPANION.md`, `skills/TARGETING.md`); they hold only the detail the parent defers to them
- A flow that belongs to another doc's domain is linked, not restated (the team import's apply and save flow lives in `TEAMS.md`)

## Quality Checklist

- [ ] Every path, identifier, constant and number verified against the source
- [ ] No claim that cannot be verified; no drifting counts
- [ ] Overview 2 to 3 sentences; every listed design principle enforced by code, none added to fill a count
- [ ] Diagram only if it adds value, and it matches the code's data flow
- [ ] File path in every component heading
- [ ] No type listings, inventories, render narration, restated comments, Testing section or generic performance bullets
- [ ] Every excerpt shows a shared contract or external format and stays under 15 lines
- [ ] No em dashes, no past-state phrasing, present tense throughout
- [ ] Every relative link resolves; prettier clean
- [ ] Within the length band for its kind

## Example Documents

- `/docs/architecture/GRID.md`: a core system: invariants, operations, id namespaces
- `/docs/architecture/IMPORT_TEAM.md`: the content rule applied: evidence table, named thresholds, external formats, pointers to the owning doc
- `/docs/architecture/skills/TARGETING.md`: a leaf doc
