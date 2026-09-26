# Documentation Style Guide

How to write the docs under `docs/`. A doc is a short design document for one system: it explains what a reader cannot get by opening the code. That means the problem the system solves, how the pieces work together, the decisions behind it, the rules that must hold across files, and the traps that caused bugs. Everything the code already says stays in the code.

The test for every sentence: would someone with the file open learn anything from it? If not, cut it.

## What goes in

Include only the sections a system needs, in roughly this order:

1. An overview: a few sentences on what the system is for and what makes it hard.
2. How it works: the flow across files, ideally as a diagram.
3. Decisions: why it is built this way, including alternatives that were rejected.
4. Rules: invariants and cross-file contracts that a change must keep.
5. Gotchas: non-obvious behavior that has caused or would cause bugs.
6. Formats: data that leaves the app (storage keys, wire and file formats, URLs), described field by field.

Organize by idea, not by file. A heading names a concept ("Reused ids", "Storage and restore"), never a file. Name a file or function only where a reader would need to jump to it.

Leave out:

- Lists of files, components, types, fields or functions, and one-line summaries of what each does
- Code excerpts, except for an external format that has no better home
- Walkthroughs of what the UI shows or what a function plainly computes
- Generic claims ("efficient", "type-safe", "simple API") and testing sections
- Counts that drift with data (heroes, pages, files); state the rule instead

## Diagrams

Diagrams are ASCII, drawn with box characters (┌ ─ ┐ │ └ ┘ ▶ ▼), and fit in 80 columns. Use one when it shows how three or more parts connect or how data moves; skip it for a straight line of steps. A diagram must match the code's actual imports or data flow. Tables are fine for data that is genuinely tabular, such as bit layouts, storage keys or a rule matrix.

## Voice

Write the way a colleague would explain the system at a whiteboard: plain, specific, in full sentences.

- Default to short paragraphs. Use a list only for items that are truly parallel, and no bold labels at the start of list items.
- One idea per sentence. At most one semicolon and one parenthetical in a sentence.
- Say what happens, not a slogan about it. Write "each saved team stores its board count, and the page picks its mode from that", not "mode is data, not a tab".
- No metaphors or jargon. Avoid: seam, rides, for free, self-heal, choke point, load-bearing, shell, by construction, first-class.
- No numbered "principles" sections. A principle that matters goes under Decisions, with its reason.
- Present tense, current state: no "now", "previously", "was moved", "replaces".
- No em dashes; use commas, colons, periods or parentheses.

## Verification

Check every path, identifier, constant and behavioral claim against the source before it lands, and again whenever the doc is edited. Grep each identifier the doc names. Fix a wrong claim to match the code, and drop a claim you cannot verify. Every relative link must resolve. Run `npx prettier --write` on the file.

## Length

Shorter is better. When in doubt, cut. A leaf doc (one helper family) runs 40 to 80 lines, a system doc 80 to 150. A doc that grows past that is usually restating code or covering two systems.

## Layout

- `docs/ARCHITECTURE.md`: the layers, how data flows through the app, and where state is stored.
- `docs/architecture/<SYSTEM>.md`: one doc per system.
- `docs/architecture/<system>/<TOPIC>.md`: detail a system doc defers to.
- `docs/CONTRIBUTING.md`: setup, commands and short how-tos.
- The doc index lives in `AGENTS.md`. Link a flow that belongs to another doc instead of repeating it.
