# Skill Pages

Three surfaces show a hero's in-game skill text: the `/skills` browser, the skill modal, and a pre-rendered page at `/<code>/skill/<slug>` for each of the 16 languages × every hero. Each shows the skill text, tag chips and optional commentary.

Two locale axes run through all of it. Skill text and the hero name follow the text locale (`SkillLocale`, the languages in `SKILL_LOCALES`, which is also the URL prefix). Chips, labels and the hero list follow the chrome locale (`AppLocale`, the languages in `APP_LOCALES`: en, zh and ko). No language's skill text ships in the main bundle, so a page downloads only the one it shows, yet a pre-rendered page must bake its real text in one render pass. Most of the design follows from those two facts.

## Locale files

`npm run import:skills` writes `src/locales/skill/<code>/` for every row of `SKILL_LOCALES` from the upstream data feed. The directory is prettier-ignored and never hand-edited.

| File             | Written by      | Holds                                                   |
| ---------------- | --------------- | ------------------------------------------------------- |
| `<slug>.json`    | `import:skills` | one hero's skill text                                   |
| `_terms.json`    | `import:skills` | the game's slot labels and skill-panel templates        |
| `_keywords.json` | `import:skills` | glossary text for `[[label\|key]]` tokens               |
| `_charms.json`   | `import:charms` | seasonal charm text ([Seasonal Content](./SEASONAL.md)) |
| `index.ts`       | `import:skills` | the language's lazy chunk module                        |

A hero file holds the feed's localized name in `_hero.name` and one entry per slot in `SLOT_ORDER`. A slot has a name `n`, descriptions `d` where `d[i]` is level i+1, and on `ex` only, refinement tiers `r`. `SLOT_ORDER` is both the render order and the set of slot names commentary snippets can fill.

`_terms.json` holds the game's own labels in that language. `ultimate` and `ex` are the heading prefixes of those two slots, and the rest are the skill panel's templates, where `${1}` and `${2}` stand for the values.

```json
{
  "ultimate": "Ultimate",
  "ex": "Exclusive Equipment",
  "cooldown": "Cooldown: ${1}\nInitial Cooldown: ${2}",
  "range": "Range: ${1}",
  "rangeGlobal": "Global",
  "initialEnergy": "Initial Energy: ${1}"
}
```

Files starting with `_` hold per-language data rather than a hero. They travel in the same globs and chunks, and `splitSkillDict` separates them at load time, so slug walks and the search index see only heroes. The pre-render route walk skips them too.

