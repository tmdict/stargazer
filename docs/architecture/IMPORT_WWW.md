# Matchup Import

Who Would Win?'s screenshot import reads the Supreme League's knockout matchup list on the device and fills the page's five games with what it shows: each team's heroes with their paragon and refinement, and its artifact. It opens from the Screenshots button on Who Would Win? ([Guide](./GUIDE.md#who-would-win)), in One game or in Match, and loads on first use. The screens are read by the shared screenshot import ([Screenshot Import](./IMPORT.md)), the same engine, worker, card reader and references the other imports run on. It produces evidence, the review turns evidence plus the user's edits into a plan, and only Save changes the games.

Players take the list in one or two screenshots, scrolling between them, and two screenshots often share a game or show the same game's cards twice, so the import puts every screenshot's panels together into the match's games.

## How it fits together

```
┌─ WwwImportModal ─────────┐            ┌─ WwwImportButton ────────┐
│ drop zone, review, Save  │  games     │ useWwwGames.fill         │
│                          │───────────▶│ (all five, then Match)   │
└───────────────────┬──┬───┘            └──────────────────────────┘
       shots, edits │  ▲
                    ▼  │  readings, plan
┌─ useWwwImport ────┴──┴───┐
│ shots and overrides      │
│ buildWwwImportPlan       │
└───────────────────┬──┬───┘
              files │  ▲
                    ▼  │  readings
┌─ useImportEngine ─┴──┴───┐            ┌─ import.worker ──────────┐
│ decoding, read queue     │───────────▶│ readMatchup              │
│ hero and match parts     │   images   │ hero table, frames       │
│ learned icons            │◀───────────│ artifact table           │
└──────────────────────────┘  readings  └──────────────────────────┘
```

The import reads with the hero part and the match part of the references, since each team has an artifact ([Screenshot Import](./IMPORT.md#the-engine)).

## The screen

Under the banner the list shows "Game 1" to "Game 5", one panel each, scrolling. Each panel's header names the game beside its result, which reads "Unavailable" until the match is played, so the screenshots players predict from all show it. A panel is two team boxes side by side, the left team's with a solid blue bar along its top and the right team's with a red one. Each box holds an artifact badge at its outer top corner, the five hero cards in a row under the bar, each with its star row above the face, and the team's power and account level, which the import does not read. A team that fields fewer than five heroes shows a flat light grey box in each empty slot. The cards are the game's hero card, the one the result screen and the Resonating Hall show.

The bottom bar with the back button covers the last row when the list is scrolled up, so a panel's bar can show while its cards sit under the bar. Scrolled the other way, the banner can cover a panel's bar while its cards show.

## Reading one screenshot

`readMatchup` (`src/lib/import/screens/matchup/matchup.ts`) finds everything from the team bars:

1. `findPanels` (`bars.ts`) finds the solid blue and red bars, each at least `BAR_SHARE` of the screenshot's width, and pairs a blue bar with the red one level with it, of its width, a short gap to its right. Each pair is a panel, top to bottom. The sorter calls a screenshot a matchup list when one pair shows (`isMatchupScreen`).
2. Every measurement below is a share of the bar's width (`layout.ts`), so crops, scrolling and screen sizes need nothing else: the five cards' boxes under the bar, the artifact disc's place at the bar's outer end, and the strip along the box's foot.
3. A team box whose foot is out of view, under the bottom bar or past the screenshot's edge, reads no cards: its cards are left to the screenshot that shows them whole. The test is the white strip along the box's foot (`FOOT`), which shows on every box whose cards are whole. A hidden card row still matches the frames, and its faces can read as heroes on blank ground, so the frame score cannot be the test.
4. A slot whose box is flat light grey where a card's face would be (`EMPTY`) is empty and reads as no card (null).
5. The box's other cards are read with the card reader from their rough boxes (`readCardBoxes`), at the scale where their frames match best. A player fields each hero once in a match, so one side's cards across the screenshot are settled together (`settleCards`), each lead measured over every hero the card was ranked against, as the roster's are. A weak frame match is a card below S+, read as P0, R0 (`frameFamily`).
6. The artifact is read with the match screens' artifact reader (`readArtifact`) at the disc's place, whether the box's cards are in view or not.

## The plan

`buildWwwImportPlan` (`src/lib/pvp/sl/www/wwwImport.ts`) puts the screenshots' panels together into games, each card's readings with the reviewer's corrections beside them. A screenshot's panels are consecutive games. Two panels of different screenshots are one game when a side's settled heroes overlap, a settled hero being one picked in review or read surely, since a player fields each hero once; when one of them shows no cards, a shared settled artifact on the same side counts the same way. Screenshots linked to none follow one another, one whose last game's cards are out of view first, since the list goes on below it, and where the games then pass five they overlap by the excess. Links that disagree, or more than five games, mean a screenshot of another match (`otherMatch`). A game is found when both its teams' cards show in some screenshot; the others are listed as missing.

A team seen in two screenshots keeps each card's readings. For each part of a card (the hero, the paragon, the refinement), the sure readings stand over the unsure ones, and readings that still disagree are asked about. An artifact is the one picked in review, else the one read surely; one not read surely is left empty (not recognised), so another season's artifact, whose icon the app does not have, never goes in as a wrong one.

A card or an artifact asks about two things (`WwwIssue`), and both hold back Save:

- `differ`: its screenshots read it differently.
- `twice`: its side fields it in two games, which a match never does.

An empty slot stays empty: it asks nothing, Save leaves it open, and the prediction counts it as an empty slot ([Guide](./GUIDE.md#who-would-win)).

The plan is worked out again from the readings and corrections on every change, so the screenshots give the same games whichever is read first.

## Review and Save

The review shows each screenshot with its team boxes outlined and numbered by the game they fill, a box whose cards are out of view dashed, then the five games in order, Team A above Team B: each team's artifact and five cards, an empty slot as a dashed cell, with what is left to check marked and each issue tagged. A missing game's row says how to add it. A correction of an unsure card's hero teaches its face, as the roster import's does ([Roster Import](./IMPORT_ROSTER.md#review-and-save)). Confirm all takes every card with a doubt and no issue as read (`confirmable`).

Save replaces all five games and switches the page to Match, whichever mode was showing: a missing game becomes an empty one. Save waits while screenshots are added or read, while an issue holds it back, and while the screenshots do not fit one match.

Each import turns away the others' screenshots however they are added, naming the place that reads them, and this one reads a screenshot the sorter cannot place as a matchup list ([Screenshot Import](./IMPORT.md#the-engine)).

## Related documentation

- [Screenshot Import](./IMPORT.md): the engine, worker, hero cards and references every import shares
- [Screenshots the Imports Read](./IMPORT_SCREENSHOTS.md): what each screen gives, what a screenshot needs, and the limits
- [Roster Import](./IMPORT_ROSTER.md): the other screen whose cards are placed by its own landmark
- [Guide](./GUIDE.md#who-would-win): Who Would Win?, its games and its match result
