# Honor Duel

Honor Duel is a game mode with its own equipment and artifacts. The Honor Duel tab on the Arena and Teams pages lists them, the artifacts and then equipment by tier, and each one opens a popup with its effect text. With a mouse, hovering one shows a card with its effect, an artifact's at level 1. Nothing in the tab goes on a board.

## Where the content comes from

A pack update writes all of it. This repo holds what the code needs to list an entry, and the data pack holds the pictures and the text.

| Content               | Files                                                |
| --------------------- | ---------------------------------------------------- |
| Equipment id and tier | `src/data/hd/equipment/<name>.json`                  |
| Shop prices and goods | `src/data/hd/shop/shop.json`                         |
| Shop odds             | `src/data/hd/shop/odds.json`                         |
| Artifact id           | `src/data/hd/artifact/<name>.json`                   |
| Names, site languages | `src/locales/hd/{equipment,artifact}/<name>.json`    |
| Pictures              | data pack, `images/hd/{equipment,artifact}/`         |
| Effect text           | data pack, `text/hd/<language>/`, two files for each |

An entry's `id` is Stargazer's own number, counted from 1 in the game's listing order. An update never changes the id of an existing file, and a new entry takes the next number after the highest in use. An update stops, writing nothing, when a file has no entry left in its source, so a renamed entry is renamed by hand and keeps its id.

## Loading

`src/lib/hd/catalog.ts` holds every glob of the content: the data files, the names, the pictures and the text. The tab's list, its popup and the shop calculator page import it, and each is fetched on first use, so a visit that opens none of them downloads none of it. A tab strip keeps every pane mounted, so `HonorDuelTab` mounts the list only once its tab is first shown.

The text loads one language at a time, in the reader's skill-text language, when a popup opens. The popup shows a level only when its text differs from the level before it: an artifact's last level repeats the one before it where that level adds no effect of its own.

The pack is pinned separately from this repo, so a build can meet a pack from before a pack update. `npm run build` then prints one note for each list with entries the pack lacks and carries on. A pack with no Honor Duel text at all leaves the tab out of both pages (`HONOR_DUEL_IN_PACK`), and `?tab=honorDuel` then opens the default tab. Where the pack lacks only some entries, the tab lists those by name and their popup says the details are pending.

A link opens the tab directly with `?tab=honorDuel` on the Arena page.

## Formats

A data file, `src/data/hd/equipment/light-armor.json`. `name` equals the file name and keys the names, pictures and text. `tier` is `rare`, `elite`, `epic` or `legendary`, and `shop` says whether the shop sells the piece. An artifact file has `id` and `name` only.

```json
{
  "id": 1,
  "name": "light-armor",
  "tier": "rare",
  "shop": true
}
```

A names file, `src/locales/hd/artifact/golden-blooms.json`, with one name for each site language:

```json
{
  "en": "Golden Blooms",
  "zh": "金丝莲",
  "ko": "골든 블룸"
}
```

The pack's text, one pair of files for each skill-text language, each keyed by entry name. Numbers are marked as in skill text (`[[40%]]`). `text/hd/en/equipment.json`:

```json
{
  "light-armor": {
    "name": "Light Armor",
    "description": "Gains a shield equals to [[40%]] of max HP for [[10]]s when a battle starts."
  }
}
```

`text/hd/en/artifacts.json`. `levels` holds one text for each of the artifact's three levels:

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

### The shop

The calculator that reads these two files is described in [Honor Duel Shop Calculator](./HONOR_DUEL_SHOP.md).

The shop's facts, `src/data/hd/shop/shop.json`, shortened here to three of its sixteen goods and two of its heroes. `reroll` is the price of a reroll, `sell` what a hero card sells for, and `levelRounds` the first round of each of the five shop levels. A good's `kind` is `hero`, `legendary`, `pack`, `equipment`, `trial` or `exp`: a `hero` or `legendary` good gives `copies` of one hero, a `pack` picks `draws` heroes, from one `faction` when it names one, and an `equipment` good gives a piece of its `tier`. `heroes` lists the heroes the shop sells, by hero file name.

```json
{
  "reroll": 3,
  "startingBadges": 60,
  "sell": 2,
  "levelRounds": [1, 2, 4, 6, 9],
  "goods": [
    { "name": "hero-pair", "price": 30, "kind": "hero", "copies": 2 },
    { "name": "mauler-pack", "price": 33, "kind": "pack", "draws": 3, "faction": "mauler" },
    { "name": "epic-equipment", "price": 40, "kind": "equipment", "tier": "epic" }
  ],
  "heroes": ["antandra", "cassadee"]
}
```

The odds, `src/data/hd/shop/odds.json`, are Toto's measured table, kept by hand. Each of the shop's eight cards comes from its own source, and `levels` holds, for each shop level, what each of the eight sources makes, in source-number order: a good's name and its share in percent, with the measured range as `low` and `high` where the table has one. `rerolls` counts the recorded rerolls behind each level. Shortened here to one source of one level:

```json
{
  "rerolls": [988],
  "levels": [[[{ "good": "random-pack", "percent": 100 }]]]
}
```

A data pack may carry a table of its own, `hd/shop/odds.json`, holding `levels` alone in the same shape, where a source that only ever shows Artifact EXP may be an empty list. `npm run build` stops when that file cannot be read as an odds table, or lists other goods for a source than the repo's table does (`checkOdds` and `oddsMismatch` in `src/lib/hd/shop/odds.ts`).