The importer requires `_meta.terms` and `_meta.keywords` in each feed. It fails when languages disagree on the hero set or a hero's slot set, or when a keyword token has no glossary entry. Heroes missing from the feed, tag attachments pointing at a slot or level the hero lacks, hero files whose initial energy differs from the feed's, and locale directories not in `SKILL_LOCALES` are warnings. It only writes files whose content changed. Adding a language is one `SKILL_LOCALES` row (the `feed` column maps the feed's own code to the BCP-47 `code`) and a re-run.

The importer also lists the heroes it wrote text for in `src/data/skill/heroes.json`, a sorted array of slugs. `hasSkillLocale(slug)` answers from that list, so it needs no language loaded, and because every language must cover exactly the en hero set, one list answers for all 16. It gates the inspect gesture, the modal and the reader, so a hero with data but no text never shows a dead link.

Hero names on chrome surfaces come from `src/locales/character/<slug>.json`, one name per app locale. The en and zh names there are curated by hand. The importer writes the others (`FEED_NAMED_LOCALES`, today ko) from the feed's own name on every run.

## Loading languages

```
  import:skills ──▶ src/locales/skill/<code>/*.json
                            │
                            ▼
              one lazy chunk per language (index.ts)
                            │
                            ▼
                     loadSkillLocale ◀── warmSkillLocale, modal,
                            │             search, App.vue
                            ▼
      getSkillLanguage, getSkillFile, getSkillLocaleDict:
      synchronous, null until the language is warm
```

Every language is one chunk: its `index.ts` globs its own directory eagerly, so a single dynamic import brings in the whole language. `loadSkillLocale` caches the promise per language and evicts a rejected one, so the next call asks again. Chrome remembers a failed import and repeats the failure until the page is reloaded, which is why the could-not-load line asks for a reload. Components render through the synchronous getters, which keeps `SkillSections` a synchronous component.

A loaded language is one object: its heroes, terms, glossary and charm text. `SkillSections` picks one language, the one it was asked for or en when that one is not warm, and takes all four from it, so the labels and tooltips are always in the language of the text.

Outside skill pages nothing has asked for a language yet, so `App.vue` fetches `effectiveSkillLocale` in the background once the first route has settled, and the first skill popup or text search finds it warm. It waits for the route to tell a skill page apart, and skips that page, which has loaded the language it shows.

That puts the burden on whoever navigates. `warmSkillLocale` (`src/router/routes.ts`) awaits the chunk before any `skill` route resolves. vite-ssg renders each route once with no `<Suspense>`, so without the guard a page would bake the could-not-load line in place of its text and have no description to derive from it. The guard is a global `beforeResolve` because `beforeEnter` skips param-only navigation, and the globe menu's language switch is exactly that. If the chunk fails mid-session (offline, or a stale tab after a deploy), the guard hard-navigates to the target URL to pick up fresh HTML. On the initial load it proceeds, and the reader shows en if that happens to be warm, otherwise a line saying the text could not be loaded.

The modal awaits its own load (`useModalSkillLocale`) and keeps showing the previous language until the new one arrives. When a language cannot be fetched it tries en, and when it has no text to keep and none arrives it shows the same line. On every pre-rendered skill page the build adds a `modulepreload` for that language's chunk, to save a round trip on cold loads. The chunk's file comes from the build's own manifest (`dist/.vite/ssr-manifest.json`), keyed by the language's `index.ts`; file names cannot identify it, since a dependency's `es-<hash>.js` sits beside the Spanish chunk.

## Text and names

Skill text uses one small grammar in `src/utils/textHighlight.ts`: `[[value]]` is a highlight, `[[label|key]]` is a keyword whose tooltip text is `key` in that language's `_keywords.json`, and `<ATK>`-style tags are stat pills. `HIGHLIGHT_RE` and `splitHighlightToken` are imported by search, both importers and `vite.config.ts`, so validation, rendering and the description scrape cannot disagree. Keyword spans sit in `v-html` output, so `SkillKeywordTooltip` listens on the `SkillSections` article instead of on each span.

A hero's display name is `_hero.name` in the text locale, then the curated en name, then the slug (`heroDisplayName`). The app-locale names in `src/locales/character/` stay on chrome surfaces and serve as search aliases. The ultimate and EX headings are the `_terms.json` label plus the skill name.

## Cooldowns and range

A line under a skill's heading shows what the game's own skill panel shows: cooldown, initial cooldown and range. The numbers are the same in every language, so `import:skills` writes them once, to `src/data/skill/numbers.json`, from the feed's language-independent numbers file. The rules for what shows live in `scripts/lib/skillNumbers.ts`, and the app renders whatever the file holds.

A cooldown shows unless it is one of the game's "no timer" values (9999 and above): 0 is an instant skill and shows, and so would a long real cooldown. The initial cooldown follows the same rule, so a skill with no timed first cast (Temesia's Skill 3) shows only its cooldown. A range shows unless it is absent, and 15 tiles and above reads as the game's word for global. The same rules apply to every slot.

The game's panel shows the hero's current level, while a skill page lists every level. So the data file keeps each slot's Lv1 values plus only the values a later level changes, and the line shows a changed value as a chain in level order (Zanie's EX "Cooldown: 15 → 12", Marilee's ultimate "Range: 2 → 3"). The numbers are base values: an awakening or EX that changes another skill's cooldown says so in its text.

The ultimate's line ends with the hero's initial energy, where the game's panel shows it. That number is not in the numbers file. It is the first `energy` number of the hero's data file, the energy the hero starts a battle with on its own, and the hero tooltip and the energy filter read the same number, so the app holds it once. Energy a later skill level adds is in that level's text and in the file's second number, which only the tooltip and the filter count. The hero file is written by hand, so `import:skills` compares its first number with the feed's value on every run and lists the heroes that differ, or whose number the feed does not carry (`energyMismatches`).

The labels come from `_terms.json` (`cooldown` with one line per value, `range`, `rangeGlobal` and `initialEnergy`), so the line reads in the skill-text language, and values are bare numbers as in the game. Every label is the game's own except English range: the game's "Tiles: 1" names the unit, so the importer's `TERM_OVERRIDES` writes "Range: 1".

## Pages and meta

`SkillsBrowser` backs both `/skills` and every hero page, so the URL is the whole state. Hero-list links point at the page's text locale on a hero page, and at `effectiveSkillLocale` (the saved globe choice in `stargazer.skillLocale`, else the chrome locale) on the index and on other surfaces with no text locale of their own. The globe menu (`SkillLocaleMenu`) picks the text locale and saves it. The header's language menu picks the chrome locale and resets the text locale to it (`pickLocale`): the saved globe choice is dropped, and a skill page moves to the picked language's URL, from a text-only prefix such as `/ja/` too. A `?l=` link sets the chrome locale and leaves a globe choice alone. The two axes also meet when the text locale is an app locale and the visitor has saved no site language: the prefix then stands in as the chrome locale ([Pre-Rendering](./PRE_RENDERING.md)), so `/ko/skill/<slug>` is pre-rendered, and reads for a new visitor, in Korean throughout. A saved site language stays in place around the text.

