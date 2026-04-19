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
- Raw data files are gitignored; the encoded `data` file is committed and inlined into the JS bundle via Vite `?raw` import

Examples:

```
natsu,silvina,faramor > tilaya,harak,kordan;{faramor} true damage counters {tilaya}
tasi,dunlingr,daimon << kordan,zandrok,gerda
```

## 3. Architecture

All WandWars code lives under `src/wandwars/` (domain logic), `src/components/wandwars/` (UI), and `src/views/WandWarsView.vue` (page). Route: `/wandwars` (no locale prefix, not SSG pre-rendered).

**Data pipeline**: Raw `.data` files → `npm run ww:encode` (concatenate + base64) → `data` file committed → Vite `?raw` import → decoded at runtime via `atob`.

**Adding data**: Edit raw files → (optional) `npm run ww:validate <file>.data` to sanity-check before merging → `npm run ww:encode` → `npm run ww:train` → commit. `ww:train` runs the NN training **and** then the 5-fold benchmark + probability calibration fit as a single step (no separate calibrate step). Both `nnWeights.ts` and `calibrationData.ts` are regenerated and must be committed together.

`ww:validate` is a pre-merge sanity check for a new raw file: parses it against the existing baseline, flags unknown heroes, reports distribution drift (left-win rate, sweep rate, draws), lists per-hero win-rate shifts, and runs a held-out prediction check to compare its predictability against 5-fold CV accuracy. Optional but useful for catching typos or mislabeled matches before training.

**localStorage**: `stargazer.wandwars.records` — recorded match results.

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

### Two kinds of confidence badge

WandWars shows two semantically different "high/medium/low" badges. They share visual styling but measure different things, and live in different places.

**1. Match-prediction confidence** — on the aggregate and per-model matchup prediction cards. Reflects whether the final probability is trustworthy.

- Based on two signals: **distance from 50%** of the calibrated probability and **stddev across the four models' calibrated probabilities** (agreement).
- Thresholds are tuned offline by the benchmark script against held-out CV data so that "high confidence" predictions empirically hit ≥75% accuracy. Stored in `calibrationData.ts` as `CONFIDENCE_THRESHOLDS`.
- Per-model badges (on the individual model cards) use distance-from-50% only — single-model predictions can't measure agreement.
- Implemented in `recommend.ts`.

**2. Hero data depth** — on per-hero recommendation cards while drafting. Reflects how many matches the hero has been in; unchanged from the original Wilson score.

```
Wilson 95% CI width < 0.20 → rich data (high,   ~36+ matches near 50% WR)
Wilson 95% CI width < 0.35 → moderate data (medium, ~12–15 matches)
Otherwise (or <3 matches) → sparse data (low)
```

Tightened from 0.3/0.5 at ~1,250 matches because the looser thresholds meant nearly every hero read as "rich data" — the badge had lost its power to distinguish well-measured from less-measured heroes. Wilson's absolute interpretation is dataset-size-independent; the distribution of heroes across the three bands is what shifts as data grows. Revisit thresholds at major dataset doublings (e.g. ~5,000 matches).

- Displayed under "Rich / Moderate / Sparse data" tooltip copy to distinguish from match-prediction confidence.
- Still computed per-hero in `confidence.ts` via Wilson score on weighted wins, consumed by `modelUtils.ts`'s `getHeroWilsonConfidence`.

The two badges were previously conflated under a single Wilson-score "confidence" label, which misled users into treating "high confidence" as a match-prediction reliability signal when it was really a data-depth signal.

### Probability Calibration (calibration.ts + calibrationData.ts)

Raw model probabilities are **miscalibrated** — a model saying "80% left wins" historically hit ~60%, inflating user expectations. Each model's output is mapped through a per-model calibration table before display.

**How it's fit** (`scripts/benchmark.ts`):

