# WandWars

> Living document for the WandWars feature. Updated as design evolves.

## 1. Background

WandWars is a 3v3 PvP game event where two players alternate picking heroes, then battle. This tool analyzes historical match data to recommend optimal hero picks.

**Draft rule**: Left picks 1st → Right picks 1st & 2nd → Left picks 2nd & 3rd → Right picks 3rd.

**Goal**: Given past match data, predict the best next hero to pick at each stage of the draft to maximize win probability. When all 6 heroes are picked, predict which team is favored and allow recording the result.

## 2. Data Format

Source: `src/wandwars/data/raw/*.data` (gitignored, multiple data files)

```
leftHero1,leftHero2,leftHero3 <symbol> rightHero1,rightHero2,rightHero3;optional note
```

- `>` left wins, `<` right wins, `>>` / `<<` dominant/sweep win (weight 2.0), `=` draw
- Hero names are kebab-case, matching `src/data/character/*.json`
- Notes use `{hero-name}` to reference specific heroes — displayed with hero names highlighted in teal bold
- Data file is gitignored; inlined into JS bundle at build time via Vite `?raw` import

Examples:

```
natsu,silvina,faramor > tilaya,harak,kordan;{faramor} true damage counters {tilaya}
tasi,dunlingr,daimon << kordan,zandrok,gerda
```

## 3. Architecture

### File Structure — WandWars Files

All WandWars-specific files. To disable or remove the feature, delete these and revert the modified files listed below.

```
src/
  wandwars/
    data/
      raw/
        *.data                # Plain text match data files (gitignored)
        portraits/            # Hero reference portraits (gitignored — local only)
      data                    # Base64+zlib encoded match data (committed)
      .gitignore              # Ignores raw/ folder
    scripts/
      encode.ts               # Raw → encoded (npm run encode:ww)
      normalize-references.ts # Crop/resize hero portraits to uniform 170×230 gold-bbox
      trainNN.ts              # Train Adaptive ML neural network (npm run train:ww)
    types.ts                  # Domain types (MatchResult, Recommendation, TrioEntry, TeamRecord, etc.)
    constants.ts              # Weights, thresholds, draft order, meta analysis constants
    formatting.ts             # Shared: formatPercent, formatName, formatSigned, formatNoteHtml, getResultSymbol
    records/
      parser.ts               # Text file → MatchResult[]
      serializer.ts           # RecordedMatch[] → .data text for export
    prediction/
      analysis.ts             # Hero stats, synergy/counter/trio matrices, computeTeamRecords()
      popularPick.ts          # Popular Pick model (popularity + pair records)
      composite.ts            # Composite model (synergy + counter + trio, dynamic weights)
      bradleyTerry.ts         # Bradley-Terry model (regularized L2, pair interactions)
      adaptiveML.ts           # Adaptive ML model (neural network, learned embeddings)
      nn.ts                   # Neural network forward pass utilities
      nnWeights.ts            # Auto-generated pre-trained weights (committed)
      modelUtils.ts           # Shared: getRelevantNotes, getMatchupNotes, Wilson confidence
      confidence.ts           # Wilson score interval calculation
      teamSuggestions.ts      # Top teams (data-backed) + constructed team suggestions
      recommend.ts            # Unified interface, data loading, caching, all model predictions
    heroImport/
      imageSignature.ts       # Compute normalized 32×32 circular-masked grayscale signature + NCC distance
      poolDetect.ts           # Slice screenshot into 4×5 cells, match each to reference signatures
      signatureCodec.ts       # Encode/decode base64 signatures
      heroPortraitSignatures.ts       # Auto-generated committed map of base64 signatures
      heroPortraitSignatureBuilder.ts # Dev-time folder → signatures module (generate/download)
      bundledReference.ts     # Load committed signatures; support in-memory override
  views/
    WandWarsView.vue          # Standalone page, state management, localStorage records
  components/
    wandwars/
      WandWarsPicker.vue          # Left column: pick slots + hero grid + undo/reset + pool import modal
      WandWarsPoolImport.vue      # Upload screenshot → detect 20 heroes → apply as hero-pool filter
      WandWarsPickSlots.vue       # 6 pick circles, container-query responsive layout
      WandWarsHeroGrid.vue        # Hero grid with faction FilterIcons + undo/reset
      WandWarsAnalysis.vue        # Right panel: tabbed [Popular Pick][Composite][B-T][Adaptive ML][Records]
      WandWarsRecommendation.vue  # Recommendation card with breakdown, counters, team counter
      WandWarsTopTeams.vue        # Pinned top teams + suggested teams card
      WandWarsMetaTeams.vue       # Meta tab: sortable tables for Units/Synergy/Teams
      WandWarsInsights.vue        # Meta tab: insights, counter rows, dataset header
docs/
  architecture/
    WW.md                      # This document
```