`setupSkillContentMeta` runs in `SkillSections` on the server and the client. It sets the title, Open Graph tags, canonical and `hreflang` alternates for every language, and takes `<html lang>` for the text locale through an owner token, so keyed remounts in either order cannot clear a newer owner. The modal provides `ContentInModalKey`, which skips all of this so the popup leaves the host page's head alone.

The meta description is not set at runtime. The build reads the first `<article>` of each rendered skill page, takes its first two paragraphs of skill text (the numbers line under a heading is passed over by its `skill-meta` class), strips tags and `[[...]]` markers, and cuts at 150 characters on a word boundary (spaceless text such as zh cuts at 150). `SkillSections` must stay the only `<article>` on a skill page: a different root tag or an earlier article would silently change every description. A miss logs a warning and keeps the default description.

## Tags

Tags live in the character data file (`src/data/character/<slug>.json`). The importer never writes them and only checks that each attachment exists in the hero's kit:

```jsonc
"tags": {
  "special-target": [{ "skill2": 1 }],
  "temp-buff": [{ "ultimate": 1 }, { "skill3": 1, "mods": ["opening"] }],
  "debuff": [{ "ex": 1, "mods": ["eryndor", "global"] }]
}
```

An attachment is one effect. It names where the effect is pinned, as `{ slot: level }` or as `{ "charm": tier }` for a tag the hero's charm carries ([Seasonal Content](./SEASONAL.md)), and it may list modifiers (`mods`) that describe that effect. Two effects on the same skill level are two attachments, so modifiers that share an attachment always describe the same effect. A modifier is a label key such as `opening` or `global`, or a hero's slug, which marks a synergy with that hero and reads "Eryndor Synergy". `tests/unit/lib/tags.test.ts` checks the hero data: every tag and modifier has a label, every tag has an attachment, and every attachment pins one slot the app knows.

Nothing declares the list of tags or modifiers: `tagVocabulary` reads it from the hero data, so adding either is data plus one label file, `src/locales/app/<key>.json`. A tag whose every attachment carries the same single modifier leaves nothing to choose under it, so it shows everywhere as one entry ("Ult (Opening)") with no plain "Ult" beside it.

A pick (`TagPick`) is a tag plus the modifiers wanted, and a hero satisfies it when one attachment of that tag carries all of them. The rules live in `src/lib/tags.ts`, which does not import the data loader, so the hero-list filter, the chips and the Mechanics guide share one copy. The hero-list filter holds one pick: a tag from its menu, then that tag's modifiers as chips. The menu can be swapped for a row of chips, one per entry; that choice is one value for every hero list (`useMechanicsExpanded`), kept in `stargazer.tags.expanded` ([Stored preferences](#stored-preferences)). Phones always show the menu and leave the stored choice as it is.

A hero's chip strip has one chip per tag and one per modifier the hero carries under it ("Temp Buff", "Temp Buff (Opening)"). Active chips combine as any-of and filter whole slots: a slot or charm with a level or tier that an active chip matches shows in full, with those rows accented, and the rest are hidden. An upgrade line reads only against the levels before it, so a tagged level is never shown alone. Refinement rows carry no tags, so they show with their EX slot and are never accented. The skill modal opened from a filtered picker or Rosters list, or from the Mechanics guide, starts on that filter's chips, less any the hero has no skill text for. The Skills page's own list links to the skill page, which opens unfiltered.

### Initial energy filter

One entry of the hero-list filter's menu is not a tag. It keeps the heroes whose total initial energy is above a value, and the total is the numbers of the hero file's `energy` added up: the hero's own, then what its skills add. The value moves in steps of 100 from 0 to 900 and starts at 500, and a hero with exactly the value is left out. The rule lives in `src/lib/mechanics.ts` beside the tag rules, and a filter holds a `MechanicPick`: a tag pick or an energy pick.

Energy belongs to the hero, not to a skill level, which is why it is not a tag. A hero's chip strip never shows it, and a skill modal opened from a list filtered by energy opens unfiltered. The menu entry is unavailable only when no hero in the list has any energy, since a zero count at the current value can still be stepped down. The value is one ref for every hero list and the Mechanics guide (`useEnergyValue`), so no list filters by a different number than another's menu names. It lives in memory only, so every load starts at the 500 the pre-rendered pages carry.

