# Honor Duel

Honor Duel is a game mode with its own equipment and artifacts. The Honor Duel tab on the Arena and Teams pages lists them, equipment by tier and then the artifacts, and each one opens a popup with its effect text. Nothing in the tab goes on a board.

## Where the content comes from

A pack update writes all of it. This repo holds what the code needs to list an entry, and the data pack holds the pictures and the text.

| Content               | Files                                                        |
| --------------------- | ------------------------------------------------------------ |
| Equipment id and tier | `src/data/honor-duel/equipment/<name>.json`                  |
| Artifact id           | `src/data/honor-duel/artifact/<name>.json`                   |
| Names, site languages | `src/locales/honor-duel/{equipment,artifact}/<name>.json`    |
| Pictures              | data pack, `images/honor-duel/{equipment,artifact}/`         |
| Effect text           | data pack, `text/honor-duel/<language>/`, two files for each |

An entry's `id` is Stargazer's own number, counted from 1 in the game's listing order. An update never changes the id of an existing file, and a new entry takes the next number after the highest in use. An update stops, writing nothing, when a file has no entry left in its source, so a renamed entry is renamed by hand and keeps its id.

## Loading

`src/lib/honorDuel.ts` holds every glob of the content: the data files, the names, the pictures and the text. Only the tab's list and the popup import it, and both are fetched on first use, so a visit that never opens the tab downloads none of it. A tab strip keeps every pane mounted, so `HonorDuelTab` mounts the list only once its tab is first shown.

The text loads one language at a time, in the reader's skill-text language, when a popup opens. The popup shows a level only when its text differs from the level before it: an artifact's last level repeats the one before it where that level adds no effect of its own.

The pack is pinned separately from this repo, so a build can meet a pack from before a pack update. `npm run build` then prints one note for each list with entries the pack lacks and carries on. A pack with no Honor Duel text at all leaves the tab out of both pages (`HONOR_DUEL_IN_PACK`), and `?t=honorDuel` then opens the default tab. Where the pack lacks only some entries, the tab lists those by name and their popup says the details are pending.

A link opens the tab directly with `?t=honorDuel` on the Arena page.

## Formats

A data file, `src/data/honor-duel/equipment/light-armor.json`. `name` equals the file name and keys the names, pictures and text. `tier` is `rare`, `elite`, `epic` or `legendary`. An artifact file has `id` and `name` only.

```json
{
  "id": 1,
  "name": "light-armor",
  "tier": "rare"
}
```

A names file, `src/locales/honor-duel/artifact/golden-blooms.json`, with one name for each site language:

```json
{
  "en": "Golden Blooms",
  "zh": "金丝莲",
  "ko": "골든 블룸"
}
```

The pack's text, one pair of files for each skill-text language, each keyed by entry name. Numbers are marked as in skill text (`[[40%]]`). `text/honor-duel/en/equipment.json`:

```json
{
  "light-armor": {
    "name": "Light Armor",
    "description": "Gains a shield equals to [[40%]] of max HP for [[10]]s when a battle starts."
  }
}
```

`text/honor-duel/en/artifacts.json`. `levels` holds one text for each of the artifact's three levels:

```json
{
  "golden-blooms": {
    "name": "Golden Blooms",
    "levels": [
      "Restores [[30%]] Max HP for an allied hero when their HP ratio drops below [[50%]]. This effect can be triggered once every [[6]]s, up to a total of [[5]] times per battle.",
      "The cooldown is reduced to [[4.5]]s.",
      "The cooldown is reduced to [[4.5]]s."
    ]
  }
}
```
