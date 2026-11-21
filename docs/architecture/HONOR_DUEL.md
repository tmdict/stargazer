# Honor Duel

Honor Duel is a game mode with rules of its own: a player builds a team from a shop over several rounds, and a team can field the same hero more than once. Stargazer has three parts for it. The Honor Duel tab on the Arena and Teams pages lists the mode's equipment and artifacts, the Arena page shows an Honor Duel board while that tab is open, and `/guide/hd/shop` is a calculator for the shop.

Three things make it hard:

- The mode breaks rules the Arena board is built on. A hero may stand on a team more than once, a hero carries a tier and a piece of equipment in place of its upgrades, and a side holds an artifact from the mode's own list, with a level.
- The pictures and the text come with the data pack, which is pinned apart from this repo, so a build can meet a pack that lacks what a data file lists.
- A player does not see everything that decides the next shop. Each of the eight cards comes from its own numbered source, and a locked card keeps its source from making a new one, so two shops that look the same can behave differently after a reroll.

## How it fits together

```
┌────────────────────┐   ┌────────────────────┐   ┌────────────────────┐
│ Honor Duel board   │◀──│ Honor Duel tab     │   │ shop page          │
│ a GridContext of   │   │ lists and popups   │   │ /guide/hd/shop     │
│ kind honorDuel     │   │                    │   │                    │
└───┬────────────┬───┘   └─────────┬──────────┘   └───┬───────────┬──▲─┘
    │ rules      │ on first use    │                  │   request │  │ answers
    │            └─────────────┐   │   ┌──────────────┘           │  │
    ▼                          ▼   ▼   ▼                          ▼  │
┌────────────────────┐   ┌────────────────────┐   ┌──────────────────┴─┐
│ lib/hd             │   │ duelCatalog        │   │ shop worker        │
│ unit sources and   │   │ items, names,      │   │ lib/hd/shop:       │
│ tiers, maps,       │   │ pictures, text     │   │ tables and search  │
│ the board link     │   │                    │   │                    │
└─────────┬──────────┘   └─────────┬──────────┘   └─────────┬──────────┘
          ▼                        ▼                        ▼
     src/data/hd      src/data/hd, src/locales/hd   src/data/hd/shop
                      data pack: pictures, text     data pack: odds
```

Arrows run from a part to what it reads. The tab's lists place their picks on the board, and the shop page and its worker exchange messages.

## Where the content comes from

This repo holds what the code needs to list an entry, and the data pack holds the pictures and the text.

| Content                                      | Files                                                                |
| -------------------------------------------- | -------------------------------------------------------------------- |
| Equipment and artifacts: id, tier, names     | `equipment/` and `artifact/` in `src/data/hd/` and `src/locales/hd/` |
| Creatures: id, faction, names                | `src/data/hd/creature/`, `src/locales/hd/creature/`                  |
| Trial Cards' units                           | `src/data/hd/trial.json`                                             |
| Maps and their buffs                         | `src/data/hd/maps.json`                                              |
| Shop prices, products and heroes             | `src/data/hd/shop/shop.json`                                         |
| Shop products' names, the measured odds      | `src/locales/hd/shop/`, `src/data/hd/shop/odds.json`                 |
| Pictures, effect text, creatures' skill text | data pack                                                            |