### Mechanic links

A slot heading's chips link to the hero list filtered by that chip, and the guide index links to the Mechanics guide the same way. `/skills` and the Mechanics guide each read one pick from the query, a tag or an energy value:

| Parameter | Example          | Holds                                                                                  |
| --------- | ---------------- | -------------------------------------------------------------------------------------- |
| `tag`     | `debuff`         | A tag in use in the hero data.                                                         |
| `mods`    | `eryndor,global` | Optional. The pick's modifiers, comma-separated and sorted, each in use under `tag`.   |
| `energy`  | `500`            | The energy filter's value: a whole hundred from 0 to 900, written as the plain number. |

```
/skills?tag=debuff&mods=eryndor,global
/en/guide/mechanics?tag=temp-buff&mods=opening#temp-buff
/skills?energy=500
/en/guide/mechanics?energy=500#init-energy
```

The guide index adds the card's id as the fragment, which scrolls to it: the tag, or `init-energy`. A link that names an unknown tag, a modifier not in use under its tag, an energy value the filter cannot be stepped to or spelled any other way (`0500`), a parameter twice, or `energy` together with `tag` or `mods` applies no filter, because a wider or narrower one is not what the link's author saw. A tag that shows as one entry is written with its modifier (`?tag=ult&mods=opening`), and `?tag=ult` reads the same. Both pages apply the link after mount ([Pre-Rendering](./PRE_RENDERING.md)).

## Commentary snippets

An optional `src/content/skill/<slug>/<HeroNameCamelCase>.<lang>.vue` adds commentary. A hero that has a note has one per app locale, which `tests/unit/locales.test.ts` checks. `SkillSections` picks the text locale if it is an app locale, then the chrome locale, then en. Each slot of `SkillSnippets` teleports into the matching section's anchor from `useSnippetAnchors`. The anchors are template refs, unset during pre-rendering, so commentary appears only after hydration and never reaches the description scrape. Without anchors the slots render inline in slot order. A grid diagram pairs `<Hero>.data.ts` with `GridSnippet`, which resolves portraits through `loadCharacterImages`, so data files import no images.

## Search

`SkillSearchOverlay` mounts once at the app root and teleports only after mount, so pre-rendered HTML carries just the triggers. ⌘K or Ctrl+K toggles it, and `/` opens it outside text fields. The same overlay has a select mode (`useSearchOverlay().openSelect`) that hands the chosen hero to its opener, such as the Arena picker. Escape is handled in the capture phase and any route change closes the overlay, so a select handler never outlives its page. Recent picks persist under `stargazer.recentHeroes`. A result links to `/<hit locale>/skill/<slug>#<slot>`, resolved by the section ids and the router's `scrollBehavior`.

`useSkillSearch` follows these rules:

| Rule     | Behavior                                                                                                     |
| -------- | ------------------------------------------------------------------------------------------------------------ |
| Corpus   | every warm language; the first non-empty query loads the missing chunks and re-runs as each one lands        |
| Names    | `_hero.name` per warm language plus the app locales' names, which need no chunk; one character is enough     |
| Deep     | from 3 characters (2 for Han, kana or Hangul), adds skill names, descriptions and charm text                 |
| Priority | text locale, then chrome locale, then table order; each hit records the language it matched and links there  |
| Dedup    | one hit per hero and slot at the lowest level, charm hits share one slot, at most 3 hits per hero            |
| Ranking  | name matches first, then hit count, then curated name                                                        |
| Picker   | `matchCharacterNames` (the on-grid picker) searches the same names in warm languages and never loads a chunk |

## Stored preferences

| Key                             | Example   | Holds                                                                                                                                   |
| ------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `stargazer.skillLocale`         | `"ja"`    | The globe menu's text language, one of `SKILL_LOCALES`. Anything else follows the app language. Removed when a site language is picked. |
| `stargazer.skillLocaleHintSeen` | `"1"`     | Present once the skill-language tip is dismissed.                                                                                       |
| `stargazer.recentHeroes`        | see below | Recently viewed hero slugs, newest first, at most 5. Entries that are not strings are dropped.                                          |
| `stargazer.tags.expanded`       | `"1"`     | Present while the hero lists show the mechanic filter as chips. Anything else reads as absent.                                          |

```json
["valen", "rowan", "athalia"]
```

## Related documentation

- [Pre-Rendering](./PRE_RENDERING.md): the route list, hydration and hosting
- [Seasonal Content](./SEASONAL.md): charm data and the charm importer
- [Guide](./GUIDE.md): the mechanics page built from the same tags
