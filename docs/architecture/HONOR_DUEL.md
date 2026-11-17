# Honor Duel

Honor Duel is a game mode with its own equipment and artifacts. The Honor Duel tab on the Arena and Teams pages lists them, the artifacts and then equipment by tier, and each one opens a popup with its effect text. With a mouse, hovering one shows a card with its effect, an artifact's at level 1. Nothing in the two lists goes on a board.

On the Arena page the tab also swaps the Arena board for an Honor Duel board, where a formation of the mode is laid out with its tiers, equipment, artifacts and off-field spots ([The board](#the-board)).

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

`src/lib/hd/catalog.ts` holds every glob of the content: the data files, the names, the pictures and the text. The tab's list, its popup, an Honor Duel board and the shop calculator page import it, and each is fetched on first use, so a visit that opens none of them downloads none of it. A tab strip keeps every pane mounted, so `HonorDuelTab` mounts the list only once its tab is first shown.

The text loads one language at a time, in the reader's skill-text language, when a popup opens. The popup shows a level only when its text differs from the level before it: an artifact's last level repeats the one before it where that level adds no effect of its own.

The pack is pinned separately from this repo, so a build can meet a pack from before a pack update. `npm run build` then prints one note for each list with entries the pack lacks and carries on. A pack with no Honor Duel text at all leaves the tab out of both pages (`HONOR_DUEL_IN_PACK`), and `?tab=honorDuel` then opens the default tab. Where the pack lacks only some entries, the tab lists those by name and their popup says the details are pending.

A link opens the tab directly with `?tab=honorDuel` on the Arena page.

## The board

The Arena page shows one of two boards: the Arena's own, and an Honor Duel board while the Honor Duel tab is open. They are two boards and not one board in two looks, because the mode's rules differ. A hero may stand twice, a hero carries a tier, a piece of equipment and an off-field spot in place of its upgrades, and a side holds an Honor Duel artifact with a level. A board carries its kind (`BoardKind` on the board object), and each rule that differs asks the kind in one place.

`useArenaBoards` runs the change between the two. Each board is stored under a key of its own, and each key's writer encodes a board of its own kind only, so editing one board never changes the other's stored value. The Format menu, Generate and the roster menu belong to the Arena and are hidden with the Honor Duel board, and Grid Info hides the choices that mean nothing there. `/share` shows an Honor Duel link as a read-only board with its hero card.

### What a hero carries

The mode's heroes come from the shop's facts, the list the shop calculator uses. A pick places the hero, or with the Trial switch on a Trial copy of it, which may stand beside the hero and beside other copies ([Grid](./GRID.md#unit-ids)).

A placed hero's tier, equipment and off-field spot are per-hero values under ids of their own (101, 102 and 103), apart from the Arena's upgrade values, so a reader of either board's values finds none of the other's. Supreme is a Trial hero's tier alone. Copies of a hero on a side share one piece of equipment: a pick goes to every copy there, and a copy placed later takes the piece its hero holds. The same piece may sit on several heroes.

An off-field spot is a note that a hero leaves the field. The hero keeps its tile and counts once, and its skill draws from its tile, so the spot shows only a faded second portrait. A side has six spots with one hero to a spot, and a hero that changes sides leaves its spot. The spots are off-grid cells like the artifact places (`src/lib/hd/spots.ts`), so placement, pathfinding and targeting never see them. They draw only while a hero holds one or picks one, and none lies wider than the board's widest row, so a board drawn as wide as a phone's screen shows them whole.

### The team artifact and the faction bonus

Each side holds one Honor Duel artifact with a level from 1 to 3. It is kept apart from the Arena's seasonal artifact: both lists number from 1, and a seasonal artifact's number also picks a skill drawing, so one shared place would show the wrong thing. It draws on the board's two artifact places and nothing else on the board.

A badge by each artifact place reports the side's faction bonus (`teamFactionBonus` in `src/lib/factionBonus.ts`, beside the numbers the Faction Bonus guide page shows). Every hero of the side counts, a copy as much as the first. A Celestial or Hypogean hero stands in for any faction, so the side takes the highest step its stand-ins can complete, and each of them adds one point on top.

### What the board loads

The board's rules need none of the catalog, so the Arena page loads none of it for a visitor who never opens an Honor Duel board. The pictures on a portrait and in the hero card ask for the catalog on first use (`useDuelItems`), and the artifact layer and the two pickers are fetched with it.

## Formats

### The board link

An Honor Duel board travels as `?hd=<text>` on `/` and `/share`, and the same text is the stored value of `stargazer.hd.board`. The text is bit-sequential and least significant bit first in the Arena link's URL-safe alphabet ([URL Serialization](./URL_SERIALIZATION.md)), with a layout of its own:

| Part      | Field           | Bits | Holds                                                                      |
| --------- | --------------- | ---- | -------------------------------------------------------------------------- |
| Header    | view switches   | 8    | the Arena link's display flags; bits 5 to 7 are zero                       |
|           | map             | 6    | the wire id of one of the mode's maps                                      |
|           | parts           | 8    | bit 0 units, bit 1 artifacts; bits 2 to 7 are zero                         |
| Units     | count           | 4    | 1 to 15                                                                    |
| Each unit | tile            | 6    | 1 to 45; units come in rising tile order                                   |
|           | team            | 1    | 0 ally, 1 enemy                                                            |
|           | hero            | 14   | the hero's id, 1 to 8999                                                   |
|           | Trial           | 1    | 1 for a Trial copy                                                         |
|           | tier            | 2    | 0 Epic, 1 Legendary, 2 Mythic, 3 Supreme (a Trial copy's alone)            |
|           | equipment       | 8    | the piece's id, 0 for none                                                 |
|           | off-field spot  | 3    | 1 to 6, 0 for none                                                         |
| Artifacts | artifact, level | 8, 2 | the ally side's and then the enemy side's: id and level 1 to 3, or 0 and 0 |

The units part is present with bit 0 and the artifacts part with bit 1. A board has exactly one text, and decoding is all or nothing: a spare bit set, a value outside its range, a map outside the mode's list, units out of tile order, a part marked present but empty or anything after the last field refuses the whole text. The format has no version field, for the Arena link's reasons.

The text holds heroes only. A companion is left out because its hero's skill spawns it again, and a Trial copy's number is left out because a reader hands the numbers out in tile order. Whether an id still names a hero, a piece or an artifact is the reader's question: a hero the game data lacks is dropped, and a piece or an artifact id that names none is kept and shown as none.

`AMHAEBQAHSChAPxA6DkAACgQAA` is a board on map I with a Legendary hero and a Supreme Trial copy of it on the ally side, sharing piece 7, the copy on off-field spot 2, an Epic hero on the enemy side and the ally's artifact 5 at level 2. Decoded, with team 1 the ally and 2 the enemy:

```json
{
  "d": 0,
  "map": "arena1",
  "units": [
    { "hexId": 4, "team": 1, "heroId": 10, "trial": false, "tier": 1, "equipment": 7, "spot": 0 },
    { "hexId": 9, "team": 1, "heroId": 10, "trial": true, "tier": 3, "equipment": 7, "spot": 2 },
    { "hexId": 40, "team": 2, "heroId": 115, "trial": false, "tier": 0, "equipment": 0, "spot": 0 }
  ],
  "artifacts": { "ally": { "id": 5, "level": 2 }, "enemy": null }
}
```

### The catalog

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
