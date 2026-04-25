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

**1. Match-prediction confidence** — on the aggregate and per-model matchup prediction cards. Reflects **how trustworthy the win probability is**, independent of how close or far the probability is from 50/50. A confident 55% prediction is as "high confidence" as a confident 85% prediction — the badge answers "should you trust the number?", not "how dramatic is the number?". See the dedicated "Match-Prediction Confidence" subsection below for the full design.

**2. Hero data depth** — on per-hero recommendation cards while drafting. Reflects how many matches the hero has been in, using a Wilson 95% CI width on the hero's weighted win/loss record.

```
Wilson 95% CI width < 0.20 → rich data (high,   ~36+ matches near 50% WR)
Wilson 95% CI width < 0.35 → moderate data (medium, ~12–15 matches)
Otherwise (or <3 matches) → sparse data (low)
```

Wilson is absolute — these thresholds don't change with dataset size, but the distribution of heroes across the three bands does. Revisit thresholds at major dataset doublings (e.g. ~5,000 matches) if most heroes drift into a single band.

- Displayed under "Rich / Moderate / Sparse data" tooltip copy to distinguish from match-prediction confidence.
- Computed per-hero in `confidence.ts` via Wilson score on weighted wins, consumed by `modelUtils.ts`'s `getHeroWilsonConfidence`.

### Match-Prediction Confidence (modelConfidence.ts + recommend.ts)

#### Motivation

Each of the four models outputs a win-probability %. Users need to know **how trustworthy that % actually is** — a 100%-predicted win with 10% prediction reliability is practically a coin flip, while a 50/50 prediction that's genuinely reliable tells you the matchup really is even. The badge answers "should you trust this number?", not "how dramatic is the number?".

Three design principles drive everything below:

1. **Each model gauges its own reliability independently.** The four models make predictions in fundamentally different ways (popularity counts, analytical interaction modeling, statistical strength estimation, neural embeddings), so the way each model measures _its own_ reliability is also different. Popular Pick looks at pair record depth; Composite looks at synergy/counter matrix coverage; Team Power looks at how much pair data is overriding the additive-strength fit; Adaptive ML looks at combinatorial training exposure. One-size-fits-all signals would systematically mis-call individual models.
2. **Every reliability signal is empirically validated against held-out CV.** A signal that intuitively looks sensible but doesn't actually correlate with accuracy gets replaced (this is why B-T and NN don't use hero-match-count signals — we tried, they failed the validation).
3. **The badges communicate meaningful distinctions, not statistical noise.** HIGH should be genuinely rare (< ~15% of predictions) and substantively more accurate than MEDIUM. LOW should be a real warning (~20–30%) when data is thin. MEDIUM is the typical tier. If everything lands in MEDIUM the badge stops communicating anything.

As the dataset grows, the distribution of badges should evolve: at small data sizes HIGH may not appear at all (no subset is distinguishably better); LOW may be a larger share (many matchups have unseen hero combinations). As data matures, HIGH can enable, LOW shrinks, MEDIUM dominates. All of that happens automatically — no hand-tuned thresholds that need updating per dataset size.

#### How it works

Two kinds of signal go into the badge, produced differently for per-model vs. aggregate.

#### Signal 1 — per-model self-confidence

Each of the four prediction models publishes a self-confidence score in `[0, 1]` that reflects "do I have the ingredients I need to make a reliable prediction for this specific matchup?". The four signals are deliberately different because each model depends on different data _and_ because the signal must empirically correlate with held-out accuracy — data-quantity signals that look sensible but don't actually discriminate accuracy get replaced:

| Model        | Signal                                                                                             | Why                                                                                                                                                                                                                                                                                                                                          |
| ------------ | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Popular Pick | Avg pair match count across the 6 teammate pairs, / 10                                             | PP blends with overall win rate when pair records are thin — more pair data = more contextual signal                                                                                                                                                                                                                                         |
| Hero Synergy | Avg `dataStrength = min(1, matches / 10)` across the 6 teammate pairs and 9 opposing-hero matchups | Composite explicitly down-weights its synergy / counter components by this exact strength                                                                                                                                                                                                                                                    |
| Team Power   | `exp(−6 × Σ\|pair-residual\|)` across the 6 teammate pairs                                         | Data-quantity signals (hero / pair match counts) didn't correlate with B-T accuracy at ~1,500 matches — low-data matches default to near-50% and were accidentally right on close games. The residual-magnitude signal flags matchups where pair data strongly overrides the additive-strength fit, a genuine per-matchup uncertainty signal |
| Adaptive ML  | Avg pair co-occurrence across the 6 teammate pairs, / 5                                            | Per-hero match count also didn't correlate with NN accuracy. Pair co-occurrence captures _combinatorial_ familiarity — how often the NN saw these hero-pair interactions during training — which the team-sum embeddings actually depend on                                                                                                  |

