# Roster Import

The roster import reads screenshots of the game's hero roster, the Resonating Hall, on the device and saves what they show as a new roster: every hero shown, with its paragon and refinement. It opens from the Rosters tab's Screenshots button on both the Arena and Teams pages, and loads on first use. The screens are read by the shared screenshot import ([Screenshot Import](./IMPORT.md)), the same engine, worker, card reader and references the team import runs on. It produces evidence, the review turns evidence plus the user's edits into a plan, and only Save changes the rosters.

A whole roster takes several screenshots, taken any way as long as each hero shows whole in at least one (the Chinese and Korean clients call the screen 英雄厅堂 and 영웅의 전당). Players take them as desktop windows with other apps around the game, whole phone screens, or crops of a few rows, so the reader finds the grid with no fixed position.

## How it fits together

```
┌─ RosterImportModal ──────┐            ┌─ RosterImportButton ─────┐
│ drop zone, review,       │  heroes    │ rosters.create           │
│ name, Save               │───────────▶│ (the new roster active)  │
└───────────────────┬──┬───┘            └──────────────────────────┘
       shots, edits │  ▲
                    ▼  │  readings, plan
┌─ useRosterImport ─┴──┴───┐
│ shots and overrides      │
│ buildRosterImportPlan    │
└───────────────────┬──┬───┘
              files │  ▲
                    ▼  │  readings
┌─ useImportEngine ─┴──┴───┐            ┌─ import.worker ×1–3 ─────┐
│ decoding, read queue     │───────────▶│ readRoster               │
│ the hero references      │   images   │ hero table, frames       │
│ learned icons            │◀───────────│                          │
└──────────────────────────┘  readings  └──────────────────────────┘
```