1. 5-fold CV on decisive matches (draws excluded from CV but kept in each fold's training data).
2. Per fold: retrain the NN from scratch on 4 folds (honest NN calibration — the NN otherwise cheats by having seen the test matches during training), build `AnalysisData` from 4 folds, predict the held-out fold with all four models.
3. Collect `(rawProb, actualOutcome)` pairs per model across all folds.
4. Fit **isotonic regression** per model (≥ 300 samples) via Pool Adjacent Violators, downsampled to 12 lookup bins. Falls back to **Platt scaling** (2-param logistic) at 100–300 samples, or **identity** (no calibration) below 100.
5. Tune `CONFIDENCE_THRESHOLDS` (distance, stddev) against the held-out aggregate predictions — grid-searches thresholds that give "high confidence" ≥ 75% accuracy and "medium confidence" ≥ 65% accuracy.
6. Write `calibrationData.ts` with the calibration tables and tuned thresholds.

**How it's applied** (`prediction/calibration.ts` + `prediction/recommend.ts`):

- `calibrate(modelId, rawProb)` — piecewise-linear interp on the isotonic bins (or Platt logistic).
- `recommend.ts:calibratedPrediction` wraps every model's `predictMatchup` output so the displayed `leftWinProbability` and per-model confidence badge reflect the calibrated value.
- Aggregate prediction is a weighted average of the four calibrated probabilities. Its confidence badge uses distance-from-50% + cross-model stddev.

**What calibration does NOT touch**:

- Per-hero recommendation cards (`recommend()`) — scores are rankings, not matchup probabilities; calibration is monotonic so rankings would be unchanged anyway.
- Breakdown fields inside recommendation cards (synergy %, λ, contextual win rate, etc.) — these are hero-level or component stats, not matchup predictions.
- Pair/trio records, hero stats, counter matrix — analysis layer, untouched.

**Regeneration**: fully automatic as part of `npm run ww:train`. The command first trains the NN on full data (and writes `nnWeights.ts`), then runs the benchmark + calibration fit (and writes `calibrationData.ts`). Both files must be committed together.

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

Tab order: **Popular Pick** (default) | **Hero Synergy** (Composite) | **Team Power** (Bradley-Terry) | **Adaptive ML** | **Records**. Individual match-prediction cards follow the same model order. (Meta is a separate left-column view, not a model tab.)

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
5. Win probability is adjusted: `baseProb + leftPairAdj − rightPairAdj`, clamped to [0.05, 0.95] (loosened from [0.02, 0.98] so the downstream calibration map has resolution near the extremes)

This gives B-T synergy awareness with proper statistical grounding rather than heuristic weights.

#### Breakdown

- Strength: λ parameter (relative to average 1.0)
- Win Prob: predicted team win probability (includes pair interactions)
- Pair Synergy: ±% adjustment from duo chemistry (shown when non-zero)
- Pick Rate: informational only, not used in score

---

### Model D: Adaptive ML — "Adaptive ML" (`adaptiveML.ts`)

**Philosophy**: Learned pattern discovery — "what patterns exist in the data that hand-crafted models miss?"

#### Architecture

Hero embeddings (87×16) → team sum → difference → Dense(16) → ReLU → Dense(1) → Sigmoid.

Each hero gets a 16-dimensional learned "profile" vector. Team representation = sum of hero embeddings. Prediction uses the difference between team embeddings, so swapping sides correctly flips the probability.

~1,700 parameters total — conceptually a generalization of Bradley-Terry from 1-dim strength to 16-dim profiles. Implemented in pure TypeScript with no external ML libraries (zero bundle bloat). Trained offline via `npm run ww:train`, weights committed as `nnWeights.ts`.

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

Run `npm run ww:train` after adding new match data. The script runs 10 training rounds with different deterministic seeds, selects the best by validation accuracy, and exports those weights to `nnWeights.ts`. Deterministic — same data always produces the same result. Commit the updated weights file.

#### Future Improvements (2,000+ matches)

Current architecture is constrained by data size (~1,700 params for ~2,000 augmented samples). With more data:

- **Larger embeddings** (24 or 32 dims instead of 16): richer hero profiles that capture more nuances of playstyle. Viable at ~2,000+ matches.
- **Deeper network** (add a second hidden layer): enables more complex team interaction modeling beyond what a single layer can learn. Viable at ~3,000+ matches.
- **Separate offense/defense embeddings**: a hero may contribute differently when on your team vs the opponent's. Doubles embedding params, so needs ~3,000+ matches.

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

Popular Pick, Hero Synergy, and Team Power recompute from scratch on every page load. Adaptive ML uses pre-trained weights and requires explicit retraining (`npm run ww:train`). Workflow: add matches → `npm run ww:encode` → `npm run ww:train` → commit.

| Matches | Popular Pick                                  | Hero Synergy (Composite)                          | Bradley-Terry                             | Adaptive ML                                                  |
| ------- | --------------------------------------------- | ------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------ |
| 5-20    | Already useful; win rates + pick rates        | Win Rate dominates; sparse pair data              | Regularization dominates                  | Not useful; embeddings random                                |
| 20-50   | Pair records appearing; team suggestions work | Synergy/counter starting to appear                | Regularization fading; pair data sparse   | Not useful; heavy overfitting                                |
| 50-100  | Rich pair data; strong team suggestions       | Popular pairs show synergy                        | Reliable; pair interactions emerging      | Marginal; noisy embeddings                                   |
| 100-200 | Very reliable pair records                    | Medium+ confidence; synergy fills in              | Stable; pair data growing                 | Starting to learn; frequent heroes OK                        |
| 200-500 | Complementary to B-T/Composite                | Rich synergy/counter; trio data appearing         | Stable; pair interactions well-populated  | Competitive; embeddings stabilizing                          |
| 500+    | Quick reference + pair lookup                 | Rich trio data; three-way interactions measurable | Strong pair interactions; well-calibrated | May discover nonlinear patterns — not yet confirmed (see §7) |

## 6. Recommendations & Team Suggestions

### Top Teams (Data-Backed)

Pinned above recommendations on all model tabs when 1+ hero picked on current side. Exact 3-hero compositions from match data. Info tooltip on hover explains the section.

- Contains all currently-picked teammates
- Excludes teams with any already-picked hero (either side)
- **Only positive W/L** shown (wins > losses)
- Sorted by Bayesian-smoothed win rate
- Up to 3 shown with actual W/L (green/red)

### Suggested Teams (Model-Scored)

Scored by aggregating all four prediction models — can evaluate any hero combination, including trios that never appeared together in data. Info tooltip on hover explains the section.

**With 2 teammates**: All possible 3rd picks are scored by all four models (Popular Pick, Hero Synergy, Team Power, Adaptive ML), aggregated using the same adaptive weights as the match prediction. Each model's `recommend()` scores the candidate independently, then scores are weighted and combined.

**With 1 teammate**: All (teammate, i, j) trios are enumerated and each one is scored by all four models via dedicated "team quality" functions in `teamSuggestions.ts`:

- **Popular Pick** — avg individual win rate + avg pair win rate (from `synergyMatrix` pair records).
- **Hero Synergy (Composite)** — avg Bayesian win rate + pairwise synergy + trio bonus (when the trio has ≥ 3 matches).
- **Team Power (Bradley-Terry)** — `Σλ(team) / (Σλ(team) + avgOpp)` plus pair interaction residuals, using a single fold-cached B-T fit.
- **Adaptive ML** — `predictVsAverage(team)`: NN forward pass against ~50 sampled generic opponent trios.

Scores are combined with the same adaptive weights as the 2-teammate case. Enumerating ~3–5k trios (for 1 known teammate among ~87 heroes) stays well under 100ms because every scorer is O(1) lookups or a single forward pass — no per-trio model refits.

Previously the 1-teammate case used NN only, which was problematic given the NN's current CV accuracy. The ensemble approach closes that gap.

- Deduplicated against exact trios (won't repeat data-backed teams)
- Dashed border, predicted win rate displayed (muted, to distinguish from real W/L records)
- Up to 3 shown, sorted by NN-predicted win rate
- Max width capped at 1/3 container (consistent sizing)

### Hero Ordering

Picked heroes first (in pick order), then remaining alphabetically.

### Confidence / Data Depth Badges

Two different badges, both rendered as high / medium / low chips — see Section 4 for the broader rationale.

**Recommendation cards (data depth)** — Wilson score 95% CI width on the hero's weighted win/loss record. Answers "how well do we know this hero?", not "how reliable is the prediction?". Tooltip: "Rich / Moderate / Sparse data".

| Label      | Condition                           | Color  | Meaning                              |
| ---------- | ----------------------------------- | ------ | ------------------------------------ |
| **high**   | CI width < 0.20 (~36+ matches)      | Green  | Tight statistical estimate           |
| **medium** | CI width 0.20–0.35 (~12–15 matches) | Yellow | Moderate estimate, more data helpful |
| **low**    | < 3 matches, or CI width ≥ 0.35     | Red    | Wide/unreliable estimate             |

**Matchup prediction (prediction reliability)** — distance of the calibrated aggregate from 50%, plus across-model stddev. Thresholds tuned against held-out CV so "high" hits ≥ 75% accuracy. Tooltip: "High/medium/low confidence" framed as prediction reliability.

| Label      | Condition (aggregate)                                               | Meaning                                   |
| ---------- | ------------------------------------------------------------------- | ----------------------------------------- |
| **high**   | \|p − 0.5\| ≥ `highDistance` AND stddev ≤ `highAgreementStddev`     | Calibrated prediction clear; models agree |
| **medium** | \|p − 0.5\| ≥ `mediumDistance` AND stddev ≤ `mediumAgreementStddev` | Calibrated prediction moderate            |
| **low**    | otherwise                                                           | Close to 50/50 or models disagree         |

Per-model matchup cards use distance only (no agreement signal with one model).

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

## 7. Benchmark + Calibration (5-Fold Cross-Validation)

The benchmark runs **automatically** as part of `npm run ww:train` (second phase, after NN training). It drives two artifacts at once: a reproducible accuracy/Brier table and the per-model calibration tables plus confidence thresholds written to `calibrationData.ts`.

### What It Measures

We pretend we don't know the outcome of some matches, ask each model to predict who wins, then check if it was right:

1. Take all decisive matches (draws excluded from CV but kept in each fold's training data), shuffle with fixed seed 42, split into 5 equal folds.
2. For each fold: hide it, build analysis + **retrain the NN from scratch** on the other 4 folds, predict the hidden matches.
3. After all 5 rounds, every match has been predicted exactly once on data none of the models saw during training.

This simulates real-world use — predicting a future match, not memorizing past ones.

- **Accuracy**: did the favored team actually win?
- **Brier score**: how confident was the prediction, and was that confidence justified? A model that says 90% and is right scores better than 55% and right, but 90% and _wrong_ gets heavily penalized. Lower = better. A coin-flip model scores 0.25.

### Calibration Fit

After collecting `(rawProb, actual)` pairs per model, the benchmark fits a calibration curve so displayed probabilities match empirical win rates:

- **Isotonic regression** (≥ 300 samples, default) via Pool Adjacent Violators, downsampled to 12 piecewise-linear bins. Non-parametric, monotonic.
- **Platt scaling** (100–300 samples) as a fallback — a 2-parameter logistic fit; safer with small data.
- **Identity** (< 100 samples) — no calibration; the pipeline refuses to fit with too little evidence.

The resulting maps are written to `src/wandwars/prediction/calibrationData.ts` and applied at runtime via `calibrate(modelId, rawProb)` in `calibration.ts`. Confidence thresholds (`CONFIDENCE_THRESHOLDS`) are grid-searched on the calibrated held-out aggregate predictions so "high confidence" hits ≥ 75% accuracy and "medium" ≥ 65%.

### Honest NN Caveat (Resolved)

Earlier benchmarks trained Adaptive ML once on the full dataset and then measured its accuracy on held-out folds — giving it an unfair advantage because the NN had seen every match during training. The current benchmark **retrains the NN from scratch per fold** (~0.1–0.3s per fold — fast because the net is tiny and early-stopping patience fires quickly). Adaptive ML's numbers dropped accordingly but are now comparable with the other three models.

Bradley-Terry gets the same per-fold treatment: fit once on each fold's training data (~0.25s per fold) and reuse across all test-match predictions in that fold. An earlier iteration of the benchmark refit B-T inside `predictMatchup` on every call, doing ~1,125 refits per run; caching the fit dropped total `ww:train` time from ~100s to ~7s without changing any output.

**Lower number ≠ worse model.** The NN itself didn't change between the old and new benchmarks — only the evaluation did. The old 61.5% was a leaky measurement: the NN had already nudged each hero's embedding in the direction of the test matches before being asked to predict them. The new 55.2% reflects what actually happens in real use — predicting a match the model has never seen. 55.2% is the accuracy users will actually experience; 61.5% never described the real product, it described a flawed measurement.

Combined with probability calibration, the net effect is that predictions are **less flashy but more trustworthy**: the headline accuracy is lower, but when the UI says 70% the model has historically hit ~70% in that bucket (verified by the reliability diagram). For decision-making, a calibrated 70% beats an overconfident 82% every time.

### Results — 2026-04-18 (1,146 matches, 1,132 decisive, 87 heroes)

| Model         | Accuracy  | Brier (raw) | Brier (calibrated) | Calibration    |
| ------------- | --------- | ----------- | ------------------ | -------------- |
| Popular Pick  | 57.9%     | 0.2418      | **0.2387 ↓**       | isotonic       |
| Hero Synergy  | 59.0%     | 0.2431      | **0.2375 ↓**       | isotonic       |
| Team Power    | 58.1%     | 0.2413      | **0.2393 ↓**       | isotonic       |
| Adaptive ML   | 54.9%     | 0.2583      | **0.2480 ↓**       | isotonic       |
| **Aggregate** | **58.0%** | —           | **0.2368**         | (blended)      |
| _Baseline_    | _53.6%_   | —           | —                  | _predict left_ |

Calibration lowered Brier score on all four models and the aggregate. Aggregate reliability post-calibration: most bins within ±5% of their predicted probability (see `benchmark.ts` reliability diagram output).

Adaptive ML's apparent accuracy drop (from the earlier reported 61.5% to ~55%) is the honest cost of per-fold retraining — the NN is also trained on fewer samples per fold and runs only once with its default seed. Numbers fluctuate slightly (±1–2%) across `ww:train` runs due to NN training stochasticity even with deterministic seeds.

### Confidence Thresholds (tuned on this dataset)

From the 2026-04-18 run:

| Badge  | Distance from 50% | Model stddev | Empirical accuracy | Coverage |
| ------ | ----------------- | ------------ | ------------------ | -------- |
| High   | ≥ 0.18            | ≤ 0.20       | 77.9%              | 9.2%     |
| Medium | ≥ 0.08            | ≤ 0.20       | 66.3%              | 42.0%    |

"Coverage" is the fraction of held-out matchups that qualify for the badge. Expect most matchups in the UI to show low/medium, with rare high — the inversion of the old behavior. Thresholds are re-tuned on every `ww:train` and will shift as the dataset grows.

### Aggregate Weights (tuned against calibrated benchmark)

Weights used in the combined match prediction, scaling by dataset size:

| Match count | Popular Pick | Hero Synergy | Team Power | Adaptive ML |
| ----------- | ------------ | ------------ | ---------- | ----------- |
| < 20        | 55%          | 30%          | 10%        | 5%          |
| 100         | 30%          | 30%          | 25%        | 15%         |
| 500+        | 25%          | 30%          | 25%        | 20%         |

At low data, Popular Pick dominates (works immediately). As data grows, weight shifts toward Hero Synergy and Team Power — the two models currently leading the calibrated CV benchmark. Adaptive ML gets meaningful ensemble weight at scale but not the largest share; see "Will Adaptive ML pull ahead at scale?" below for when to revisit. Calibration is per-model, so weighting the aggregate gives a properly-calibrated blend regardless of which model is leading.

These weights are mirrored in `teamSuggestions.ts` (Suggested Teams scoring) — keep the two tables in sync.

### Will Adaptive ML pull ahead at scale?

The weights above assume the NN eventually outperforms the hand-crafted models. That was the design bet, grounded in ML theory — a flexible model with 16-dim learned embeddings _should_ discover nonlinear hero interactions and multi-way patterns that Bradley-Terry's additive strengths and Composite's pairwise synergy can't capture.

**But the current benchmark does not support this.** At 1,146 matches:

| Model           | Accuracy  | Gap vs baseline (53.6%) |
| --------------- | --------- | ----------------------- |
| Hero Synergy    | 59.1%     | +5.5%                   |
| Popular Pick    | 59.0%     | +5.4%                   |
| Team Power      | 58.6%     | +5.0%                   |
| **Adaptive ML** | **55.2%** | **+1.6%**               |

Adaptive ML is the **worst** of the four, barely above a "always predict left" coin-flip. With ~1,700 parameters against ~2,000 augmented samples (and only one seed per fold), it's right at the data-starvation edge.

Three honest scenarios as data grows:

1. **NN crosses over (the bet):** more matches → embeddings stabilize → Adaptive ML beats the 59% ceiling of the statistical models. Expected if there are nonlinear patterns left to extract beyond what pairwise synergy + Bradley-Terry captures.
2. **Everyone plateaus together** around 60–65%: the game has irreducible noise (RNG, skill, meta shifts) that caps all models. The NN's extra capacity doesn't help because there's no more signal to extract.
3. **NN stays behind:** the hand-crafted priors (Bayesian smoothing, L2-regularized strength, pairwise synergy) turn out to be well-matched to this problem, and the NN's flexibility is mostly fitting noise.

We can't tell which is happening yet. **Every `ww:train` run prints the gap — watch whether Adaptive ML closes on the other three as data grows.** If the gap closes meaningfully over the next 500–1,000 matches, scenario 1. If it doesn't, revisit the "Future Improvements" bullets in §5 (bigger embeddings, deeper network, separate offense/defense embeddings) before concluding scenario 3. If the gap closes but everyone plateaus, adjust the aggregate weights to reflect reality rather than the original hypothesis.

## 8. Meta Insights

Three sub-tabs: **Units** | **Synergy** | **Teams**. Left column: sortable tables. Right column: auto-generated insights including ML-powered analysis from the Adaptive ML model's learned embeddings.

**Units insights**: Best Openers, Best Responses, **Similar Heroes** (embedding cosine similarity), and **Class composition** patterns (e.g., "Teams with 2+ tank overperform").

**Synergy insights**: ~10 most impactful pair insights (strongest/weakest pair, most played, best/worst team player, opponent diversity, undefeated pairs), and **Unexplored Synergies** (pairs the NN predicts will perform well but have < 5 actual matches).

**Teams insights**: Team counter matchups, sweep stats, side win rate advantage, **ML Top Teams** (strongest trios by neural network), and **Composition patterns** — damage type balance (all physical/magic/mixed), range balance (all melee/ranged/mixed), and energy level effects. Shown when > 5% deviation from 50% with 20+ teams.

## 9. Pool Restriction

Upload a screenshot of the game's 4×5 hero pool to restrict picks and recommendations to those 20 heroes.

**Pipeline**: Screenshot → `suggestGridCrop()` auto-detects the card grid via gold pixel density profiling (HSV hue 25-55°), with aspect ratio constraint for oversized regions and edge trimming for precision → user can adjust crop → cells extracted (4×5) with 5×5 offset search per cell → NCC matching against precomputed 32×32 grayscale signatures → de-dupe conflicts → user reviews with confidence badges → apply as pool filter.

**Signatures**: Base64-encoded in `heroPortraitSignatures.ts`. Generated in-browser from reference portraits normalized via `scripts/normalize-references.ts` (gold-border crop → 170×230 resize → grey background flatten). Dev tools in the pool import modal for generating and uploading signature sets.
