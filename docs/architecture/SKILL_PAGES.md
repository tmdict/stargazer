# Skill Pages

The `/skills` browser, skill modal and pre-rendered `/<code>/skill/<slug>` pages share a skill reader. Skill text and hero names follow the text locale (`SKILL_LOCALES`), while chips and app controls follow the chrome locale (`APP_LOCALES`). No skill language ships in the main bundle, but pre-rendered pages must have their text ready for a single render pass.

## Skill text

Skill text comes from the data pack, in `src/pack/text/skill/<code>/` ([Architecture](../ARCHITECTURE.md#the-data-pack)), which the data export writes from the upstream feed. `SKILL_LOCALES` is the one list of text languages, and the build stops while the pack lacks one's folder.

Each `<slug>.json` stores the localized name in `_hero.name` and entries for the hero's slots in `SLOT_ORDER`. A slot has a name `n`, descriptions `d` where `d[i]` is level i+1, and optional EX refinement tiers `r`. `SLOT_ORDER` also defines render order and the slots commentary can fill.

Underscore files hold shared language data: `_terms.json` for panel labels, `_keywords.json` for the glossary, `_artifacts.json` for every artifact's name and effects, and `_charms.json` and `_phantimals.json` for [seasonal text](./SEASONAL.md). `splitSkillDict` excludes them from hero dictionaries, and the pre-render route walk must exclude them too. The artifact and phantimal windows read theirs in the language of their own globe menu, through `useModalSkillLocale` as the skill window does, so their text loads with that language's chunk.

In `_terms.json`, `ultimate` and `ex` prefix slot headings. The remaining fields are panel templates, with `{cooldown}`, `{initialCooldown}`, `{range}` and `{energy}` replaced by values:

```json
{
  "ultimate": "Ultimate",
  "ex": "Exclusive Equipment",
  "cooldown": "Cooldown: {cooldown}\nInitial Cooldown: {initialCooldown}",
  "range": "Range: {range}",
  "rangeGlobal": "Global",
  "initialEnergy": "Initial Energy: {energy}"
}
```

The data export requires terms and glossary metadata, identical hero and slot coverage across languages, and valid glossary references. It warns about missing heroes, invalid tag pins and initial-energy discrepancies. `hasSkillLocale` reads the English skill file names, without loading any language, to gate links and inspect gestures.

Chrome names live in `src/locales/character/<slug>.json`. English and Chinese are curated; the data export writes the Korean ones, the game's own, from the feed.

## Loading languages

```
  npm run data ──▶ src/pack/text/skill/<code>/*.json
                            │
                            ▼
              one lazy chunk per language (index.ts)
                            │
                            ▼
                     loadSkillLocale ◀── route guard, modal,
                            │             search, App.vue
                            ▼
                 synchronous getters ──▶ SkillSections, search
```

Each `index.ts`, which `npm run data` writes for every language in `SKILL_LOCALES` that the pack holds, eagerly imports its directory into one lazy chunk. `loadSkillLocale` shares a promise per language and drops rejected promises for retry. `SkillSections` reads synchronously and takes heroes, terms, glossary and charms from one loaded language, falling back together to English if available.

`warmSkillLocale` in `src/router/routes.ts` awaits the chunk before rendering a skill route. Without it, vite-ssg's single pass would bake missing text and descriptions. It uses global `beforeResolve` because `beforeEnter` skips language switches that change only route parameters. A failed mid-session load hard-navigates to fresh HTML; an initial-load failure allows the reader's fallback or load-error message.

`useModalSkillLocale` keeps the previous text during a switch, ignores outdated load results and tries English on failure. Outside skill routes, `App.vue` warms `effectiveSkillLocale` after the initial route settles.

Pre-rendered skill pages preload their language chunk. The build resolves it through `dist/.vite/ssr-manifest.json`, keyed by the language's `index.ts`: filenames alone are ambiguous because a dependency can share a language prefix.

## Text and names

`src/utils/textHighlight.ts` defines the shared grammar: `[[value]]` highlights, `[[label|key]]` looks up a glossary tooltip, and `{atk}`-style tags render stat pills. Search, import validation and description extraction share its token parser. `SkillKeywordTooltip` delegates events from the reader's article because keyword spans come from `v-html`.

`heroDisplayName` falls back from `_hero.name` in the text locale to the curated English name, then the slug. Chrome names also serve as search aliases.

## Cooldowns and range

The data export writes the language-independent `src/pack/text/skill/numbers.json`, which holds each slot's level-one values and only later changes, so a page listing every level can show a value chain. These are base values; changes from other skills remain in those skills' text.

Initial energy has a separate source: the hero data file's first `energy` number. The ultimate displays that base value, while tooltips and filters also count subsequent numbers added by skills. The data export reports discrepancies with the feed rather than overwriting hand-maintained hero data.

## Pages and meta

Hero-list links retain a hero page's text locale; elsewhere they use `effectiveSkillLocale`: the saved globe choice, else the chrome locale. Picking a site language clears the globe preference and switches a skill page's URL. A `?l=` link sets only the chrome locale. Prefix and saved-language precedence are defined in [Pre-Rendering](./PRE_RENDERING.md#two-locale-axes).

`setupSkillContentMeta` sets page titles, Open Graph tags, canonical URLs and language alternates. It owns `<html lang>` through a token so an older reader's unmount cannot clear a newer reader's language. Modals provide `ContentInModalKey` to leave the host page's head untouched.

Descriptions are extracted at build time from the first article's first two skill-text paragraphs, excluding `.skill-meta`, then stripped and truncated at 150 characters. `SkillSections` must remain the only `<article>` on a skill page, or this extraction can silently read the wrong content. A miss warns and retains the default description.

## Tags

Tags are hand-maintained in `src/data/character/<slug>.json`; the data export only validates their pins:

```jsonc
"tags": {
  "special-target": [{ "skill2": 1 }],
  "temp-buff": [{ "ultimate": 1 }, { "skill3": 1, "mods": ["opening"] }],
  "debuff": [{ "ex": 1, "mods": ["eryndor", "global"] }]
}
```

Each attachment describes one effect and pins exactly one `{ slot: level }` or `{ "charm": tier }`. Charm pins are not written in the hero file: they are joined at load time from the charm's own tags ([Seasonal Content](./SEASONAL.md#charms)). Separate effects on the same level need separate attachments. Optional `mods` are label keys or hero slugs denoting synergies. A `TagPick` matches only when one attachment carries every requested modifier, so modifiers on unrelated effects cannot combine into a match.

`tagVocabulary` derives tags and modifiers from hero data; labels live in `src/locales/app/<key>.json`. A tag whose attachments all carry the same single modifier becomes one combined entry. Synergies are excluded from that rule because they describe a partner rather than the effect. Shared rules live in `src/lib/tags.ts`, independent of the data loader, for hero lists, skill chips and the [Mechanics guide](./GUIDE.md#mechanics-page).

Within each tag, chips merge picks that match identical attachments, so any of the merged picks activates the chip. Synergies have no skill chip and are removed from incoming modal picks. Modals discard picks with no matching text.

Active chips combine as any-of and show matching slots or charms in full, accenting matching levels or tiers. A tagged upgrade cannot stand alone because its text depends on earlier levels. EX refinements have no tags and remain with their slot without accents.

### Initial energy filter

`src/lib/mechanics.ts` extends tag picks with an energy pick. It matches total initial energy strictly above the threshold, including skill contributions. Energy belongs to a hero rather than a skill level, so it contributes no modal chips.

`useEnergyValue` shares the threshold across hero lists and the Mechanics guide, in memory only, starting at 500 to match pre-rendered pages.

### Mechanic links

The `/skills` index replaces its query when the mechanic filter changes, making the current list shareable without adding Back steps. Hero pages read the query without writing it. Faction and class filters are not serialized. `/skills` and the Mechanics guide accept one pick:

| Parameter | Example          | Holds                                                                    |
| --------- | ---------------- | ------------------------------------------------------------------------ |
| `tag`     | `debuff`         | A tag in use in the hero data.                                           |
| `mods`    | `eryndor,global` | Optional modifiers, comma-separated and sorted, each in use under `tag`. |
| `energy`  | `500`            | A whole hundred from 0 to 900, written as the plain number.              |

```
/skills?tag=debuff&mods=eryndor,global
/guide/mechanics?tag=temp-buff&mods=opening#temp-buff
/skills?energy=500
/guide/mechanics?energy=500#init-energy
```

The guide index adds the card id as a fragment: the tag or `init-energy`. Unknown tags or modifiers, invalid energy values or spellings (`0500`), repeated parameters, or energy combined with tag parameters apply no filter. Silently narrowing or widening a malformed pick would misrepresent its author's selection. A combined entry writes its modifier (`?tag=ult&mods=opening`), and `?tag=ult` reads identically. Queries apply after mount because pre-rendered HTML has no query state.

## Commentary snippets

Optional commentary lives at `src/content/skill/<slug>/<HeroNameCamelCase>.<lang>.vue`, with one file per app locale. The text locale wins when it is an app locale, then chrome, then English. `SkillSnippets` teleports named slots into `useSnippetAnchors` refs, which exist only after mount, keeping commentary out of pre-rendered descriptions. Without anchors it renders inline in slot order. `GridSnippet` resolves portraits so snippet data files need no image imports. A board that shows which units a skill takes puts a hero on every candidate, dims the ones it passes over (`dimmed`) and lights the border of the ones it takes (`outlined`). A board that shows an order numbers the tiles instead, since a number on a portrait is hard to read, and colours them by ring only when the order runs through more than one ring. A ring that runs off the board is completed with a dashed tile (`imaginaryHexes`) carrying the number that tile would have in the order. The casting hero's tile is left uncoloured unless the colour groups it with other tiles, such as Aliceth's row or Nara's mirror tile.

## Search

`SkillSearchOverlay` mounts once at the app root and teleports after mount. Its select mode returns a hero to the opener; route changes close it so a handler cannot outlive its page. Results link to `/<hit locale>/skill/<slug>#<slot>` using reader section ids and the router's scroll behavior.

Matching in `useSkillSearch` follows these rules:

| Rule     | Behavior                                                                                                  |
| -------- | --------------------------------------------------------------------------------------------------------- |
| Corpus   | Every warm language; the first non-empty query loads missing chunks and re-runs as each arrives.          |
| Names    | Localized hero names plus chrome name aliases, which work before any chunk loads. One character suffices. |
| Deep     | From 3 characters (2 for Han, kana or Hangul), includes skill names, descriptions and charm text.         |
| Priority | Text locale, then chrome locale, then table order; each hit records and links to its matched language.    |
| Dedup    | One hit per hero and slot at the lowest level, one charm slot, at most 3 hits per hero.                   |
| Ranking  | Name matches first, then hit count, then curated name.                                                    |
| Picker   | `matchCharacterNames` searches the same names in warm languages without loading chunks.                   |

## Stored preferences

| Key                             | Example   | Holds                                                                                                                                                                                |
| ------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `stargazer.skillLocale`         | `"ja"`    | The globe menu's text language, one of `SKILL_LOCALES`. Anything else follows the app language. Removed when a site language is picked.                                              |
| `stargazer.skillLocaleHintSeen` | `"1"`     | Present once the skill-language tip is dismissed.                                                                                                                                    |
| `stargazer.recentHeroes`        | see below | Recently viewed hero slugs, newest first, at most 5. Entries that are not strings are dropped.                                                                                       |
| `stargazer.tags.expanded`       | `"0"`     | `"0"` while hero lists show the mechanic filter as its menu, `"1"` while they show it as chips. Anything else, or no value, reads as chips. Phones use the menu without changing it. |

```json
["valen", "rowan", "athalia"]
```