An entry's `id` is Stargazer's own number, counted from 1 in the game's listing order. A creature's is counted from 7000 instead, inside the hero ids, because a board holds a creature where it holds a hero ([Grid](./GRID.md#unit-ids)). Board links carry these ids, so an existing file's id never changes, and a new entry takes the next number after the highest in use.

## Loading

`src/utils/duelCatalog.ts` holds every glob of the equipment and the artifacts: their data files, names, pictures and text, and the creatures' skill text with it. Only the tab's lists, the mode's popups, an Honor Duel board and the shop page import it, each on first use, so a visit that opens none of them downloads none of it. A tab strip keeps every pane mounted, so `HonorDuelTab` mounts a list only once its tab is first shown.

The board's rules need none of the catalog. They read only the Trial list, the map list and the shop's facts (`src/lib/hd/`), a few small files that load with the Arena page. The board asks for the catalog when it first draws a piece of equipment (`useDuelItems`).

The text loads one language at a time, and `loadHonorDuelText` fails only when a download does, so a caller can tell a failed download from text the pack lacks. The pack can lack it, since it is pinned apart from this repo, and `npm run build` then prints a note for each list with missing entries and carries on. A pack with no Honor Duel text at all leaves the tab out of both pages (`HONOR_DUEL_IN_PACK`), and an entry the pack lacks is listed by name without its details.

## The board

The Arena page shows one of two boards: the Arena's own, or an Honor Duel board while the Honor Duel tab is open. They are two boards and not one board in two looks, because the mode's rules differ. A board carries its kind (`BoardKind` in `src/stores/gridContext.ts`), and each rule that differs asks the kind.

`useArenaBoards` changes between the two. Each board has a stored value of its own, and each value's writer encodes a board of its own kind only, so editing one board never changes what is stored for the other. A change of board writes the leaving board once and rebuilds from the other's stored value.

Each side holds one Honor Duel artifact with a level from 1 to 3, in a slot apart from the Arena's artifact. Both lists number from 1, and the Arena reads its slot's number as one of its own artifacts, arrows included ([Skills](./SKILLS.md#artifact-targeting)), so one shared slot would draw the wrong artifact.

### What a unit carries

A unit comes from one of two sources, and its source sets the tiers it may hold (`src/lib/hd/units.ts`). A hero the shop sells holds Epic, Legendary or Mythic. A Trial Card brings the units `src/data/hd/trial.json` lists for it, at the card's tier: any of the shop's heroes, heroes the shop does not sell, or creatures. A Trial unit may stand beside the hero and beside other copies of itself, so each copy is a unit under an id of its own ([Grid](./GRID.md#unit-ids)).

A creature is a Trial unit that is no hero. `loadCreatures` keeps it out of the hero list, so no hero picker, roster, skill page or import lists one, while a lookup by id still finds it, which is how the board draws it as it draws a hero. It has no skill page, so the gestures that open a hero's skills open the creature's own from the pack's creature text (`heroInspectTarget`).

A placed unit's tier and equipment are per-hero attributes under ids 101 and 102, apart from the Arena's upgrade attributes ([Grid](./GRID.md#hero-upgrade-attributes)), so a reader of either board's values finds none of the other's. `DUEL_ATTR_RULES` holds how they differ from an upgrade. A unit starts at the lowest tier its source allows, and a tier outside them moves to the nearest one inside. Equipment belongs to a side: copies of a hero on one side share a piece, and a hero that changes sides leaves its piece behind and takes the one its copies hold there. The same piece may sit on several heroes.

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
| Artifacts | artifact, level | 8, 2 | the ally side's and then the enemy side's: id and level 1 to 3, or 0 and 0 |

The units part is present with bit 0 and the artifacts part with bit 1. A board has exactly one text, and decoding is all or nothing: a spare bit set, a value outside its range, a map outside the mode's list, units out of tile order, a part marked present but empty or anything after the last field refuses the whole text. The format has no version field, for the Arena link's reasons.

The text holds heroes and creatures only. A companion is left out because its hero's skill spawns it again, and a Trial copy's number is left out because a reader hands the numbers out in tile order. Whether an id still names a unit, a piece or an artifact is the reader's question. A unit the game data lacks is dropped, and so is one its source does not bring. Placing refuses the same units, so a board never holds one a restore would drop. A tier the unit's source does not allow moves to the nearest it does, and a piece or an artifact id that names none is kept and shown as none.

`AMHAEBQAHSQUgB6gs7YAFAgA` is a board on map I with a Legendary hero and a Mythic Trial copy of it on the ally side, sharing piece 7, a creature on the enemy side and the ally's artifact 5 at level 2. Decoded, with team 1 the ally and 2 the enemy:

```json
{
  "d": 0,
  "map": "arena1",
  "units": [
    { "hexId": 4, "team": 1, "heroId": 10, "trial": false, "tier": 1, "equipment": 7 },
    { "hexId": 9, "team": 1, "heroId": 10, "trial": true, "tier": 2, "equipment": 7 },
    { "hexId": 40, "team": 2, "heroId": 7001, "trial": true, "tier": 0, "equipment": 0 }
  ],
  "artifacts": { "ally": { "id": 5, "level": 2 }, "enemy": null }
}
```

## The shop calculator

The page takes the shop in front of a player (the eight cards on show, the shop level and the badges in hand) and the heroes or equipment wanted. For each wanted item it answers twice: the first move with the best chance of getting it this round, and the first move that spends the fewest badges on average. It follows Toto's calculator and its measured odds.

The engine (`src/lib/hd/shop/`) is plain TypeScript that runs in a worker. `calculateShop` first reads the shop: it lists every way the sources could have made the cards on show, each with its chance. It then makes a goal for each wanted item, plus goals that any one of several targets meets, and gives every first move (buy a card, or reroll with a set of locks) a number for each goal.

### Best chance and fewest badges

For the best chance, a first move gets the chance of reaching the goal before the badges run out, when every later move is the best one. A later shop is reduced to a code: one digit per source, saying which useful kind of card the source shows, or none. Two tables hold a chance for every code, badge count and number of targets still needed. The ceiling table answers for a player who is told the sources, so it is never too low. The floor table answers for a player who must pick one move for every code that looks the same on screen, so it is never too high. Where the two agree the chance is known, and where they differ a search over what the player can believe about the sources narrows the range.

Fewest badges uses the same codes with two cost tables: the average badges to reach the goal for a player who never runs out. The floor is the cost when the sources are known. The ceiling is the cost of one plan a real player can follow from the cards on show, and it is the figure shown. A reroll can lead back to the same shop, so each table is recomputed until its numbers stop moving.

Stopping for the round is a move too. Each round's first shop is a free redraw of the unlocked cards, so a way to stop is a set of locks to leave, after a purchase or none, costed by what the goal takes from the next round on, against the next level's sources when the shop level rises.

`advice.ts` picks the move shown from every first move's number. It compares a chance range by its floor and a cost by its ceiling, the figures a player can count on.

### Decisions

Answers arrive in stages. The first stage has every number at once, with a range where the tables alone do not settle a chance. The search then narrows only the ranges that could change what an answer shows, and stops after `SEARCH_MS`, so a range it does not reach stays a range. A first answer is fast for every request, and the slowest request has a limit.

The tables are kept between requests. They depend on a goal's useful kinds, their prices and what each source makes of them, and not on the cards entered or the badges held. So one worker lives as long as the page (`useShopEngine`), goals with the same kinds, prices and sources share one set of tables, and a later request mostly reads what an earlier one filled. When a request ends, `solverCache.ts` drops the least recently used sets past a count and a size.

A worker at work hears no messages, so `calculateShop` pauses: after each goal is prepared, after each goal's first answer, after each stage and after every `SLICE_MS` of search. At a pause the worker takes in what the page has sent and drops a request the page no longer wants. A slice of search that runs out of time starts again from its first move and finds every shop it had finished already answered, so slicing changes no answer.

The page stores nothing. What a player enters lasts for the visit, and the tables go with the worker when the page is left.

### Rules

- The worker is the one place that chooses the odds table: the data pack's when the pack has one, else the measured table in this repo. Everything on the page reads the repo's table: the odds view, an example shop, the checks on a shop as it is entered and the probability guide's figures. `npm run build` stops unless both tables list the same products for every source (`oddsMismatch`), so a shop the page accepts can come up under either.
- Each answer carries its request's number, and the page drops an answer whose number is not the newest. Every set of answers a stage sends is whole and replaces the last.
- `SHOP_LIMITS` bounds a request: the badges, the copies of a hero, and the wanted items. A request's time and memory grow with each, so a higher limit needs the heaviest request measured again. A goal whose tables would still be too large is left out and named with the answers (`MAX_SPAN_SIZE`, `MAX_NEXT_SPAN_SIZE`, `MAX_OWN_ROWS`).

### Gotchas

- A locked card keeps its source number when the shop level rises, so a source can sit behind a product the new level never makes. `ShopReading.odds` lists that product at 0% for each source that may hold it, which gives the card a place in the tables without changing any draw. Each such card also adds a useful kind to those sources, which is what multiplies a goal's tables toward the limits above.
- The search treats cards of one kind as alike, while a player knows which one was kept through a reroll. Choosing between the kept card and a new one on purpose can beat the chance shown by a fraction of a percentage point, more as the hero pool shrinks. The chance shown is still one the player can reach.
- Copies of different heroes are never added together. The goals that span heroes exist only when every wanted hero needs one copy.
- The probability guide at `/guide/hd/shop/probability` works its numbers out from the shop's rules and the measured table (`useShopFigures`). The few that take a full calculation are typed in, in one list in that file, and hold only for the measured table and the whole hero pool.
- Vitest has no worker thread. The engine's tests call `calculateShop` directly, and the worker itself is exercised in a browser.

## Related documentation

- [Grid](./GRID.md): unit ids, Trial copies, hero attributes and the map controls
- [URL Serialization](./URL_SERIALIZATION.md): the bit and text helpers the board link shares, and how a page reads `?hd=`
- [Board Input](./DRAG_AND_DROP.md): dragging a piece of equipment onto a unit
