# Honor Duel Shop Calculator

The page at `/guide/hd/shop` answers one question about the Honor Duel shop in front of a player: what to do first. The player enters the eight cards on show, the shop level, the badges in hand and the heroes or equipment wanted. For each wanted item the page shows two answers, the move with the best chance of getting it this round, and the move that spends the fewest badges on average.

The hard part is that a player does not see everything that decides the next shop. Each of the eight cards comes from its own numbered source, and a locked card keeps its source from making a new one. Two shops that look the same can therefore behave differently after a reroll. The calculator follows Toto's calculator and its measured odds; the data shapes are in [Honor Duel](./HONOR_DUEL.md).

## How it works

```
 page (form, shop window)                 worker
┌──────────────────────────┐  request   ┌─────────────────────────────────┐
│ useShopForm              │──────────▶ │ calculateShop                   │
│ useShopEngine            │            │  read the shop: which source    │
│                          │  answers,  │  could have made each card      │
│ answer cards, stop plans │◀────────── │  one goal per wanted item       │
└──────────────────────────┘  in stages │  best chance  │  fewest badges  │
                                        │  stopping     │  advice         │
                                        └─────────────────────────────────┘
```

A press of Calculate sends one request to the shop worker. `calculateShop` first reads the shop: it lists every way the sources could have made the cards on show, each with its chance. A shop no source assignment explains is refused as impossible, and the page says why (`shopProblems`): a product the level never sells, adding that a locked card could have kept it when a lower level sells it, a product of a locked or bought card that no level it can be read at sells, or more cards of some products than the sources that make them, since each source makes one card. For the last it names the fewest products that clash and those sources. A locked card may name the lower shop level it was locked at (`lockedAt`), and is then read against that level's sources: the card shows the level as a label wherever a lower level sells its product, and a press on the label offers those levels. A locked card of a product the level never sells was kept from a lower level, and is read against the nearest level that sells it unless it names another. It then makes one goal for each wanted item, a goal for "any wanted piece", and goals for "any wanted hero" and "any target" when every hero needs a single copy. A goal is left out when its tables are too large to fill in good time, and the page names it under the answers: a goal that spans targets by its size at this level (`MAX_SPAN_SIZE`) or at the level the shop rises to next round (`MAX_NEXT_SPAN_SIZE`), and a wanted item's own goal when the press has too few table rows left for it (`MAX_OWN_ROWS`).

The form asks for the shop level and whether it goes up next round, since a player can see both in the game and seldom knows the round. A level that lasts one round always goes up and the last level never does (`risesNext`), so the switch is the player's only in between. When the level rises next round, stopping is measured against the next level's sources, and the form says so beside Calculate.

Random fills the shop window with an example shop of the level (`sampleShop`): one card from each source at the repo table's odds, in a random order. Clear empties the window. Each takes a second press once anything is entered.

An answer can be recalculated from a move it recommends. For a reroll, the page sets the recommended locks on the shop and calculates again. For a purchase, the shop stays as entered and the request names the purchase in `startFrom`, so the best-chance comparison starts from buying it first. A reroll that would unlock a card kept from a lower level is handled as a purchase is, since the shop cannot be read with that card unlocked.

### Best chance

For one goal, each first move (buy a card, or reroll with a set of locks) gets the chance of reaching the goal before the badges run out, when every later move is the best one.

A later shop is reduced to a code: one digit per source, saying which useful kind of card the source shows, or none. Two tables hold a chance for every code, badge count and number of targets still needed. The ceiling table answers for a player who is told the sources, so it is never too low. The floor table answers for a player who must pick one move for every code that looks the same on screen, so it is never too high. Where the two agree, the chance is known. Where they differ, a search over what the player can believe about the sources narrows the range.

### Fewest badges

The same codes carry two cost tables: the average badges to reach the goal for a player who never runs out. The floor is the cost when the sources are known. The ceiling is the cost of one plan a real player can follow from the cards on show. The page shows the ceiling. A reroll can lead back to the same shop, so each table is recomputed until its numbers stop moving.

### Stopping

Each round's first shop is a free redraw of the unlocked cards. A way to stop is a set of locks to leave, after a purchase or none, and it is costed by what the goal takes from the next round on. Fewest badges says to stop when its cheapest move cannot be paid for, when that move leaves no chance this round, or when the shop level rises next round and waiting is cheaper by more than a reroll. The answer then names the cheapest way to stop among those it compares: no purchase or any one purchase the badges allow, with any of the other cards that can help the goal left locked and the locks already set on the rest all kept or all dropped, and each reroll's set of locks with no purchase.

### Advice

Every first move has a number; the advice rules pick the one shown. A move replaces the one the shop is set up for only when its chance is higher by 0.005 of a point, so an answer never advises a change that gains nothing. Costs within 0.05 badges count as equal, and among equal ways to stop the one that gives up fewer of the locks already set comes first. A chance range is compared by its floor and a cost by its ceiling, the figures a player can count on.

## Decisions

Answers arrive in stages. The first stage has every number at once, with a range where the tables alone do not settle a chance. The search then narrows only the ranges that could change what a card shows, and stops after the worker's `SEARCH_MS`. A range it does not reach stays a range. This keeps a first answer fast for every request and puts a limit on the slowest one.

