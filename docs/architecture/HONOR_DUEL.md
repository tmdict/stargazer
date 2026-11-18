# Honor Duel

Honor Duel is a game mode with its own equipment and artifacts. The Honor Duel tab on the Arena and Teams pages lists them, the artifacts and then equipment by tier, and each one opens a popup with its effect text. With a mouse, hovering one shows a card with its effect, an artifact's at level 1. Nothing in the two lists goes on a board.

On the Arena page the tab also swaps the Arena board for an Honor Duel board, where a formation of the mode is laid out with its tiers, equipment, artifacts and off-field spots ([The board](#the-board)).

## Where the content comes from

A pack update writes all of it but the mode's map list, the Trial list, the creatures and the shop's `rounds`, which are kept by hand. This repo holds what the code needs to list an entry, and the data pack holds the pictures and the text.

| Content                 | Files                                                      |
| ----------------------- | ---------------------------------------------------------- |
| Equipment id and tier   | `src/data/hd/equipment/<name>.json`                        |
| Shop prices and goods   | `src/data/hd/shop/shop.json`                               |
| Shop odds               | `src/data/hd/shop/odds.json`                               |
| Artifact id             | `src/data/hd/artifact/<name>.json`                         |
| Trial Cards' units      | `src/data/hd/trial.json`                                   |
| Creature id and faction | `src/data/hd/creature/<name>.json`                         |
| Maps and their buffs    | `src/data/hd/maps.json`                                    |
| Names, site languages   | `src/locales/hd/{equipment,artifact,creature}/<name>.json` |
| Pictures                | data pack, `images/hd/{equipment,artifact,creature}/`      |
| Creatures' faction icon | data pack, `images/hd/icon/`                               |
| Effect text             | data pack, `text/hd/<language>/`, two files for each       |

An entry's `id` is Stargazer's own number, counted from 1 in the game's listing order. A creature's is counted from 7000 instead, inside the hero ids, because a board holds a creature where it holds a hero ([Grid](./GRID.md#unit-ids)). An update never changes the id of an existing file, and a new entry takes the next number after the highest in use. An update stops, writing nothing, when a file has no entry left in its source, so a renamed entry is renamed by hand and keeps its id.

## Loading

`src/lib/hd/catalog.ts` holds every glob of the equipment and the artifacts: their data files, names, pictures and text. The tab's list, its popup, an Honor Duel board and the shop calculator page import it, and each is fetched on first use, so a visit that opens none of them downloads none of it. A tab strip keeps every pane mounted, so `HonorDuelTab` mounts the list only once its tab is first shown.

The text loads one language at a time, in the reader's skill-text language, when a popup opens. The popup shows a level only when its text differs from the level before it: an artifact's last level repeats the one before it where that level adds no effect of its own.

The pack is pinned separately from this repo, so a build can meet a pack from before a pack update. `npm run build` then prints one note for each list with entries the pack lacks and carries on. A pack with no Honor Duel text at all leaves the tab out of both pages (`HONOR_DUEL_IN_PACK`), and `?tab=honorDuel` then opens the default tab. Where the pack lacks only some entries, the tab lists those by name and their popup says the details are pending. A creature is listed only once the pack holds its picture, and the faction filter shows a faction only once its icon is there.

A link opens the tab directly with `?tab=honorDuel` on the Arena page.

## The board

The Arena page shows one of two boards: the Arena's own, and an Honor Duel board while the Honor Duel tab is open. They are two boards and not one board in two looks, because the mode's rules differ. A hero may stand twice, a hero carries a tier, a piece of equipment and an off-field spot in place of its upgrades, and a side holds an Honor Duel artifact with a level. A board carries its kind (`BoardKind` on the board object), and each rule that differs asks the kind in one place.

`useArenaBoards` runs the change between the two. Each board is stored under a key of its own, and each key's writer encodes a board of its own kind only, so editing one board never changes the other's stored value. The Format menu, Generate and the roster menu belong to the Arena and are hidden with the Honor Duel board, and Grid Info hides the choices that mean nothing there. `/share` shows an Honor Duel link as a read-only board with its hero card.

### What a unit carries

A unit of the mode comes from one of two sources, and its source sets its tiers (`src/lib/hd/units.ts`). The shop sells its heroes, the list the shop calculator uses, and a hero from it holds Epic, Legendary or Mythic. A Trial Card brings the units `src/data/hd/trial.json` lists for it: any of the shop's heroes, heroes the shop does not sell, or creatures. A Trial unit holds the tiers of the cards that bring it, so a Trial copy of a shop hero holds Legendary or Mythic, and a unit one card brings holds that card's tier and shows it without a choice. A Trial unit may stand beside the hero and beside other copies ([Grid](./GRID.md#unit-ids)).

The picker shows the two sources as two lists, Shop and Trial, and the popup on an empty tile follows the list on show. That choice is one value for both (`useDuelList`), which lasts while the page is open and is never stored. The Trial list has a group for each card. A pick from a group carries the card's tier in its id (`toTrialPick`), so a click, a tap and a drag place a copy at that tier through the one placing path. The popup lists each Trial unit once, at the cheapest card that brings it.

A creature is a Trial unit that is no hero. It is kept out of the hero list (`loadCreatures`), so no hero picker, roster, skill page or import lists one, and a lookup by id finds it, which is how the board, the hero card and the faction bonus draw it as they draw a hero. It carries equipment and takes an off-field spot as a hero does, and it has no skill page.

A placed unit's tier, equipment and off-field spot are per-hero values under ids of their own (101, 102 and 103), apart from the Arena's upgrade values, so a reader of either board's values finds none of the other's. A unit starts at the lowest tier its source allows, and a tier outside them moves to the nearest one inside. Copies of a hero on a side share one piece of equipment: a pick goes to every copy there. A hero that changes sides leaves its piece behind, as it leaves its off-field spot, and a hero that joins a side, placed there or moved from the other side, takes the piece its copies hold there. The same piece may sit on several heroes.

An off-field spot is a note that a hero leaves the field. The hero keeps its tile and counts once, and its skill draws from its tile, so the spot shows only a faded second portrait. A side has six spots with one hero to a spot, and a hero that changes sides leaves its spot. The spots are off-grid cells like the artifact places (`src/lib/hd/spots.ts`), so placement, pathfinding and targeting never see them. They draw only while a hero holds one or picks one, and none lies wider than the board's widest row, so a board drawn as wide as a phone's screen shows them whole. Team view's crop takes in the ally's spots that draw.

### The team artifact and the faction bonus

Each side holds one Honor Duel artifact with a level from 1 to 3. It is kept apart from the Arena's seasonal artifact: both lists number from 1, and a seasonal artifact's number also picks a skill drawing, so one shared place would show the wrong thing. It draws on the board's two artifact places and nothing else on the board.

A badge by each artifact place reports the side's faction bonus (`teamFactionBonus` in `src/lib/factionBonus.ts`, beside the numbers the Faction Bonus guide page shows). Every unit of the side counts, a copy as much as the first. A Celestial or Hypogean hero stands in for any faction, so the side takes the highest step its stand-ins can complete, and each of them adds one point on top. The creatures share a faction of their own, which counts as any other does.

### What the board loads

The board's rules need none of the catalog, so the Arena page loads none of it for a visitor who never opens an Honor Duel board. The Trial list, the creature files and the names of the shop's products, which head the Trial list's groups (`src/utils/shopGoodNames.ts`), are a few small files and load with the rules. The pictures on a portrait and in the hero card ask for the catalog on first use (`useDuelItems`), and the artifact layer and the two pickers are fetched with it.

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
|           | hero            | 14   | a hero's id, 1 to 6999, or a creature's, 7000 to 8999                      |
|           | Trial           | 1    | 1 for a Trial unit                                                         |
|           | tier            | 2    | 0 Epic, 1 Legendary, 2 Mythic, 3 Supreme (a Trial unit's alone)            |
|           | equipment       | 8    | the piece's id, 0 for none                                                 |
|           | off-field spot  | 3    | 1 to 6, 0 for none                                                         |
| Artifacts | artifact, level | 8, 2 | the ally side's and then the enemy side's: id and level 1 to 3, or 0 and 0 |

The units part is present with bit 0 and the artifacts part with bit 1. A board has exactly one text, and decoding is all or nothing: a spare bit set, a value outside its range, a map outside the mode's list, units out of tile order, a part marked present but empty or anything after the last field refuses the whole text. The format has no version field, for the Arena link's reasons.

The text holds heroes and creatures only. A companion is left out because its hero's skill spawns it again, and a Trial copy's number is left out because a reader hands the numbers out in tile order. Whether an id still names a unit, a piece or an artifact is the reader's question. A unit the game data lacks is dropped, and so is one its source does not bring: without the Trial mark, a hero the shop does not sell or a creature, and with it, a unit no Trial Card brings. Placing refuses the same units, so a board never holds one a restore would drop. A tier the unit's source does not allow moves to the nearest it does. A piece or an artifact id that names none is kept and shown as none.

`AMHAEBQAHSChAPRA6KwtACgQAA` is a board on map I with a Legendary hero and a Mythic Trial copy of it on the ally side, sharing piece 7, the copy on off-field spot 2, a creature on the enemy side and the ally's artifact 5 at level 2. Decoded, with team 1 the ally and 2 the enemy:

```json
{
  "d": 0,
  "map": "arena1",
  "units": [
    { "hexId": 4, "team": 1, "heroId": 10, "trial": false, "tier": 1, "equipment": 7, "spot": 0 },
    { "hexId": 9, "team": 1, "heroId": 10, "trial": true, "tier": 2, "equipment": 7, "spot": 2 },
    { "hexId": 40, "team": 2, "heroId": 7001, "trial": true, "tier": 0, "equipment": 0, "spot": 0 }
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

### Trial units

The Trial list, `src/data/hd/trial.json`, shortened here to two units a card. `cards` lists the Trial Cards, cheapest first. `card` is the card's name among the shop's goods, and `tier` the tier of a unit it brings: `epic`, `legendary`, `mythic` or `supreme`. `units` names the heroes and creatures the card can show, by file name, and `shop` is true where the card can show any of the shop's heroes. A card has `units`, `shop` or both. A name with no hero or creature file is skipped until it has one, and the build prints a note naming it. A `tier` outside the four, or a `card` the shop does not sell as a Trial Card, stops the list from loading.

```json
{
  "cards": [
    { "card": "trial-card-6", "tier": "epic", "units": ["sandbeast-king", "icesoul"] },
    { "card": "trial-card-12", "tier": "legendary", "shop": true },
    { "card": "trial-card-22", "tier": "mythic", "shop": true },
    { "card": "trial-card-45", "tier": "supreme", "units": ["berial", "scarlita"] }
  ]
}
```

A creature's file, `src/data/hd/creature/icesoul.json`. `id` is from 7000 to 8999, `name` equals the file name and keys its names file and its picture, and `faction` is the creatures' own faction, which has a name in `src/locales/game/` like the heroes' factions.

```json
{
  "id": 7001,
  "name": "icesoul",
  "faction": "other"
}
```

Its names file, `src/locales/hd/creature/icesoul.json`, has one name for each site language, as an artifact's does.

### The shop

The calculator that reads these two files is described in [Honor Duel Shop Calculator](./HONOR_DUEL_SHOP.md).

The shop's facts, `src/data/hd/shop/shop.json`, shortened here to two of its nine rounds, three of its sixteen goods and two of its heroes. `reroll` is the price of a reroll, `sell` what a hero card sells for, and `levelRounds` the first round of each of the five shop levels. `rounds` lists the rounds from round 1, and its last entry holds for every later round: `badges` is what the round brings, with both amounts where a round can bring either of two, and `event` names the round's event by the file its words are kept in (`shop-event-<event>`). A good's `kind` is `hero`, `legendary`, `pack`, `equipment`, `trial` or `exp`: a `hero` or `legendary` good gives `copies` of one hero, a `pack` picks `draws` heroes, from one `faction` when it names one, and an `equipment` good gives a piece of its `tier`. `heroes` lists the heroes the shop sells, by hero file name.

```json
{
  "reroll": 3,
  "startingBadges": 60,
  "sell": 2,
  "levelRounds": [1, 2, 4, 6, 9],
  "rounds": [{ "badges": [60, 70] }, { "badges": [60], "event": "fitz-trial" }],
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