A roster import reads with the hero part of the references only (frames, portraits, costumes, learned faces), so it never waits on the match part. A roster takes several screenshots, so the engine starts more readers for them while every reader is busy ([Screenshot Import](./IMPORT.md#the-engine)).

## The screen

From the top, the Resonating Hall shows a season banner, the Soul Pact row of five round phantimal portraits (which a roster does not hold, so the reader skips it), the Hands of Resonance (five cards fixed above the scroll, larger than the grid's), and the grid of Resonance Heroes: six columns of cards scrolling under the grid's header and its title, on a flat cream ground whose gutters stay cream between the cards. The faction filter button floats over the last rows' right columns, the bottom bar (Artifacts, Level Up All, Equipment) covers the last row, and the list ends in empty slots. A hero in the Hands of Resonance is not listed again in the grid.

Cards come in two families. Heroes at S+ (which Stargazer calls P0) and above wear the paragon frames the card reader's templates are: P0 to P4 and the winged P4. Heroes below S+ have no frame, on a coloured plate, or a lower tier's frame. Stargazer does not use heroes below S+, and the import takes them as P0, R0.

## Reading one screenshot

`readRoster` (`src/lib/import/screens/roster/roster.ts`) finds everything from the cream ground, on a copy at most 1000 px wide (`WORK_MAX`):

1. The ground mask marks every cream pixel, grey ones (the empty slot's placeholder) included and pure white (the filter button) not, then drops the cream's own specks with a 3 × 3 majority vote.
2. The grid's six columns are a comb (`fitComb`, `comb.ts`): a phase and a pitch whose gutters are as cream as possible and whose card middles are not, fitted to the share of cream in each pixel column. It is fitted on horizontal slabs down the shot, so other windows, the game's art and the Hands of Resonance do not pull it, then refitted over the slabs that agree with the best supported fit; only a fit with a card in each of its six columns somewhere counts. A shot is a roster screen only when enough of it is cream and the comb fits well, bounds that roster screenshots clear and match screens stay well under. Otherwise the reading has no grid and no cards.
3. Rows are the runs of pixel rows where the cards' side edges show, cut at the row pitch where crowns bridge two rows, and trimmed where the bottom bar covers the margin left of the first column. A row the scroll cuts at either edge is skipped and counted (`clipped`): its cards are whole in another screenshot. So is a card the filter button covers. A slot with no card is `empty`.
4. A first row run up under the header's title loses its frames' tops though its sides look whole. The reader finds where the row's cards start to show under the title, reads them on the rows below that edge and the fade beneath it, and puts a covered card's frame, and with it its levels, in doubt. Once the edge reaches the row's star row, the row is skipped as cut.
5. The Hands of Resonance are a comb of five fitted above the first row, at a pitch of their own.
6. Each card is read with the card reader (`readCard`) on a copy scaled so its frame meets the frame templates, at the scale where the first whole cards' frames match best, and the screenshot's cards, the Hands and the grid together, are settled against each other (`settleCards`), since the screen shows each hero once. A card is sure of its hero only when it leads every other hero it was ranked against: among some thirty cards the elimination the match screens settle by would pass weak readings as sure.
7. The frame match tells the family: a weak match is a card below S+, read as P0, R0, and between the bounds the family is unsure. Where the header leaves a card whole, its crest (`readCrest`, the frame's top half) tells the levels apart too: P2 to P4 add a crown the S+ frame lacks, and P1 and P4 recolour parts of it. A level the crest and the frame match agree on is sure when either is clear, the match by a lead over the next level, since the P0, P2 and P3 frames match one another's templates closely. A sure crest settles a close match, and any other disagreement leaves the level in doubt (`levelBetween`). A card whose family is unsure, with a sure S+ crest (no crown and none of P1's or P4's colours) and a star row that reads R0, is P0, R0 whichever it is, so it is not asked.
8. The grid's order then settles cards still in doubt (`settleByOrder`, `order.ts`). Inside a group the screen lists heroes from the highest paragon level down, the heroes below S+ last, and a group ends on a row it leaves short. A card in doubt between cards sure of their levels lies between those levels: a card in doubt of its family is below S+ after a card below S+ and S+ between S+ cards, and an S+ card takes a level when one is left or when its frame match and crest settle one of those left by step 7's rule. A card whose crest does not show, as under the header, takes one only when one is left: the frame match alone cannot tell P0 from P2. A group whose sure cards are out of order gets no help from it. A group that fills its last row runs on into the next unseen, so a card in doubt beside that break can take the other group's levels.

Each card's key is `h1` to `h5` for the Hands of Resonance and `row.col` down the grid (`slotKey`), and the review outlines every slot with its key on the screenshot, so a card counted as cut off can be found.

## The plan

`buildRosterImportPlan` (`src/lib/rosterImport.ts`) merges every screenshot's cards, each with the reviewer's correction beside it, into one entry per hero. A roster holds a hero once, so the hero is the key: the Hands and the grid are one pool, and one card seen in two overlapping screenshots is one entry. The plan is worked out again from the readings and corrections on every change, so the screenshots give the same plan whichever is read first, and removing a screenshot drops its cards and their corrections.

An entry asks about three things (`EntryIssue`):

- `repeat`: the hero is read on more than one card and one of them is unsure, usually a misreading of another hero.
- `levels`: its cards disagree on the hero's paragon or refinement. It holds back Save until they agree.
- `twice`: the hero is read on two cards of one screenshot, which never shows a hero twice. It holds back Save.

Cards no hero is taken for are listed apart, and a hero removed in review drops the card. The entries with an issue or a card left to check come first, then the rest; Save writes each hero's levels with defaults left out, as the roster format stores them ([Teams](./TEAMS.md#rosters)).

## Review and save

A hero with an issue shows its cards one by one, each corrected on its own, since one of them may be another hero; any other hero is one cell, and a correction or a level set there goes to each of its cards. Correcting the hero of an unsure card on a surely placed paragon frame, whatever its level, teaches that face to the learned store both imports share ([Screenshot Import](./IMPORT.md#reference-descriptors)). A card below S+ never teaches, since its face is cut from a guessed box. The cards of one cell are one card seen again, so the first teaches its face and the others take back what each was taught on its own. Picking the reader's own top candidate, or no hero, takes back a lesson. Confirm all takes every hero with a card to check and no issue as read (`confirmable`), so it teaches nothing and leaves each issue to the reviewer.

Save creates the roster with its name and heroes in one write (`rosters.create`), and it becomes the active roster ([Teams](./TEAMS.md#rosters)). Save waits while screenshots are added or read, while an entry's issue holds it back, and while no hero is found.

Each import turns away the others' screenshots however they are added, and this one reads a screenshot the sorter cannot place as a roster ([Screenshot Import](./IMPORT.md#the-engine)).

## Related documentation

- [Screenshot Import](./IMPORT.md): the engine, worker, hero cards and references every import shares
- [Screenshots the Imports Read](./IMPORT_SCREENSHOTS.md): what each screen gives, what a screenshot needs, and the limits
- [Team Import](./IMPORT_TEAM.md): the match screens, whose card reader the roster reuses
- [Teams](./TEAMS.md#rosters): the roster format, the Rosters tab and the active roster
