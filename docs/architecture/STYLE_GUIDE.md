# Documentation Style Guide

This guide defines the standard format and style for architecture documentation in the project. All architecture documents should follow these conventions for consistency and clarity.

## Document Structure

### 1. Title

- Use clear, concise titles without "Architecture" suffix
- Format: `# System Name` (e.g., `# Grid & Character`, `# Skill System`)
- Avoid verbose titles or unnecessary qualifiers

### 2. Overview (2-3 sentences)

```markdown
## Overview

The [system] provides [primary function]. It [key characteristic] and [secondary characteristic].
```

**Example:**

> The grid system provides the spatial foundation for the game, managing hexagonal tiles, character positions, and state transitions. It integrates character management with automatic skill activation and implements atomic transactions to ensure data consistency across complex operations.

**Guidelines:**

- First sentence: State the system's primary purpose
- Second sentence: Highlight 1-2 key technical characteristics
- Keep to 2-3 sentences maximum
- No philosophical discussions or justifications

### 3. Design Principles (5 numbered points)

```markdown
## Design Principles

1. **Key Concept**: Brief explanation of the principle
2. **Key Concept**: Brief explanation of the principle
3. **Key Concept**: Brief explanation of the principle
4. **Key Concept**: Brief explanation of the principle
5. **Key Concept**: Brief explanation of the principle
```

**Guidelines:**

- Exactly 5 principles (not more, not less)
- Bold the concept name, follow with colon
- One-line explanation after the colon
- Focus on technical design decisions, not philosophy
- Order from most fundamental to most specific

### 4. Architecture (Optional)

```markdown
## Architecture
```

[ASCII diagram showing system relationships]

```

```

**When to Include:**

- Complex multi-layer systems with non-obvious interactions
- Systems with circular dependencies or feedback loops
- When visual representation significantly clarifies the design
- For showing data flow between 3+ components

**When to Skip:**

- Simple systems with linear flow
- Single-responsibility modules
- When prose description is clearer than a diagram

**Example Structure (when needed):**

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────┐
│   Components    │────▶│  Store Layer     │────▶│Domain Layer │
│                 │     │                  │     │             │
│ - Component1    │     │ - Store1         │     │ - Class1    │
│ - Component2    │     │ - Store2         │     │ - Class2    │
└─────────────────┘     └──────────────────┘     └──────┬──────┘
                                                        │
                        ┌───────────────────────────────┼────────────┐
                        ▼                               ▼            ▼
                ┌─────────────┐                ┌─────────────┐  ┌──────────┐
                │  Subsystem1 │                │  Subsystem2 │  │Subsystem3│
                └─────────────┘                └─────────────┘  └──────────┘
```

**Guidelines (when using):**

- Use box drawing characters (┌ ─ ┐ │ └ ┘ ▶ ▼)
- Show data flow with arrows
- Include 2-3 key items per box
- Keep diagram width under 80 characters
- Show layers from left to right or top to bottom

### 5. Core Components

Structure each component as:

````markdown
### Component Name (`/path/to/file.ts`)

Brief description of the component's role:

```typescript
// Key interface or class definition
interface /
  class Name {
    // Only essential properties/methods
  }
```
````

Key features:

- **Feature 1**: Brief description
- **Feature 2**: Brief description
- **Feature 3**: Brief description

````

**Guidelines:**
- Include file path in heading
- One-sentence description before code
- Show only essential code (10-15 lines max)
- Use bullet points for features
- Bold feature names
- Keep descriptions to one line

### 6. Implementation Sections

For operational sections (e.g., "Character Operations", "Skill Implementation"):

```markdown
## Section Name

### Subsection

Brief intro if needed.

```typescript
// Code example if helpful
````

Key points:

- **Point 1**: Description
- **Point 2**: Description

OR for sequential operations:

1. First step
2. Second step
3. Third step

````

**Guidelines:**
- Use numbered lists for sequential processes
- Use bullet points for feature lists
- Include code only when it clarifies the concept
- Keep code examples under 15 lines
- Avoid redundant explanations

### 7. Integration Points (Optional)

```markdown
## Integration Points

### System Name

- Integration point 1
- Integration point 2
- Integration point 3
````

**When to Include:**