### Modified Files (non-WandWars)

These existing files were modified to support the feature. Revert these changes to fully remove WandWars:

| File                   | Change                                                                      |
| ---------------------- | --------------------------------------------------------------------------- |
| `src/router/routes.ts` | Added `/wandwars` route                                                     |
| `package.json`         | Added `encode:ww`, `train:ww` scripts; modified `build` to run decode first |
| `tsconfig.app.json`    | Added `src/wandwars/scripts/*` to `exclude`                                 |

### Route

```typescript
{ path: '/wandwars', component: () => import('../views/WandWarsView.vue') }
```

No locale prefix, not SSG pre-rendered. No page title or back button — user navigates via site icon.

### Data Pipeline

```
raw/*.data (raw, gitignored)
    ↓ npm run encode:ww (concatenate + zlib deflate + base64)
data (encoded, committed to git)
    ↓ npm run build (auto-decodes before build)
raw/*.data (decoded at build time)
    ↓ Vite ?raw import
JS bundle (inlined as string)
```

- **Local dev**: Edit files in `src/wandwars/data/raw/` directly, Vite reads them via `?raw` import
- **Adding data**: Edit raw files → `npm run encode:ww` → commit encoded `data` file
- **Netlify build**: `npm run build` runs `decode.ts` first, then normal build
- **Why encode?** Raw data is gitignored to keep match records private. Encoded file is committed but not human-readable (base64+zlib). ~63% smaller than raw.

### Component Reuse

- **`CharacterIcon`** — pick slots with level background, tooltip on hover
- **`FilterIcons`** — faction filtering in hero grid
- **`gameDataStore`** — initialized on page load for character images, icons, and data

### localStorage

- Key: `stargazer.wandwars.records` — recorded match results. Remove this key to clean up browser storage when disabling the feature.

## 4. Shared Statistical Foundations

### Bayesian Prior (analysis.ts)

Win rate calculations in the analysis layer (hero stats, synergy/counter/trio matrices) use a **Bayesian prior of 3.0** — equivalent to adding 3 virtual wins and 3 virtual losses. This aggressively pulls heroes with few matches toward 50%:

| Actual record | Raw win rate | Bayesian-smoothed |
| ------------- | ------------ | ----------------- |
| 2W / 0L       | 100%         | 62.5%             |
| 5W / 2L       | 71.4%        | 61.5%             |
| 12W / 8L      | 60%          | 57.7%             |
| 30W / 20L     | 60%          | 58.9%             |

Prior fades naturally as data grows. At 50+ matches per hero it's negligible. Applied consistently to: hero win rates, synergy pair rates, counter matchup rates, trio records, and team records.

**Why 3.0?** Prior of 1.0 was too weak — heroes with 2W/0L scored 75%, outranking well-tested heroes. Increasing to 3.0 brings that down to 62.5%, which is much closer to properly-tested heroes' rates.

**Exception**: Popular Pick uses a local Bayesian prior of **1.0** for its own pair/trio/contextual win rate calculations (not the shared analysis). This keeps computed win rates closer to the raw W/L records shown to users — if a pair shows "5W / 2L", the 1.0 prior gives 66.7% vs 3.0 giving 61.5%.

### Wilson Score Confidence (confidence.ts)

All models use **Wilson score intervals** for confidence:

```
Wilson 95% CI width < 0.3 → High confidence
Wilson 95% CI width < 0.5 → Medium confidence
Otherwise (or <3 matches) → Low confidence
```

Accounts for both sample size and win rate variance. Displayed as "high/medium/low confidence" with tooltip.

### Hero Exclusion

Already-picked heroes (both sides) excluded from:

- Recommendation lists (via `available` filter in recommend.ts)
- Top Teams (teams containing opponent's heroes filtered out)
- Suggested/constructed teams

### Counter Indicators (cross-model, informational only)

When opponents are known, recommendation cards on **all tabs** show matchup indicators from the Composite model's counter matrix:

- **Green shield + "Strong against [Name]"** — counter score > 0.1
- **Red warning + "Weak against [Name]"** — counter score < -0.1
- **Yellow star + "Potential team counter XW / YL"** — the candidate's trio has beaten teams containing the known opponents

These are **informational only** — they don't affect any model's score. They surface Composite's counter data across all tabs without contaminating model-specific scoring.

Counter score formula: `bayesianSmoothedVsWinRate - hero's overall winRate`

**Sweep weight rationale**: Sweep wins (`>>` / `<<`) are stored with `weight: 2.0` in the parser; regular wins get `weight: 1.0`. A sweep guarantees every hero on the winning team survived the match, so it's stronger evidence each of them contributed than a regular win (where a hero could have died early). This single parser-level weight propagates everywhere that multiplies by `match.weight`: `heroStats.winRate`, `synergyMatrix`, `counterMatrix`, Popular Pick pair records, and Bradley-Terry strength. The Bayesian prior (3.0) still dampens small-sample swings.

### Team Counter Detection

When you have 2 teammates and opponent has 2+ heroes, checks if [your 2 + candidate] has beaten any team containing those opponent heroes in match data. Shows badge only when wins > losses. Works with partial opponent teams (doesn't require all 3 known) since your 3rd pick always happens before the opponent's 3rd.

### Order Independence

All team comparisons and lookups treat teams as **unordered sets**. `[A, B, C]` is identical to `[C, A, B]` everywhere:

- **Membership checks**: `Array.includes()` and `Set.has()` — order irrelevant
- **Team keys**: `.sort().join(',')` for deduplication in analysis, exact trios, and constructed teams
- **Pair/counter lookups**: Synergy matrix uses sorted pair keys; counter matrix uses directional hero-vs-hero keys (not team order)
- **Score computations**: Addition is commutative — summing synergy/counter/strength across teammates produces the same result regardless of iteration order
- **Display ordering**: `orderedTeam()` reorders heroes for display only (picked heroes first), cosmetic — does not affect calculations

### Side Lock

Two toggle buttons ("Left Team" / "Right Team") allow locking recommendations to a specific side:

- **Unlocked (default)**: Recommendations follow draft order automatically
- **Locked**: Recommendations always compute for the locked side, regardless of whose turn it is. A closed padlock icon appears on the active button.
- Affects: recommendation list, top teams, counter indicators, team counter — all use the locked side
- Recommendations still update dynamically as the opponent picks (new counter data, hero exclusion)

## 5. Prediction Models

All models implement `RecommendationModel` with `recommend()` and `predictMatchup()`. They run independently in separate tabs. Pick order does not affect predictions — all models evaluate teams as unordered sets.

Tab order: **Popular Pick** (default) | **Hero Synergy** (Composite) | **Team Power** (Bradley-Terry) | **Adaptive ML** | **Records** | **Meta**. Individual match-prediction cards follow the same order.

### Model A: Popular Pick (`popularPick.ts`)

**Philosophy**: Observable co-occurrence — "who's popular and tends to win alongside your team?"

#### Scoring — Dynamic Weights by Draft Stage

| Draft stage            | Win Rate | Pick Rate | Pair Records |
| ---------------------- | -------- | --------- | ------------ |
| 1st pick (0 teammates) | 60%      | 40%       | —            |
| 2nd pick (1 teammate)  | 35%      | 20%       | 45%          |
| 3rd pick (2 teammates) | 25%      | 15%       | 60%          |

**Win Rate**: Contextual win rate filtered to matches where candidate appeared alongside current teammates/opponents. Blends with overall when <3 contextual matches.

**Pick Rate**: Hero appearances relative to most-picked hero. Normalized 0-1. Meta popularity signal.

**Pair Records**: Actual W/L with each teammate. For 2 teammates, blends individual pairs (60%) + trio record (40%) if available. Displayed as `w/ [Name]: XW / YL` with green/red coloring.

#### Breakdown

- Win Rate %
- Pick Rate %
- Per-teammate pair W/L record

---

### Model B: Composite — "Hero Synergy" (`composite.ts`)

**Philosophy**: Analytical interaction modeling — "how much better/worse do heroes perform together than expected?"

#### Factors

**Win Rate (0.5)**: Bayesian-smoothed individual win rate.

**Synergy (0.3)**: `bayesianPairWinRate - (winRate(A) + winRate(B)) / 2` for each teammate pair. Positive = synergize, negative = clash.

**Counter (0.2)**: `bayesianVsWinRate - overallWinRate` for each opponent. Match weights applied consistently.

**Trio Synergy**: When the candidate completes a 3-hero team with 3+ matches of data, a bonus/penalty is added based on how the trio performs beyond what pairwise synergy predicts: `trioWinRate - expectedFromPairSynergies`. Scaled by `dataStrength(trioMatches)`. Captures three-way interactions that don't decompose into pairs.

#### Dynamic Weight Adjustment

Synergy/counter weights scale by data availability:

```
dataStrength(matchCount) = min(1, matchCount / 10)
effectiveSynergyWeight = 0.3 × avgPairDataStrength
effectiveCounterWeight = 0.2 × avgMatchupDataStrength
effectiveBaseWeight    = 0.5 + unused weight
```

Sparse pair data → weight flows to Win Rate. Full pair data (10+) → full weights apply.

#### Score Normalization

Synergy/counter clamped [-0.5, +0.5] → shifted to [0, 1] before weighting.

#### Sample Size Bonus

Up to +5% for heroes with 20+ appearances. Tie-breaker for well-tested heroes.

#### Breakdown

- Win Rate %
- Synergy ±%
- Counter ±%
- Trio ±% (shown when candidate completes a trio with 3+ matches; captures three-way chemistry beyond pair synergy)
- Pick Rate % (informational, not in score — deliberately excluded to keep Composite focused on team interactions and distinct from Popular Pick)

---

### Model C: Bradley-Terry — "Team Power" (`bradleyTerry.ts`)

**Philosophy**: Statistically principled strength estimation — "what is each hero's true power level, and how do duos perform together?"

Each hero has latent strength `λ`. Team win probability = `Σλ(team) / (Σλ(team) + Σλ(opponent))`, adjusted by pair interactions.

#### Regularized MM Algorithm

1. Initialize all heroes at `λ = 1.0`
2. Iterate (max 100, tolerance 1e-6):
   - For each hero: accumulate `totalWins` and `denomSum` from all matches
   - **L2 Regularization**: Add virtual observations pulling toward `λ = 1.0`:
     - `regWeight = 3.0 / (1 + heroMatchCount)`
     - Hero with 2 matches: strong pull toward average
     - Hero with 50+ matches: regularization negligible
   - Update: `λ_new = (totalWins + regWeight) / (denomSum + regDenom)`
3. Normalize so parameters average to 1.0

**Why regularization instead of pick rate blending?** Pure B-T with a pick rate hack dilutes the model's statistical value. L2 regularization is the proper Bayesian approach (Gamma prior on λ) — it handles small samples at the parameter fitting level rather than hacking the output.

**Draws**: Treated as 0.5 wins each side (not discarded).

**Unknown opponents**: Compares against average team strength from fitted parameters.

#### Pair Interactions (Post-Hoc Residuals)

After fitting individual λ parameters, pair interaction scores are computed as residuals from the additive model:

1. For each hero pair that co-appears on the same team, compare actual weighted wins to the B-T model's expected wins
2. The residual (actual − expected) / total, scaled by `dataStrength(pairWeight / 10)`, captures synergy/clash the additive model misses
3. Regularized with `pairRegWeight = 5.0 / (1 + pairTotalWeight)` — rare pairs are pulled toward 0 (no interaction)
4. Each pair interaction clamped to ±5% — a full team (3 pairs) can adjust probability by at most ±15%, preventing pair data from overwhelming individual strength ratings
5. Win probability is adjusted: `baseProb + leftPairAdj − rightPairAdj`, clamped to [0.02, 0.98]

This gives B-T synergy awareness with proper statistical grounding rather than heuristic weights.

#### Breakdown

- Strength: λ parameter (relative to average 1.0)
- Win Prob: predicted team win probability (includes pair interactions)
- Pair Synergy: ±% adjustment from duo chemistry (shown when non-zero)
- Pick Rate: informational only, not used in score

---

### Model Comparison

| Aspect           | Popular Pick                       | Hero Synergy (Composite)                             | Team Power (Bradley-Terry)                          | Adaptive ML (Neural Network)                   |
| ---------------- | ---------------------------------- | ---------------------------------------------------- | --------------------------------------------------- | ---------------------------------------------- |
| Min useful data  | ~5 matches                         | ~20 matches                                          | ~20 matches (regularized)                           | ~500 matches (embedding quality)               |
| What it captures | Popularity + pair win records      | Synergy + counter + trio interactions                | Individual hero strength + pair interactions        | Learned patterns (non-linear, automatic)       |
| Small data       | Pick rate weight                   | Dynamic weights + Bayesian prior + sample bonus      | L2 regularization toward λ=1.0                      | Weight decay + early stopping                  |
| Team awareness   | Pair records (observational)       | Pairwise synergy + counter + trio bonus (analytical) | Additive strengths + post-hoc pair residuals        | Implicit via learned embeddings                |
| Strengths        | Works immediately; intuitive       | Explains _why_; captures team chemistry + trio data  | Statistically principled; duo-aware probabilities   | Discovers unknown patterns; improves with data |
| Weaknesses       | No explicit interaction modeling   | Heuristic weights; needs pair data                   | Pair interactions are residuals, not jointly fitted | Black box; needs retraining for new data       |
| Best for         | Default; "who's popular and wins?" | Team composition; draft counter-picks                | Objective strength ranking with duo chemistry       | Second opinion; ensemble diversity             |

**Why no pick rate in Composite?** Adding pick rate made Composite overlap with Popular Pick without adding analytical value. The stronger Bayesian prior (3.0) + sample bonus + dynamic weight redistribution handles small-sample heroes without a popularity signal. Each model is now genuinely distinct.

### How Models Update With New Data

All models recompute from scratch on every page load. Workflow: add matches to raw data files → rebuild → everything recalculated.

| Matches | Popular Pick                                  | Hero Synergy (Composite)                          | Bradley-Terry                             | Adaptive ML                           |
| ------- | --------------------------------------------- | ------------------------------------------------- | ----------------------------------------- | ------------------------------------- |
| 5-20    | Already useful; win rates + pick rates        | Win Rate dominates; sparse pair data              | Regularization dominates                  | Not useful; embeddings random         |
| 20-50   | Pair records appearing; team suggestions work | Synergy/counter starting to appear                | Regularization fading; pair data sparse   | Not useful; heavy overfitting         |
| 50-100  | Rich pair data; strong team suggestions       | Popular pairs show synergy                        | Reliable; pair interactions emerging      | Marginal; noisy embeddings            |
| 100-200 | Very reliable pair records                    | Medium+ confidence; synergy fills in              | Stable; pair data growing                 | Starting to learn; frequent heroes OK |
| 200-500 | Complementary to B-T/Composite                | Rich synergy/counter; trio data appearing         | Stable; pair interactions well-populated  | Competitive; embeddings stabilizing   |
| 500+    | Quick reference + pair lookup                 | Rich trio data; three-way interactions measurable | Strong pair interactions; well-calibrated | Strong; discovers non-linear patterns |

### Model D: Adaptive ML — "Adaptive ML" (`adaptiveML.ts`)

**Philosophy**: Learned pattern discovery — "what patterns exist in the data that hand-crafted models miss?"

#### Architecture

Hero embeddings (87×16) → team sum → difference → Dense(16) → ReLU → Dense(1) → Sigmoid.

Each hero gets a 16-dimensional learned "profile" vector. Team representation = sum of hero embeddings. Prediction uses the difference between team embeddings, so swapping sides correctly flips the probability.

~1,700 parameters total. Trained offline via `npm run train:ww`, weights committed as `nnWeights.ts`.

#### Training

- **Data augmentation**: each match generates 2 samples by swapping left/right (doubles effective dataset)
- **Loss**: Binary cross-entropy, weighted by match weight (sweeps = 2.0)
- **Optimizer**: Adam (lr=0.003, β₁=0.9, β₂=0.999) with L2 weight decay (1e-4)
- **Early stopping**: 15% validation split, patience=30 epochs
- **Draws**: target = 0.5

#### Unknown Opponents

When opponents are unknown during drafting, the model averages predictions against a sample of ~50 random opponent trios from the hero pool. This gives a "how strong is this team in general?" baseline.

#### Breakdown

- Win Prob: predicted win probability from the neural network
- Pick Rate: informational only

#### Retraining

Run `npm run train:ww` after adding new match data. The script reads raw data files, trains with early stopping, and exports weights to `nnWeights.ts`. Commit the updated weights file.

#### Future Improvements (2,000+ matches)

Current architecture is constrained by data size (~1,700 params for ~2,000 augmented samples). With more data:

- **Larger embeddings** (24 or 32 dims instead of 16): richer hero profiles that capture more nuances of playstyle. Viable at ~2,000+ matches.
- **Deeper network** (add a second hidden layer): enables more complex team interaction modeling beyond what a single layer can learn. Viable at ~3,000+ matches.
- **Separate offense/defense embeddings**: a hero may contribute differently when on your team vs the opponent's. Doubles embedding params, so needs ~3,000+ matches.

## 6. Top Teams & Suggestions (`teamSuggestions.ts`)

Pinned above recommendations on all model tabs when 1+ hero picked on current side.

### Data-Backed Teams ("Top Teams")

Exact 3-hero compositions from match data:

- Contains all currently-picked teammates
- Excludes teams with any already-picked hero (either side)
- **Only positive W/L** shown (wins > losses)
- Sorted by Bayesian-smoothed win rate
- Up to 3 shown with actual W/L (green/red)

### Constructed Teams ("Suggested Teams")

Built from strongest pair combinations — surfaces combos even when exact trio never appeared:

**With 1 teammate**: Find best pair partners → for each, find best third via pair records with both → estimate win rate from average of all three pair records.

**With 2 teammates**: Find all heroes that paired with either → score by pair records with both → estimate from combined data.

- Deduplicated against exact trios
- Dashed border, no W/L (record is estimated)
- Up to 3 shown, sorted by Bayesian win rate
- Max width capped at 1/3 container (consistent sizing)

### Hero Ordering

Picked heroes first (in pick order), then remaining alphabetically.

## 7. Recommendation Labels

Each recommendation card can display up to three types of labels: a confidence badge, per-hero counter indicators, and a team counter badge.

### Confidence Badge

One badge per card, based on Wilson score 95% confidence interval width for the hero's win rate:

| Label                 | Condition                        | Color  | Meaning                              |
| --------------------- | -------------------------------- | ------ | ------------------------------------ |
| **high confidence**   | CI width < 0.3 (~16+ matches)    | Green  | Tight statistical estimate           |
| **medium confidence** | CI width 0.3–0.5 (~7-15 matches) | Yellow | Moderate estimate, more data helpful |
| **low confidence**    | < 3 matches, or CI width ≥ 0.5   | Red    | Wide/unreliable estimate             |

Wilson score is computed from `wins + draws*0.5` successes out of total matches. The CI width narrows with more matches and as win rate moves away from 50%.

### Per-Hero Counter Indicators

Shown on all model tabs when opponents are known. Uses Composite's counter matrix:

| Label                     | Icon         | Condition            | Meaning                                       |
| ------------------------- | ------------ | -------------------- | --------------------------------------------- |
| **Strong against [Name]** | Green shield | Counter score > 0.1  | Hero wins more than expected vs this opponent |
| **Weak against [Name]**   | Red warning  | Counter score < -0.1 | Hero wins less than expected vs this opponent |

Counter score = `bayesianSmoothedVsWinRate - hero's overall winRate`. Per-hero, not per-pair. Informational only — does not affect model scores.

### Team Counter Badge

Shown when your side has 2 teammates and the opponent has 2+ heroes picked. Checks if [your 2 teammates + candidate] has a winning record against teams containing the known opponents. Only displayed when wins > losses.

| Label                              | Condition                        | Meaning                                                                                |
| ---------------------------------- | -------------------------------- | -------------------------------------------------------------------------------------- |
| **Potential team counter XW / YL** | Opponent has 2 heroes picked     | Partial opponent match — opponent's 3rd hero is unknown, so the matchup is approximate |
| **Team counter XW / YL**           | Opponent has all 3 heroes picked | Exact opponent match — the full team composition is known                              |

The "Team counter" label is most relevant for the right side's last pick (pick 6), since that's the only time all 3 opponent heroes are known before your pick. The "Potential team counter" appears at pick 5 (left's 3rd pick) when right has 2 heroes, or via side lock. Given the draft order (L→R→R→L→L→R), "Potential team counter" can only appear when recommending for the left side and "Team counter" can only appear when recommending for the right side.

Team counter badges are displayed before per-hero counter indicators (strong/weak against) to give them higher visual precedence.

### Why "Strong/Weak against" not "Counters/Countered by"

The softer language avoids absolute claims with limited data. A hero ranked #1 by Popular Pick showing "Weak against Faramor" is not contradictory — it means "popular and strong, but has a matchup disadvantage against that specific opponent." Different axes, both useful.

## 8. Page Layout

Single-page. Left: hero picker. Right: tabbed analysis panel. Full-width responsive (max 1600px, stacks at 768px).

### Left Column

- **Pick slots**: 6 `CharacterIcon` circles (70px), dashed border when empty (teal/red by team). Click to remove. Portrait images offset (`center 20%` / `margin-top: 6px`) to center on face. Responsive via CSS container queries (wraps at 450px column width, `vs` label on its own line between stacked teams; smaller slots at 320px).
- **Active side**: Full opacity + "▶ Picking" label during draft. Both full opacity when all 6 picked.
- **Hero grid**: 70px circular portraits with level backgrounds. Sorted by faction, then character id. Picked heroes dimmed.
- **Controls row**: Faction `FilterIcons` + Undo/Reset buttons, padded to align with grid.

### Right Column — Tabs

**Popular Pick** (default) | **Hero Synergy** (Composite) | **Team Power** (Bradley-Terry) | **Adaptive ML** | **Records** (with count badge) | **Meta**

#### During Draft

1. **Top Teams card** (1+ hero picked): data trios with W/L + constructed trios with dashed border
2. **Side indicator**: "Recommending for [Left/Right] side" (teal/red)
3. **Recommendation cards**: portrait, name, [confidence badge] [Score: X%], model breakdown, counter indicators (team counter first, then strong/weak against), relevant notes (hero names in teal bold)

#### All 6 Picked

1. **All model predictions**: Active tab's model full (confidence, win probability bar, verdict, notes). Others compact below.
2. **Save Result form**: 5 result buttons (Left Win Sweep / Left Win / Draw / Right Win / Right Win Sweep), notes textarea, "Save Result" button. Teams auto-reset after saving. Info icon tooltip on "Record Match" title explains what sweeps mean.

#### Records Tab

View-only list. Each record: match line + notes below. Three actions: **Copy Data** (clipboard, "Copied!" feedback) | **Export .data** (file) | **Clear All**.

#### Meta Tab

Aggregate statistics across all match data. Left column: sortable tables (`WandWarsMetaTeams`). Right column: insights and counter rows (`WandWarsInsights`).

Three category sub-tabs: **Units** | **Synergy** | **Teams**

**Units table**: Sortable by Usage, Win %, 1st Pick. Default sort: Usage.

**Synergy table**: Sortable by Usage, Win %, Record (W/L), Synergy. Minimum `META_MIN_PAIR_MATCHES` (3) matches. Default sort: Synergy (positive first, negative last). Info icon tooltip on Synergy header. Synergy score = `pair win rate - average of each hero's individual win rate`. Color-coded green/red.

**Teams table**: Sortable by Usage, Win %, Record (W/L). Minimum `META_MIN_TEAM_MATCHES` (2) matches. Default sort: Usage. Uses shared `computeTeamRecords()`.

**Right column insights**: Dataset header (match count, hero count, bias disclaimer) at top. Units: Best Openers (heroes with highest Bayesian-smoothed win rate as left-team first pick) and Best Responses (right-team first pick that counters a specific left opener, shown as responder → opener with W/L and score out of 10 — a responder that counters multiple openers is consolidated into a single row). Synergy: ~10 most impactful insights (strongest/weakest pair, most played, best/worst team player, opponent diversity, undefeated pairs cap 2, winless pair cap 1). Teams: team counter matchups as counter rows, sweep count, and left/right side win rate advantage (shown when > 3% deviation from 50%).

**Threshold-based sizing (no hard caps)**: Insight sections grow naturally as the dataset grows — there are no fixed `slice(0, N)` limits. Each section uses statistical thresholds so low-quality entries are filtered out:

| Section                   | Thresholds                                                                                                                                                                        |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Best Openers              | ≥ 3 matches AND Bayesian win rate ≥ 0.55                                                                                                                                          |
| Best Responses            | ≥ 2 matches AND wins > losses                                                                                                                                                     |
| Pair Counters             | ≥ 2 wins AND wins > losses. Pair-vs-pair entries additionally require wins across ≥ 2 distinct opposing full teams, to suppress redundant slices of a single repeated 3v3 matchup |
| Team Counters             | ≥ 2 wins AND winner's wins ≥ 2× losses in the head-to-head (e.g., 2-0, 4-1, 4-2 qualify; 3-2 does not)                                                                            |
| Most Dominant Pairs/Teams | ≥ 2 dominant (sweep) wins                                                                                                                                                         |

This replaces earlier hard caps (Best Openers 10, Best Responses 15, Pair Counters 20, Team Counters 20, Dominant Pairs/Teams 10 each).

**Shared meta code**: `TeamRecord` in `types.ts`, `computeTeamRecords()` in `analysis.ts`, `META_*` constants in `constants.ts`, `formatSigned()` in `formatting.ts`.

## 9. Pool Restriction (Screenshot Import)

Opens from a "Restrict to Pool" button on the draft tab. Uploading a screenshot of the game's 4×5 hero pool restricts the picker grid and recommendations to just those 20 heroes — useful when the game hands you a limited pool per match.

### Pipeline

1. **Reference signatures** (precomputed, committed): each hero portrait is reduced to a 1024-float normalized 32×32 circular-masked grayscale fingerprint, base64-encoded into `heroPortraitSignatures.ts`. No PNG assets ship in the repo.
2. **Screenshot ingest**: user drops or selects a PNG/JPG screenshot. Does not need to be pre-cropped — `suggestGridCrop()` auto-detects the 4×5 grid region (see Auto-Crop below). User can drag to adjust the crop before proceeding.
3. **Cell extraction**: image is sliced into `rows × cols = 4 × 5 = 20` cells by dividing the cropped region geometrically.
4. **Local offset search**: for every cell, a 5×5 grid of offsets (±10% of cell size per axis) is tried — each offset produces a signature, and the offset with the best-matching reference is kept. This absorbs grid alignment slop without needing a global template search.
5. **Matching**: each candidate signature compares against every reference via 1 − NCC (normalized cross correlation). Smaller distance = stronger match; `acceptThreshold` (0.5) rejects anything below confidence.
6. **De-dupe**: if two cells both claim the same hero, the farther match loses its top pick and falls back to its best non-conflicting alternative.
7. **Review UI**: the user sees each cell with its crop preview, a confidence badge (green < 0.2, amber ≤ 0.35, red above, dashed red for "unknown"), and a searchable picker to override any cell manually.
8. **Apply**: the confirmed 20 heroes become the `poolFilter` on the WandWars view, narrowing `allHeroes`, picker availability, and recommendation candidates everywhere.

### Auto-Crop Detection (`suggestGridCrop`)

Locates the 4×5 card grid inside an arbitrary screenshot that may include game UI (team slots, countdown timer, buttons).

1. **Gold pixel density**: downscale to 320px width, scan every pixel for gold card-border color (HSV hue 25–55°, minimum brightness and saturation). Build per-row and per-column gold pixel counts.
2. **Dense range detection**: `largestDenseRange()` finds the longest contiguous axis range where smoothed gold density exceeds a threshold (2% of axis width, 5% smoothing window).
3. **Aspect ratio constraint**: if the detected region is too tall for a 5×4 grid (W/H < 0.675), compute the expected height from the width using the grid's natural aspect ratio (~0.9), then slide a window of that height to find the vertical sub-range with the highest gold density. This excludes team slots and timers above/below the grid.
4. **Edge trimming**: trim low-density tails from all four edges. Compares a 3-pixel average at each edge against 20% of the interior mean density — card borders are far denser than background, so this reliably stops at the grid edge without overshooting.
5. **Padding**: small outward buffer (1%) to include full outer card edges.

User can always drag to redraw the crop manually if auto-detection is insufficient.

### Signature generation (dev tool)

Two buttons in the pool import modal, both reading an arbitrary user-picked folder of PNGs via `<input webkitdirectory>`:

- **Generate Signatures**: compute signatures in the browser (same code path as runtime), serialize as a `Record<string, string>` (base64) module, and trigger a download of `heroPortraitSignatures.ts`. User replaces the committed file and commits.
- **Upload Reference** (acts as session override): compute signatures and install them in memory via `setOverrideReference()`. Detection uses the uploaded set until the button is clicked again (now labelled **Revert to Default**) or the page is reloaded. Nothing is written to disk.

Both flows share `buildSignaturesFromFiles()` in `heroPortraitSignatureBuilder.ts`; they diverge only in what they do with the result.

### Reference portrait hygiene

Portraits live locally under `src/wandwars/data/raw/portraits/` (gitignored). A Node script, `scripts/normalize-references.mjs`, does a one-shot pass:

1. Detects the gold-border bounding box via HSV-threshold pixel scanning.
2. Crops to that bbox.
3. Resizes to uniform 170×230 (close to the card's natural ~0.72:1 aspect).
4. Flattens transparency to a neutral grey so all references have identical corner pixels.

After normalization, the reference set is uniform, so the perceptual signatures are directly comparable to each other and to screenshot cells.

### Files

- `imageSignature.ts` — `computeSignature()` + `signatureDistance()` (1 − NCC)
- `poolDetect.ts` — `detectPool()` with offset search + de-dupe
- `heroPortraitSignatures.ts` — auto-generated committed base64 map
- `heroPortraitSignatureBuilder.ts` — folder → signatures (in-memory or downloadable module)
- `bundledReference.ts` — loads committed signatures; supports runtime override
- `components/wandwars/WandWarsPoolImport.vue` — the modal UI

## 10. Design Decisions

| Decision                | Choice                                                                     | Rationale                                                                           |
| ----------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Pick order irrelevance  | Models evaluate unordered team sets; draft position stats in Insights only | Order affects model strength, but positional win rates shown as read-only insights  |
| Bayesian prior          | 3.0 in analysis layer; 1.0 in Popular Pick's own pair/trio rates           | Prior of 1.0 too weak for analysis (2W/0L = 75%); Pop Pick keeps 1.0 for reactivity |
| B-T regularization      | L2 via virtual observations, not pick rate blending                        | Proper Bayesian; handles small samples at parameter fitting level                   |
| B-T pair interactions   | Post-hoc residuals from additive model, not jointly fitted                 | Simpler; avoids negative parameters in MM algorithm; still captures duo chemistry   |
| Composite: no pick rate | Win Rate (0.5) + Synergy (0.3) + Counter (0.2) + Trio bonus                | Keeps Composite focused on interactions; distinct from Popular Pick                 |
| Composite: trio synergy | Additive bonus when trio has 3+ matches, scaled by data strength           | Captures three-way interactions that don't decompose into pairs                     |
| Adaptive ML approach    | Pure TS training + inference, no external ML libraries                     | Tiny model (~1,700 params); raw matrix ops are fast; zero bundle bloat              |
| Adaptive ML embeddings  | 16-dim per hero, team = sum, predict from difference                       | Side-symmetric; parameter-efficient; generalizes B-T from 1-dim to 16-dim           |
| Counter indicators      | "Strong/Weak against" not "Counters/Countered by"                          | Softer language avoids absolute claims with limited data                            |
| Label: "Popular Pick"   | Renamed from "Meta Pick"                                                   | "Popular" doesn't conflict with weakness badges                                     |
| Pick slots responsive   | CSS container queries (not media queries)                                  | Responds to column width, not viewport                                              |
| Record storage          | `localStorage` key `stargazer.wandwars.records`; immutable                 | Snapshots at submit time; copy/export for portability                               |