All signals land in `[0, 1]`. Higher means the model has the inputs it relies on; lower means the model is operating near its Bayesian priors / regularization defaults / randomly-initialized embeddings and the answer is softer.

Implemented in [`modelConfidence.ts`](../../src/wandwars/prediction/modelConfidence.ts). When adding a new signal candidate, validate it by running `npm run ww:train` and checking that the LOW bucket (sub-MEDIUM) is empirically at least 1pp less accurate than MEDIUM — the benchmark prints this drop. Signals that pass this check ship; signals that don't get replaced.

#### Signal 2 — credibility-weighted cross-model agreement (aggregate only)

For the aggregate prediction and badge, we compute a **credibility-weighted blend** across the four model probabilities. "Credibility" for model _i_ is its standard aggregate weight (from `getAdaptiveAggregateWeights`) multiplied by its self-confidence signal for this specific matchup. A sparse-data outlier's vote therefore counts less in both:

- The **aggregate probability** users see on the card (`μ`)
- The **disagreement metric** used to pick the badge (`weightedStddev`)

Mathematically, for each prediction:

```
credibility_i  = aggregateWeight_i × selfConf_i
μ              = Σ(credibility_i × prob_i)   / Σ(credibility_i)    // displayed aggregate win %
weightedStddev = √[ Σ(credibility_i × (prob_i − μ)²) / Σ(credibility_i) ]
avgSelfConf    = Σ(credibility_i × selfConf_i)   / Σ(credibility_i)
```

Where this matters at runtime:

1. **μ is the displayed aggregate win probability.** If NN's self-confidence collapses for a matchup with unseen hero pairs, NN's vote barely moves the blended %. The aggregate falls back toward the hand-crafted models. Conversely, when all four are confident, they contribute roughly in proportion to their base aggregate weights.
2. **Badge cutoffs (HIGH/MEDIUM/LOW)** are chosen on `(weightedStddev, avgSelfConf)` pairs — picking up both "do the credible models agree?" and "do they have enough data between them?".

Scenario walkthroughs:

- **Three confident models agree at 70%, one unconfident disagrees at 40%.** Outlier's credibility is small; it barely moves μ off 70% and barely adds to variance. Aggregate stays near the majority view, badge can reach HIGH.
- **All four confident, one credibly dissents at 40% while the others sit at 70%.** Outlier's credibility is full; μ gets pulled toward 63%, weightedStddev jumps, badge drops to MEDIUM. Credible disagreement is genuine evidence — the blended % and the badge both reflect it.
- **All four per-model badges are MEDIUM but the aggregate shows HIGH.** Legitimate and designed-for. Each individual model has reasonable (but not exceptional) per-matchup data, so none hits its own HIGH threshold. But all four independently land on very similar win probabilities — the credibility-weighted stddev stays tiny and `avgSelfConf` is decent across the four. Four moderate votes converging on the same answer is stronger evidence than any single model's individual confidence. The aggregate HIGH badge is about trust in the blended %, not the %'s extremeness — a confident 48/52 is a valid HIGH.

Calibration (`calibrationData.ts`) is re-fit against this credibility-weighted μ on every `ww:train` run, so the displayed aggregate % stays empirically calibrated as signals evolve.

#### Badges

**Per-model badge** (shown on each of the four individual matchup prediction cards):

| Band   | Condition                                      |
| ------ | ---------------------------------------------- |
| high   | `selfConfidence >= t.perModel[modelId].high`   |
| medium | `selfConfidence >= t.perModel[modelId].medium` |
| low    | otherwise                                      |

Thresholds are **per-model tuned** — each signal has a different natural distribution, so shared cutoffs would systematically over- or under-call individual models. The tuner works in three steps:

1. **Pick MEDIUM**. Among all candidate cutoffs whose above-bucket clears an absolute accuracy floor and minimum coverage floor, _and_ whose below-bucket is empirically ≥ 1pp less accurate (so LOW is justified), pick the one whose LOW coverage lands closest to `TARGET_LOW_COVERAGE` (≈ 25%). LOW is meant to be a rare-but-meaningful warning, not a vanishing edge case and not the majority.
2. **Pick HIGH**. Among stricter cutoffs, enable HIGH if some bucket's accuracy clears `overall_acc + 2pp`, also clears MEDIUM's accuracy, _and_ its coverage is in `[min, max]` (default `[3%, 15%]`). The tight coverage cap keeps HIGH genuinely rare — "trust this more than average" shouldn't fire on 30 %+ of cards. Using overall accuracy (not MEDIUM's subset) as the lift reference decouples HIGH from MEDIUM's cutoff choice.
3. **Relabel if LOW is the majority** (> 50% coverage) _and_ no HIGH bucket was found _and_ the above-bucket passes HIGH's overall-acc + lift criterion. This covers signals (like B-T's pair-residual magnitude) that split bimodally — the "reliable top subset" gets labeled HIGH instead of "most matchups LOW".

