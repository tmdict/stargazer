# Honor Duel Shop Calculator

The page at `/guide/hd/shop` answers one question about the Honor Duel shop in front of a player: what to do first. The player enters the eight cards on show, the round, the badges in hand and the heroes or equipment wanted. For each wanted item the page shows two answers, the move with the best chance of getting it this round, and the move that spends the fewest badges on average.

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

A press of Calculate sends one request to the shop worker. `calculateShop` first reads the shop: it lists every way the sources could have made the cards on show, each with its chance. A shop no source assignment explains is refused as impossible. It then makes one goal for each wanted item, and goals for "any wanted hero", "any wanted piece" and "any target" when every hero needs a single copy.

A shop level follows from the round. When the level rises next round, stopping is measured against the next level's sources.

### Best chance

For one goal, each first move (buy a card, or reroll with a set of locks) gets the chance of reaching the goal before the badges run out, when every later move is the best one.

A later shop is reduced to a code: one digit per source, saying which useful kind of card the source shows, or none. Two tables hold a chance for every code, badge count and number of targets still needed. The ceiling table answers for a player who is told the sources, so it is never too low. The floor table answers for a player who must pick one move for every code that looks the same on screen, so it is never too high. Where the two agree, the chance is known. Where they differ, a search over what the player can believe about the sources narrows the range.

### Fewest badges

The same codes carry two cost tables: the average badges to reach the goal for a player who never runs out. The floor is the cost when the sources are known. The ceiling is the cost of one plan a real player can follow from the cards on show. The page shows the ceiling. A reroll can lead back to the same shop, so each table is recomputed until its numbers stop moving.

### Stopping

Each round's first shop is a free redraw of the unlocked cards. A way to stop is a set of locks to leave, after a purchase or none, and it is costed by what the goal takes from the next round on. Fewest badges says to stop when its cheapest move cannot be paid for, when no move leaves a chance this round, or when the shop level rises next round and waiting is cheaper by more than a reroll. The answer then names the cheapest way to stop.

### Advice

Every first move has a number; the advice rules pick the one shown. A move replaces the one the shop is set up for only when its chance is higher by 0.005 of a point, so an answer never advises a change that gains nothing. Costs within 0.05 badges count as equal, and among equal ways to stop the one that gives up fewer of the locks already set comes first. A chance range is compared by its floor and a cost by its ceiling, the figures a player can count on.

## Decisions

Answers arrive in stages. The first stage has every number at once, with a range where the tables alone do not settle a chance. The search then narrows only the ranges that could change what a card shows, and stops after `SEARCH_MS`. A range it does not reach stays a range. This keeps a first answer fast for every request and puts a limit on the slowest one.

The work runs in one worker. The tables depend on the goal's useful kinds, their prices and what each source makes of them, and not on the cards entered or the badges held. The worker keeps them between requests, so a later press on the same shop visit mostly reads what an earlier one filled.

A worker at work hears no messages, so the page ends a request by ending the worker and starting another. Cancel keeps the answers already shown; an edit to the form clears them, because they no longer belong to what is entered. Both lose the kept tables.

The page stores nothing. What a player enters lasts for the visit to the page.

The odds view always shows the measured table in this repo, with its measured ranges.

## Rules

- The worker is the one place that chooses the odds table: the data pack's when the pack has one, else the repo's. Nothing on the page reads the pack's table.
- Each answer carries its request's number, and the page drops an answer whose number is not the newest. An answer to earlier inputs is never shown.
- Every set of answers a stage sends is whole and replaces the last.
- `SHOP_LIMITS` bounds a request (badges and copies). The tables' time and memory grow with both, so a higher limit needs the speed of the heaviest request measured again.
- A chance shows one decimal, and a range only when it is wider than 0.1 of a point.

## Gotchas

- A locked card keeps its source number when the shop level rises. The stopping answer depends on it: a lock kept across the level change blocks that source in the next level's table.
- Copies of different heroes are never added together. The goals that span heroes exist only when every wanted hero needs one copy.
- A source may make nothing the calculator follows at some level. A pack table lists such a source as an empty list.
- The three pictures the cards use (the badge, the Artifact XP icon and the random card) come from the data pack. A build without them draws text in their place.
- Vitest has no worker thread. The engine's tests stand in for the worker; the real one is exercised in a browser.
