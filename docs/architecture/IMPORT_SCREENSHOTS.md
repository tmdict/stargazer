# Screenshots the Imports Read

What the screenshot imports can read from the game's screens, how they say how sure they are, what a screenshot needs, and where they stop. How each screen is read lives in [Screenshot Import](./IMPORT.md), [Team Import](./IMPORT_TEAM.md) and [Roster Import](./IMPORT_ROSTER.md). This page is the map of what they deliver, for deciding whether a screen or a field is worth a new reader.

Nothing reads text. Every landmark is a shape, a colour or a picture: the result screen's orange and blue tabs, the formation board's outline, the replay arena, the roster's cream ground and its six columns, and on every card the paragon frame, the face and the star row. Numerals count only as the white pixels that show a slot circle is there.

## What each screen gives

| Screen          | Read                                                                                                                                     | Not read                                                                      | Lands as                                   |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------ |
| Match result    | both lineups with each hero's paragon and refinement, both artifacts, which map of the match it is, who won it                           | player names (typed in the review), hero levels, damage and other stats       | a new team, one board per map              |
| Formation panel | the tile of every unit, companions and the phantimal included, the side and the map from the lit tiles; alone, the card row and artifact | upgrades of a match (the panel shows the screenshotting player's own)         | tiles for a match's lineups, or a lineup   |
| Replay frame    | where the board lies in the frame, the map from the strip                                                                                | which unit stands where: the review places them on the frame's tiles by hand  | tiles for a Supreme League match's lineups |
| Hero roster     | every whole card's hero with its paragon and refinement, the Hands of Resonance included; a card below S+ as P0, R0                      | Soul Pact phantimals, hero levels, cards the scroll cuts or the filter covers | a new roster, made the active one          |

A match imports from its result screenshots, and formation screenshots or replay frames add where its units stand. Formation screenshots can also be imported on their own. A roster takes several screenshots, taken any way as long as each hero shows whole in at least one, and a hero seen twice is one entry.

## Confidence and review

Every field carries its own sure flag, so a doubt about a frame never hides behind a sure hero. The review shows what is unsure first, and a correction is kept beside the reading instead of changing it. The bar for marking a reading sure is that nothing read wrongly is marked sure on the labelled samples kept outside this repo. A misreading may slip by only as an unsure reading the review asks about.

Save waits for what would put something wrong on a board or in a roster:

- the team import, for a map filled twice, a hero twice on a side, a hero or artifact repeated across boards, or a record name it cannot use;
- the roster import, for a hero whose cards disagree on its levels, or a hero read twice in one screenshot;
- both, for screenshots still being added or read.

Correcting the hero of an unsure card on a surely placed paragon frame teaches that face, and every import reads with what any import learned. The browser keeps at most `LEARNED_ICONS_CAP` lessons, oldest out first, and the review's Forget control drops them.

## What a screenshot needs

A result screen, replay frame or roster screenshot needs to be at least 600 px wide, a formation panel `FORMATION_MIN_WIDTH`. Wider captures are drawn down, so only decoding costs more. Crops, desktop windows with other apps around the game, and whole phone screens all read, since each screen is found by its own landmark rather than by position. A roster's six columns must span at least a fifth of the capture's width, which a game window filling most of a desktop capture does.

Each import accepts only its own screens, on every way in. The sorter turns a roster screenshot away from the team import and a match screenshot away from the roster import, each with a message naming the other's place. A screenshot the sorter cannot place, such as a washed-out capture, is read as the kind of where it was added.

## Limits

- Other game languages are untested on the match screens. The result tabs' lettering is skipped over as small gaps, so a language whose label covers much more of a tab could hide the tabs; the result reader then finds the panel from its cards instead. The roster screen reads in French as in English.
- A game update that moves or recolours a landmark (the cream ground, the six columns, the tabs, the board outline, the arena around a replay fight) stops that screen reading until its reader is measured again on new samples.
- Seasonal artifacts are matched against icons from the image host, so a new season's artifacts read once their icons are published there ([Seasonal Content](./SEASONAL.md)).
- The replay camera and arena were measured on one match. A Supreme League map change needs frames of the new maps checked, and a new arena picture when the fight's surroundings change.
- A new hero reads once its portrait is in the app, and a costume once its capture is on the image host. A face neither covers stays unsure until a correction teaches it.
- A roster reads in up to three workers at once. A device reporting under 4 GB of memory reads with one, and a touch screen reporting none (Safari and Firefox report none) with two at most, so a roster takes longer there; phones have not been timed.

## Privacy

Screenshots never leave the device. The references are fetched, each screenshot is drawn to a canvas and handed to a worker as pixels, and nothing of it is stored. What persists is what the user saves (a team or a roster) and the learned face descriptors, which are numbers describing a face crop, not images ([Reference descriptors](./IMPORT.md#reference-descriptors)).

## Adding a screen

A new screen keeps the layering the others follow:

1. A reader under `src/lib/import/screens/` that finds its own landmark, reads its cards with the card layer, and gives every field a sure flag.
2. A kind in `src/lib/import/kinds.ts` with the reference parts it waits for, its decode widths in the engine, and its reader in the worker.
3. A test in the sorter, when one import takes it beside other screens or another import must turn it away.
4. An import that hands the engine its session and places each added file, a plan as pure data with unit tests, and a review built from the shared pieces.
5. A check against labelled samples before it ships: what it marks sure must never be wrong on them.