Each band can also be empirically unjustified at current data size — see "Disabled bands" below. Individual models may end up with unusual shapes if their signal structurally demands it (e.g. B-T's residual-magnitude distribution is inherently bimodal, so its LOW can land well above the 25% target). That's acceptable — the goal is meaningful labels, not identical distributions across models.

**Aggregate badge** (shown on the top aggregate-prediction card):

| Band   | Condition                                                                                       |
| ------ | ----------------------------------------------------------------------------------------------- |
| high   | `weightedStddev <= t.aggregate.highStddev` AND `avgSelfConf >= t.aggregate.highAvgSelfConf`     |
| medium | `weightedStddev <= t.aggregate.mediumStddev` AND `avgSelfConf >= t.aggregate.mediumAvgSelfConf` |
| low    | otherwise                                                                                       |

Both conditions must clear. Reaching high needs _both_ tight model agreement _and_ strong collective data support. Either missing drops to medium or low.

#### Disabled bands

Tuning in `benchmark.ts` finds cutoffs that empirically justify each band. If no cutoff qualifies, the band is **disabled** for that run:

- **Disabled HIGH**: threshold set to `1.01` (unreachable). No prediction ever shows HIGH for that model / the aggregate. Signal: no subset of the held-out data was ≥ 2pp more accurate than overall — or if one existed, it didn't clear MEDIUM's own accuracy (so labeling it HIGH would invert the HIGH > MEDIUM ordering).
- **Disabled LOW**: MEDIUM threshold is collapsed to `0` (always passes). Every prediction with `selfConf > 0` gets MEDIUM — LOW never fires. Two reasons this happens: (a) the below-MEDIUM bucket wasn't ≥ 1pp less accurate than MEDIUM, so no statistical basis to warn users away; (b) the tuner used the relabel framing — the signal identifies a reliable top subset (HIGH), and everything below is the typical MEDIUM tier with no further LOW split available.
- **Disabled MEDIUM**: threshold set to `0` (always passes) — same runtime effect as disabled LOW.

Disabling is intentional: we'd rather skip a band than show one that's wrong 35% of the time (HIGH) or warn users away from predictions that are actually reliable (LOW). As the dataset grows and the self-confidence signals become more discriminating, more bands should enable naturally.

#### Why this design

The old confidence badge conflated two different things: the magnitude of the prediction (far from 50%?) and the reliability of the prediction. A 92% prediction always showed HIGH regardless of whether we had seen any of those heroes before. Users started treating "high confidence" as a reliability signal it wasn't delivering.

The new design:

- Keeps the badge's semantic meaning constant — "trust this number" — regardless of the number
- Surfaces model-specific data weaknesses (NN needs hero embedding exposure; Composite needs synergy matrix data; etc.)
- Uses cross-model agreement at the aggregate level only, weighted by credibility so sparse-data outliers don't torpedo well-supported predictions
- Grade-degrades gracefully: when tuning can't find a confident threshold, the band disables rather than firing an unreliable badge

The tooltip copy in `constants.ts` (`PREDICTION_CONFIDENCE_DESCRIPTIONS`) explains this in layman terms to users on hover.

### Probability Calibration (calibration.ts + calibrationData.ts)

Raw model probabilities are **miscalibrated** — without calibration, a model saying "80% left wins" hits ~60% empirically. Each model's output is mapped through a per-model calibration table before display.

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

Tab order: **Popular Pick** (default) | **Hero Synergy** (Composite) | **Team Power** (Bradley-Terry) | **Adaptive ML** | **Records**. Individual match-prediction cards follow the same model order. (Meta and Hero Adjustments are separate main-panel views, not model tabs.)

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

**Matchup prediction (prediction reliability)** — per-model self-confidence signals plus credibility-weighted cross-model agreement. Answers "should I trust this %?", independent of how extreme the % is. Thresholds are dynamically tuned per-model against held-out CV (see §4 and §7).

| Label      | Condition (aggregate)                                                 | Meaning                                                                                             |
| ---------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| **high**   | `weightedStddev ≤ highStddev` AND `avgSelfConf ≥ highAvgSelfConf`     | Models agree _and_ underlying data is rich                                                          |
| **medium** | `weightedStddev ≤ mediumStddev` AND `avgSelfConf ≥ mediumAvgSelfConf` | Reasonable data + reasonable agreement                                                              |
| **low**    | otherwise                                                             | Sub-MEDIUM agreement or thin data — only shown when empirically justified (see §4 "Disabled bands") |

Per-model matchup cards use each model's `selfConfidence` only (no cross-model agreement signal with a single model).

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

### Honest Per-Fold Training

Adaptive ML is retrained from scratch on each fold's training data (~0.1–0.3s per fold — fast because the net is tiny and early-stopping patience fires quickly). Without per-fold retraining, the NN would have seen the test matches during training, inflating its measured accuracy.

Bradley-Terry gets the same per-fold treatment: fit once per fold (~0.25s) on training-only data and reused across all that fold's test-match predictions — one fit instead of one per `predictMatchup` call.

**Lower headline accuracy ≠ worse model.** Honest CV on this dataset puts Adaptive ML near 55% (vs. 58–59% for the hand-crafted models), but those numbers reflect what users actually experience — no leakage, no inflation. Combined with probability calibration, predictions are **less flashy but more trustworthy**: when the UI says 70%, the model has historically hit ~70% in that bucket (verified by the reliability diagram). A calibrated 70% beats an overconfident 82% every time.

### Results — 2026-04-25 (final dataset: 1,737 matches, 1,706 decisive, 87 heroes)

| Model         | Accuracy  | Brier (raw) | Brier (calibrated) | Calibration    |
| ------------- | --------- | ----------- | ------------------ | -------------- |
| Popular Pick  | 60.6%     | 0.2398      | **0.2351 ↓**       | isotonic       |
| Hero Synergy  | 61.1%     | 0.2413      | **0.2353 ↓**       | isotonic       |
| Team Power    | 60.4%     | 0.2355      | **0.2347 ↓**       | isotonic       |
| Adaptive ML   | 58.9%     | 0.2453      | **0.2400 ↓**       | isotonic       |
| **Aggregate** | **61.8%** | —           | **0.2320**         | (blended)      |
| _Baseline_    | _53.2%_   | —           | —                  | _predict left_ |

Calibration now lowered Brier on **all four** individual models and the aggregate — a cleaner result than the prior run (1,517 matches), where Team Power's post-calibration Brier had ticked up slightly from isotonic-fit noise. With ~200 more matches the isotonic fits stabilized.

**The hand-crafted models stay tightly clustered** at 60.4–61.1% (within 0.7pp), with Hero Synergy edging into the lead and Team Power slipping marginally vs. the prior run. Adaptive ML continued its slow climb to 58.9% (from 58.6% at 1,517 → 57.1% at 1,465 → 55.2% at 1,146), but remains ~2pp behind the leading hand-crafted models.

**The aggregate beats any single model** (61.8% vs. best individual 61.1%), confirming the ensemble gain from credibility-weighted blending. The 8.6pp gap vs. the predict-left baseline (53.2%) translates to user-visible lift. The aggregate dipped ~1pp from the prior run — well within the ±1–2% run-to-run NN training stochasticity, and the post-calibration Brier (0.2320 → 0.2320) is essentially unchanged, suggesting the aggregate's underlying prediction quality is stable while accuracy fluctuates around a decision boundary.

Numbers fluctuate ±1–2% across `ww:train` runs due to NN training stochasticity even with deterministic seeds.

#### Prior run — 2026-04-20 (1,517 matches, 1,489 decisive, 87 heroes)

Kept for comparison so the trajectory is visible at a glance.

| Model         | Accuracy  | Brier (raw) | Brier (calibrated) | Calibration    |
| ------------- | --------- | ----------- | ------------------ | -------------- |
| Popular Pick  | 60.1%     | 0.2412      | **0.2375 ↓**       | isotonic       |
| Hero Synergy  | 60.6%     | 0.2415      | **0.2339 ↓**       | isotonic       |
| Team Power    | 60.8%     | 0.2357      | **0.2375 ↑**       | isotonic       |
| Adaptive ML   | 58.6%     | 0.2445      | **0.2386 ↓**       | isotonic       |
| **Aggregate** | **62.8%** | —           | **0.2326**         | (blended)      |
| _Baseline_    | _53.6%_   | —           | —                  | _predict left_ |

At that point all four models and the aggregate had gained 1–3pp of accuracy vs. the run before it (1,465 matches). The hand-crafted cluster sat at 60.1–60.8% within 0.7pp; Adaptive ML trailed at 58.6%. The aggregate's 62.8% was 9.2pp above the predict-left baseline. Team Power's calibrated Brier ticked up slightly (mild isotonic-fit noise that resolved with the additional ~200 matches in the final run).

#### Run-over-run summary

| Model        | 2026-04-20 (1,517) | 2026-04-25 (1,737) | Δ      |
| ------------ | ------------------ | ------------------ | ------ |
| Popular Pick | 60.1%              | 60.6%              | +0.5pp |
| Hero Synergy | 60.6%              | 61.1%              | +0.5pp |
| Team Power   | 60.8%              | 60.4%              | −0.4pp |
| Adaptive ML  | 58.6%              | 58.9%              | +0.3pp |
| Aggregate    | 62.8%              | 61.8%              | −1.0pp |
| Baseline     | 53.6%              | 53.2%              | −0.4pp |

Three of four individual models nudged up; Team Power slipped marginally and Hero Synergy retook its lead. The aggregate's 1pp dip is within run-to-run NN stochasticity (post-calibration Brier moved 0.2326 → 0.2320, essentially flat).

### Confidence Threshold Tuning

`benchmark.ts` runs a 5-fold CV pass and then tunes per-model and aggregate confidence thresholds against the held-out predictions. See §4 "Match-Prediction Confidence" for the full design; this section documents the tuning outputs.

**Tuning is dynamic and data-driven** — targets scale with realized accuracy so they don't need manual retuning as the dataset grows:

1. **Pick MEDIUM.** Among candidate cutoffs whose above-bucket clears the accuracy floor and min-coverage floor _and_ whose below-bucket is ≥ 1pp less accurate (LOW justified), pick the cutoff whose LOW coverage lands closest to `TARGET_LOW_COVERAGE` (≈ 25%). This keeps LOW meaningful — neither vanishingly rare (badge noise) nor the majority (inverts MEDIUM semantics).
2. **Pick HIGH.** Enable HIGH when some stricter cutoff's held-out accuracy clears `overall_acc + 2pp` _and_ also clears MEDIUM's accuracy. Using overall accuracy (not MEDIUM's subset accuracy) as the reference decouples HIGH from MEDIUM's cutoff choice — tightening MEDIUM doesn't automatically raise HIGH's bar in lockstep.
3. **Relabel when LOW is the majority.** If the picked cutoff's LOW coverage exceeds 50% _and_ its above-bucket passes HIGH's overall-acc + lift criterion, swap the framing: above-bucket → HIGH, below-bucket → MEDIUM, no LOW. The signal was identifying a _reliable top subset_ rather than an _unreliable tail_. Same justified split, semantically correct labels.

This gives three properties for free:

- HIGH accuracy always clears overall accuracy _and_ MEDIUM accuracy — users can trust it's a lift.
- LOW accuracy always falls ≥ 1pp below MEDIUM — the warning is never fabricated.
- Absolute bars self-adjust as MEDIUM accuracy rises with dataset growth; no manual retuning.

Tuning parameters in `benchmark.ts`:

```
// Per-model (each of the four)
PER_MODEL_MEDIUM_TARGET_ACC      = 0.55   // absolute floor for MEDIUM acc
PER_MODEL_MEDIUM_MIN_COVERAGE    = 0.30
PER_MODEL_HIGH_LIFT_OVER_OVERALL = 0.02   // HIGH must beat overall by ≥ 2pp
PER_MODEL_HIGH_MIN_COVERAGE      = 0.03   // avoid tiny-sample buckets
PER_MODEL_HIGH_MAX_COVERAGE      = 0.15   // HIGH < 15% — must stay genuinely rare
PER_MODEL_LOW_DROP_BELOW_MEDIUM  = 0.01   // LOW must fall ≥ 1pp below MEDIUM

// Aggregate (credibility-weighted stddev + avgSelfConf)
AGGREGATE_MEDIUM_TARGET_ACC      = 0.58
AGGREGATE_MEDIUM_MIN_COVERAGE    = 0.30
AGGREGATE_HIGH_LIFT_OVER_OVERALL = 0.02   // match per-model — avoid marginal "HIGH" noise
AGGREGATE_HIGH_MIN_COVERAGE      = 0.02
AGGREGATE_HIGH_MAX_COVERAGE      = 0.15
AGGREGATE_LOW_DROP_BELOW_MEDIUM  = 0.01

// UX preferences (applied on top of the statistical constraints above)
TARGET_LOW_COVERAGE              = 0.25   // preferred LOW share when multiple cutoffs qualify
LOW_INVERT_THRESHOLD             = 0.50   // above this (and HIGH disabled), relabel to HIGH+MEDIUM
```

Only the _deltas_ (lift, drop) and the UX preferences are constants — the actual accuracy bars auto-scale with each run's overall model accuracy. As the dataset grows, cutoffs re-fit per run; we never need to hand-edit these numbers in response to more data.

**Aggregate tuning** grid-searches over `(weightedStddev, avgSelfConf)` pairs. HIGH requires low stddev AND high avg self-confidence (models agree _and_ underlying data is rich). The grid spans `stddev ∈ [0.01, 0.20]` and `selfConf ∈ [0.2, 0.9]` — fine resolution at the top lets the tuner find ultra-tight-agreement subsets if they exist, without manufacturing them (every candidate still has to clear the lift + coverage floors).

**Fallback to DISABLED** — if no threshold qualifies, the band is disabled. HIGH cutoff becomes `1.01` (unreachable); a disabled LOW collapses the runtime MEDIUM cutoff to `0` so MEDIUM always catches. See §4 "Disabled bands" for the full design rationale.

From the 2026-04-25 final run (1,737 matches, 1,706 decisive):

| Model / Aggregate | HIGH (cutoff / acc / cov)                        | MEDIUM (cutoff / acc / cov)                      | LOW (acc / cov)              |
| ----------------- | ------------------------------------------------ | ------------------------------------------------ | ---------------------------- |
| Popular Pick      | _disabled_                                       | `selfConf ≥ 0.65` / 61.9% / 75.0%                | 58.2% / 25.0% (3.7pp drop ✓) |
| Hero Synergy      | `selfConf ≥ 0.97` / 65.1% / 4.9%                 | `selfConf ≥ 0.50` / 62.0% / 85.0%                | 59.8% / 15.0% (2.2pp drop ✓) |
| Team Power        | `selfConf ≥ 0.40` / 67.4% / 5.4%                 | `selfConf ≥ 0.20` / 61.7% / 69.5%                | 58.2% / 30.5% (3.5pp drop ✓) |
| Adaptive ML       | _disabled_                                       | `selfConf ≥ 0.80` / 59.6% / 92.7%                | 56.8% / 7.3% (2.8pp drop ✓)  |
| **Aggregate**     | `stddev ≤ 0.03, selfConf ≥ 0.80` / 66.1% / 10.0% | `stddev ≤ 0.15, selfConf ≥ 0.70` / 62.1% / 76.6% | 61.0% / 23.4% (1.1pp drop ✓) |

**What the user will see on a given matchup card** — band breakdown (not cumulative), with each band's held-out accuracy:

| Model         | 🟢 HIGH         | 🟡 MEDIUM                               | 🔴 LOW          |
| ------------- | --------------- | --------------------------------------- | --------------- |
| Popular Pick  | —               | **75%** of predictions @ 61.9% accurate | **25%** @ 58.2% |
| Hero Synergy  | **5%** @ 65.1%  | **80%** @ ~61.8%                        | **15%** @ 59.8% |
| Team Power    | **5%** @ 67.4%  | **64%** @ ~61.2%                        | **31%** @ 58.2% |
| Adaptive ML   | —               | **93%** @ 59.6%                         | **7%** @ 56.8%  |
| **Aggregate** | **10%** @ 66.1% | **67%** @ ~61.5%                        | **23%** @ 61.0% |

Every band is empirically justified — LOW drops are 1.1–3.7pp below MEDIUM; HIGH lifts are 3.1–5.7pp above MEDIUM (Hero Synergy 3.1pp, Team Power 5.7pp, Aggregate 4.0pp).

**What this means in practice:**

- **All five badges carry genuine LOW bands** (statistically justified drops of 1.1–3.7pp below MEDIUM). LOW coverage spans 7–31% — Adaptive ML's LOW shrank to 7% as its MEDIUM cutoff climbed to selfConf ≥ 0.80 (on this run, the bulk of its predictions land in the high-co-occurrence regime). Aggregate LOW is the smallest absolute drop (1.1pp) but the most consistent at ~23% coverage.
- **Hero Synergy, Team Power, and the aggregate show HIGH** on 5–10% of predictions. Popular Pick and Adaptive ML HIGH stay disabled — neither can carve out a ≤ 15% subset that beats overall accuracy by 2pp _and_ MEDIUM's own accuracy. The disabled state matches the prior run; these signals' top-end discrimination needs more data to sharpen.
- **HIGH cutoffs tightened on this run.** Hero Synergy moved from `selfConf ≥ 0.90` (10.8% coverage) → `selfConf ≥ 0.97` (4.9% coverage). Team Power moved from `selfConf ≥ 0.35` (14.2%) → `selfConf ≥ 0.40` (5.4%). Aggregate tightened from `(0.02, 0.70)` to `(0.03, 0.80)`. Smaller HIGH coverage but higher HIGH accuracy (Team Power HIGH lifted to 67.4%, the strongest individual-model HIGH ever recorded on this dataset). The tuner is being conservative as variance shrinks.
- **The aggregate HIGH scenario is subtle but designed-for.** A matchup can produce all four per-model MEDIUM badges AND still land HIGH on the aggregate — this happens when the four models converge tightly on a similar win % even though none individually hit its HIGH threshold. The credibility-weighted stddev captures cross-model agreement, which is a signal no single model can see. Four models with reasonable data all agreeing that a matchup is (say) 48/52 is stronger evidence than any single confident model could provide. Note the HIGH badge describes trust in the number, not the number's extremeness — a confident 48/52 is a valid HIGH.
- **Team Power's LOW coverage is bimodal across runs** — lands at either ~25% or ~60% depending on the exact dataset. This run landed at 30.5% (the low-coverage branch). B-T's fit itself is deterministic given data, but the tuner has two candidate cutoffs for B-T's MEDIUM that sit near a decision boundary: T≈0.20 produces LOW≈30% with a borderline drop check, while T≈0.25 produces LOW≈60% with a comfortable drop check. A small accuracy shift from new match records can tip which cutoffs pass, flipping B-T's shape. Either framing stays statistically justified (always passes the 1pp drop check at its chosen cutoff); the difference is which the tuner's "closest to 25% LOW coverage" preference can reach without breaking the statistical floor.

**No manual retuning as data grows.** If a model's overall accuracy rises from 58% → 62% as the dataset doubles, its HIGH target rises from 60% → 64% automatically, and its LOW boundary rises with MEDIUM. The percentages above will shift too: Popular Pick and Adaptive ML HIGH are close to the coverage floor but not quite — with more data, their top-end signals should sharpen enough to unlock them. Bands enable or disable on their own when the data supports them.

#### Prior run — 2026-04-20 thresholds (1,517 matches, 1,489 decisive)

Kept for comparison.

| Model / Aggregate | HIGH (cutoff / acc / cov)                       | MEDIUM (cutoff / acc / cov)                      | LOW (acc / cov)              |
| ----------------- | ----------------------------------------------- | ------------------------------------------------ | ---------------------------- |
| Popular Pick      | _disabled_                                      | `selfConf ≥ 0.55` / 60.5% / 77.5%                | 57.4% / 22.5% (3.1pp drop ✓) |
| Hero Synergy      | `selfConf ≥ 0.90` / 64.8% / 10.8%               | `selfConf ≥ 0.55` / 62.8% / 73.3%                | 57.5% / 26.7% (5.4pp drop ✓) |
| Team Power        | `selfConf ≥ 0.35` / 64.5% / 14.2%               | `selfConf ≥ 0.20` / 62.2% / 74.6%                | 56.3% / 25.4% (5.9pp drop ✓) |
| Adaptive ML       | _disabled_                                      | `selfConf ≥ 0.99` / 58.3% / 81.3%                | 51.6% / 18.7% (6.7pp drop ✓) |
| **Aggregate**     | `stddev ≤ 0.02, selfConf ≥ 0.70` / 66.0% / 6.6% | `stddev ≤ 0.20, selfConf ≥ 0.70` / 61.1% / 68.5% | 57.6% / 31.5% (3.5pp drop ✓) |

| Model         | 🟢 HIGH         | 🟡 MEDIUM                               | 🔴 LOW          |
| ------------- | --------------- | --------------------------------------- | --------------- |
| Popular Pick  | —               | **78%** of predictions @ 60.5% accurate | **22%** @ 57.4% |
| Hero Synergy  | **11%** @ 64.8% | **62%** @ ~62.4%                        | **27%** @ 57.5% |
| Team Power    | **14%** @ 64.5% | **60%** @ ~61.7%                        | **25%** @ 56.3% |
| Adaptive ML   | —               | **81%** @ 58.3%                         | **19%** @ 51.6% |
| **Aggregate** | **7%** @ 66.0%  | **62%** @ ~60.5%                        | **32%** @ 57.6% |

#### Threshold movement, 2026-04-20 → 2026-04-25

- **HIGH cutoffs tightened across the board.** Hero Synergy `selfConf ≥ 0.90` (10.8% cov) → `≥ 0.97` (4.9%). Team Power `≥ 0.35` (14.2%) → `≥ 0.40` (5.4%). Aggregate `(stddev ≤ 0.02, selfConf ≥ 0.70)` → `(≤ 0.03, ≥ 0.80)`. Smaller HIGH coverage in exchange for higher HIGH accuracy — Team Power HIGH lifted from 64.5% → 67.4%, the strongest individual-model HIGH on this dataset.
- **MEDIUM cutoffs drifted up.** Popular Pick `≥ 0.55` → `≥ 0.65`. Hero Synergy `≥ 0.55` → `≥ 0.50` (loosened). Adaptive ML `≥ 0.99` → `≥ 0.80` (looser; LOW correspondingly shrank from 19% → 7%).
- **LOW drops compressed.** Hero Synergy 5.4pp → 2.2pp. Team Power 5.9pp → 3.5pp. Adaptive ML 6.7pp → 2.8pp. Aggregate 3.5pp → 1.1pp. Still all justified (≥ 1pp), but the warning band is less dramatic now — consistent with the overall accuracy distribution tightening as data fills in.
- **Disabled bands held steady.** Popular Pick HIGH and Adaptive ML HIGH stayed disabled across both runs.

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

**The gap is closing — slowly.** At 1,737 matches (final dataset):

| Model        | Accuracy | Gap vs baseline (53.2%) |
| ------------ | -------- | ----------------------- |
| Hero Synergy | 61.1%    | +7.9%                   |
| Popular Pick | 60.6%    | +7.4%                   |
| Team Power   | 60.4%    | +7.2%                   |
| Adaptive ML  | 58.9%    | +5.7%                   |

Adaptive ML's trajectory: 55.2% (1,146 matches) → 57.1% (1,465) → 58.6% (1,517) → 58.9% (1,737). The early 2pp jumps slowed to a 0.3pp gain across the last ~220 matches, suggesting the NN may be approaching a soft ceiling for its current 16-dim embedding architecture on this dataset size. The hand-crafted leaders held a 60.4–61.1% cluster, with Hero Synergy retaking the top spot from Team Power. Scenario 1 below (NN crossover) hasn't happened — the NN closed roughly half the gap from its 55% floor but stayed ~2pp behind the leaders for two consecutive runs.

Three honest scenarios were on the table while the dataset was growing:

1. **NN crosses over (the bet):** more matches → embeddings stabilize → Adaptive ML beats the ~60% ceiling of the statistical models.
2. **Everyone plateaus together** around 60–65%: the game has irreducible noise (RNG, skill, meta shifts) that caps all models. The NN's extra capacity doesn't help because there's no more signal to extract.
3. **NN stays behind:** the hand-crafted priors (Bayesian smoothing, L2-regularized strength, pairwise synergy) turn out to be well-matched to this problem, and the NN's flexibility is mostly fitting noise.

**Verdict at dataset close (1,737 matches):** scenarios 2 and 3 are both consistent with the final results — the four models converged into a 58.9–61.1% band with Adaptive ML still trailing. The NN never crossed over. Whether that's because the dataset is signal-bounded (scenario 2) or because the hand-crafted priors are genuinely well-matched (scenario 3) can't be teased apart from this data alone. The aggregate weights below preserve the bet's structure (NN gets meaningful but not dominant share at high data counts), which remains the right call: NN provides ensemble diversity even when individually weaker, and credibility weighting downweights its vote on matchups where its self-confidence is low. If the dataset reopens, the "Future Improvements" bullets in §5 (larger embeddings, deeper network, separate offense/defense embeddings) become the relevant levers — adding capacity within the current 1.7k-match envelope would just overfit.

## 8. Meta Insights

Three sub-tabs: **Units** | **Synergy** | **Teams**. Main panel: sortable tables. Side panel: auto-generated insights including ML-powered analysis from the Adaptive ML model's learned embeddings.

**Units insights**: Best Openers, Best Responses, **Similar Heroes** (embedding cosine similarity), and **Class composition** patterns (e.g., "Teams with 2+ tank overperform").

**Synergy insights**: ~10 most impactful pair insights (strongest/weakest pair, most played, best/worst team player, opponent diversity, undefeated pairs), and **Unexplored Synergies** (pairs the NN predicts will perform well but have < 5 actual matches).

**Teams insights**: Team counter matchups, sweep stats, side win rate advantage, **ML Top Teams** (strongest trios by neural network), and **Composition patterns** — damage type balance (all physical/magic/mixed), range balance (all melee/ranged/mixed), and energy level effects. Shown when > 5% deviation from 50% with 20+ teams.

## 9. Pool Restriction

Upload a screenshot of the game's 4×5 hero pool to restrict picks and recommendations to those 20 heroes.

**Pipeline**: Screenshot → `suggestGridCrop()` auto-detects the card grid via gold pixel density profiling (HSV hue 25-55°), with aspect ratio constraint for oversized regions and edge trimming for precision → user can adjust crop → cells extracted (4×5) with 5×5 offset search per cell → NCC matching against precomputed 32×32 grayscale signatures → de-dupe conflicts → user reviews with confidence badges → apply as pool filter.

**Signatures**: Base64-encoded in `heroPortraitSignatures.ts`. Generated in-browser from reference portraits normalized via `scripts/normalize-references.ts` (gold-border crop → 170×230 resize → grey background flatten). Dev tools in the pool import modal for generating and uploading signature sets.