The work runs in one worker. The tables depend on the goal's useful kinds, their prices and what each source makes of them, and not on the cards entered or the badges held. The worker keeps them between requests, so a later press on the same shop visit mostly reads what an earlier one filled. Goals whose useful kinds, prices and sources are the same share one set. Nothing is dropped while a request runs: a later goal with the same kinds would build its set again, and the request still holds most of the sets it asked for, so little memory would be freed. When it ends, the cache keeps at most 32 sets of tables and about 100 MB, and drops the least recently used past either, never the set last used.

A worker at work hears no messages, so the calculation pauses: after each goal is prepared, after each goal's first answer, after each stage, and after every `SLICE_MS` a move's search has run. At a pause the worker takes in what the page has sent and drops a request the page no longer wants. A slice of search that runs out of time starts again from its first move and finds every shop it had finished already answered, so slicing changes no answer. Cancel keeps the answers already shown; an edit to the form clears them, because they no longer belong to what is entered. Neither loses the kept tables. The worker ends when the page is left.

The page stores nothing. What a player enters lasts for the visit to the page.

The odds view always shows the measured table in this repo, with its measured ranges.

The probability guide at `/guide/hd/shop/probability` explains the shop's formulas. Its text is written per language in `src/content/hd/`, and every number in it, tables and examples alike, is worked out from the shop's rules and the measured table (`useShopFigures`), never typed into the text. The exceptions are under Observations 1 and 2: the badge count at which locking a one-copy card and buying it change places, and the example chances of locking and of buying, are results of full calculations on the measured table, most of them quoted from Toto's calculator. The page runs no such calculation, so they are typed in, in one list beside the worked-out figures, and are checked again when the measured table or the hero pool changes.

## Rules

- The worker is the one place that chooses the odds table: the data pack's when the pack has one, else the repo's. Nothing on the page reads the pack's table. The odds view, Random, the levels a locked card may name and the guide's figures use the repo's table, and the build stops unless both tables list the same products for every source, so an example shop can come up under either.
- Each answer carries its request's number, and the page drops an answer whose number is not the newest. An answer to earlier inputs is never shown.
- Every set of answers a stage sends is whole and replaces the last.
- `SHOP_LIMITS` bounds a request: the badges, the copies of a hero, and the wanted items, heroes and pieces together. The tables' time and memory grow with the badges and the copies, and the time with each wanted item where the cards on show are wanted ones, so a higher limit needs the speed of the heaviest request measured again. The form stops taking wanted items at the limit and says so beside its heading.
- A chance shows one decimal, two under 1%, and "100%" from 99.95% up. A range shows only when it is 0.1 of a point wide or more.

## Gotchas

- A locked card keeps its source number when the shop level rises. The stopping answer depends on it: a lock kept across the level change blocks that source in the next level's table. The reading of a later round depends on it too: `ShopReading.odds` lists a carried card's product at 0% for each source that may hold it, so the card can be bought or kept without changing any draw. Only a locked card is read this way, and a card bought while it was locked: the same card with its lock taken off is refused.
- A card kept from a lower level adds a useful kind to every source that may hold it, and a goal's tables hold every mix of kinds over the eight sources. A goal that spans targets counts most products as useful, so a few kept cards multiply its size many times over: with none, the largest such goal is about a quarter of `MAX_SPAN_SIZE`, and with five it can pass it five times. When the shop level rises next round, every card on show adds a kind to the next level's sources the same way. A goal has cost tables alone there, about a third of the work for its size, so it has a limit of its own (`MAX_NEXT_SPAN_SIZE`); a shop with nothing kept from a lower level reaches about a third of it. A wanted item's own goal is far smaller, but its chance tables hold a row for every count of copies still needed at every count of badges, so its work is its size times the two. The own goals of a press share one limit on those rows (`MAX_OWN_ROWS`), since a press may hold twelve of them: they take from it in the order the items are listed, goals that share one set of tables count once, and a goal that would pass what is left is left out. A shop with nothing kept from a lower level stays far under the limit with twelve heroes at four copies and the most badges, and six kept cards can pass it with one hero.
- Locked cards with no product named are interchangeable. A reading lists the set of sources they hold once, in place of every way to hand those sources out, and `sourcesOf` spreads a move that keeps only some of them over every subset of that size.
- The search treats cards of one kind as alike. A player knows which one was kept through a reroll, and choosing between it and a new one on purpose can beat the chance shown, which stays a chance the player can reach. The shortfall is at most 0.02 of a point with all 32 heroes in the pool and grows as the pool shrinks: the largest seen is 0.27 of a point, with 4 heroes left.
- Copies of different heroes are never added together. The goals that span heroes exist only when every wanted hero needs one copy.
- A source may only ever show Artifact EXP at some level. A pack table may list such a source as an empty list; `checkOdds` returns the table with Artifact EXP listed for it, because the card is on show all the same and reading the shop has to match it to a source.
- The three pictures the cards use (the badge, the Artifact XP icon and the random card) come from the data pack. A build without them draws a gold dot for the badge and text for the other two.
- Vitest has no worker thread. The engine's tests stand in for the worker; the real one is exercised in a browser.