- Complex systems where integration is central to understanding functionality
- Systems with non-obvious or sophisticated cross-component coordination
- When integration patterns are unique or architecturally significant
- Multiple bi-directional dependencies that need clarification

**When to Skip:**

- Simple systems with straightforward callbacks or APIs
- Systems that primarily consume other services without complex coordination
- When integration is standard and follows common patterns
- Self-contained modules with minimal external dependencies

**Guidelines (when using):**

- Use H3 for each integrated system
- Bullet points for integration details
- Keep each point to one line
- No code examples in this section

### 8. Performance/Technical Considerations

```markdown
## Performance Considerations

- **Optimization 1**: Brief explanation
- **Optimization 2**: Brief explanation
- **Optimization 3**: Brief explanation
```

**Guidelines:**

- Focus on actual implementations, not theoretical
- Use technical metrics (O(1), O(n), etc.)
- Keep explanations brief and factual

### 9. Related Documentation (Optional)

```markdown
## Related Documentation

- [`/docs/architecture/RELATED.md`](./RELATED.md) - Brief description
- [`/docs/architecture/OTHER.md`](./OTHER.md) - Brief description
```

**When to Include:**

- Complex systems that heavily depend on or integrate with other systems
- When understanding related systems is essential for full comprehension
- Multi-part systems that are documented across several files
- When linking provides important context not covered in the current document

**When to Skip:**

- Simple, self-contained systems
- When links would be redundant (e.g., linking to GRID.md from every doc)
- Short documents that don't need additional context
- When the relationships are already clear from the content

**Guidelines (when using):**

- Use relative links within the architecture folder
- Include brief description after dash
- Order by relevance to the current system
- Avoid overlinking - only include truly related documentation

## Writing Style

### Tone and Voice

**DO:**

- Be concise and direct
- Use technical language appropriately
- Focus on implementation over theory
- State facts without justification

**DON'T:**

- Include philosophical discussions
- Justify design decisions at length
- Use passive voice excessively
- Repeat information

### Code Examples

**DO:**

- Show actual interfaces/types from the codebase
- Include only essential properties
- Use TypeScript syntax highlighting
- Keep examples under 15 lines

**DON'T:**

- Include entire class implementations
- Show trivial getters/setters
- Include extensive comments
- Use pseudocode when real code exists

### Formatting

**Bullet Points:**

- Use for feature lists
- Use for non-sequential items
- Bold the key term, follow with colon
- Keep to one line when possible

**Numbered Lists:**

- Use for sequential processes
- Use for step-by-step operations
- Don't mix with bullet points in same list

**Code Blocks:**

- Always specify language (```typescript)
- Remove unnecessary whitespace
- Focus on structure over implementation
- Include brief inline comments only

## Length Guidelines

- **Total document**: 150-250 lines
- **Overview**: 2-3 sentences
- **Design Principles**: 5 lines (exactly)
- **Architecture diagram**: 10-15 lines (if included)
- **Each component section**: 15-30 lines
- **Code examples**: 5-15 lines each

## Common Patterns

### Describing a Class/Interface

````markdown
### Class Name (`/src/lib/file.ts`)

One-line description of purpose:

```typescript
class Name {
  private essential: Field

  coreMethod(param: Type): Return
  otherMethod(): void
}
```
````

Key features:

- **Feature**: What it does
- **Feature**: What it does

````

### Describing Operations

```markdown
### Operation Name

Brief description of when/why:

```typescript
function example(params) {
  return implementation
}
````

Process:

1. Step one
2. Step two
3. Step three

````

### Describing Systems

```markdown
### System Name

How it works:

- **Component 1**: Role in system
- **Component 2**: Role in system
- **Storage**: How data is organized
````

## Quality Checklist

Before submitting documentation, verify:

- [ ] Overview is 2-3 sentences
- [ ] Exactly 5 design principles
- [ ] Architecture diagram included only if it adds value
- [ ] Code examples are under 15 lines each
- [ ] No philosophical discussions
- [ ] No redundant information
- [ ] Total length is 150-250 lines (shorter for simpler systems)
- [ ] All sections follow the standard structure
- [ ] Integration points included only for complex systems
- [ ] Related documentation linked only when it adds context

## Example Documents

The following documents exemplify this style:

- `/docs/architecture/GRID.md` - Grid & character system
- `/docs/architecture/SKILLS.md` - Skill system

Use these as references when writing new documentation.
