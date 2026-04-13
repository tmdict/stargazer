# WandWars

> Living document for the WandWars feature. Updated as design evolves.

## 1. Background

WandWars is a 3v3 PvP game event where two players alternate picking heroes, then battle. This tool analyzes historical match data to recommend optimal hero picks.

**Draft rule**: Left picks 1st → Right picks 1st & 2nd → Left picks 2nd & 3rd → Right picks 3rd.

**Goal**: Given past match data, predict the best next hero to pick at each stage of the draft to maximize win probability. When all 6 heroes are picked, predict which team is favored and allow recording the result.

## 2. Data Format

Source: `src/wandwars/data/wandwars.data` (gitignored, growing dataset)

```
leftHero1,leftHero2,leftHero3 <symbol> rightHero1,rightHero2,rightHero3;optional note
```

- `>` left wins, `<` right wins, `>>` / `<<` dominant win (weight 1.5), `=` draw
- Hero names are kebab-case, matching `src/data/character/*.json`
- Notes use `{heroName}` to reference specific heroes — displayed with hero names highlighted in teal bold
- Data file is gitignored; inlined into JS bundle at build time via Vite `?raw` import

Examples:

```
natsu,silvina,faramor > tilaya,harak,kordan;{faramor} true damage counters {tilaya}
tasi,dunlingr,daimon << kordan,zandrok,gerda
```

## 3. Architecture

### File Structure

```
src/
  wandwars/
    data/
      wandwars.data           # Match data (gitignored)
      .gitignore              # Ignores all files except itself
    types.ts                  # Domain types (MatchResult, Recommendation, etc.)
    parser.ts                 # Text file → MatchResult[]
    serializer.ts             # RecordedMatch[] → .data text for export
    analysis.ts               # Hero stats, synergy matrix, counter matrix (Bayesian prior 3.0)
    popularPick.ts            # Popular Pick model (popularity + pair records)
    composite.ts              # Composite model (synergy + counter, dynamic weights)
    bradleyTerry.ts           # Bradley-Terry model (regularized L2, team power)
    modelUtils.ts             # Shared: getRelevantNotes, getMatchupNotes, Wilson confidence
    confidence.ts             # Wilson score interval calculation
    formatting.ts             # Shared: formatPercent, formatName, formatNoteHtml, getResultSymbol
    teamSuggestions.ts        # Top teams (data-backed) + constructed team suggestions
    recommend.ts              # Unified interface, data loading, caching, all model predictions
    constants.ts              # Weights, thresholds, draft order, confidence descriptions
  views/
    WandWarsView.vue          # Standalone page, state management, localStorage records
  components/
    wandwars/
      WandWarsPicker.vue          # Left column: pick slots + hero grid + undo/reset
      WandWarsPickSlots.vue       # 6 pick circles using CharacterIcon, active-side indicator
      WandWarsHeroGrid.vue        # Hero grid with faction FilterIcons + undo/reset
      WandWarsAnalysis.vue        # Right panel: tabbed [Popular Pick][B-T][Composite][Records]
      WandWarsRecommendation.vue  # Recommendation card with breakdown, counters, team counter
      WandWarsTopTeams.vue        # Pinned top teams + suggested teams card
```

### Route

```typescript
{ path: '/wandwars', component: () => import('../views/WandWarsView.vue') }
```

No locale prefix, not SSG pre-rendered. No page title or back button — user navigates via site icon.

### Data Loading

Vite `?raw` import inlines `wandwars.data` into the JS bundle at build time. Analysis computed on first access, cached for session. Every rebuild picks up latest data.

### Component Reuse

- **`CharacterIcon`** — pick slots with level background, tooltip on hover
- **`FilterIcons`** — faction filtering in hero grid
- **`gameDataStore`** — initialized on page load for character images, icons, and data

## 4. Domain Model

```typescript
interface MatchResult {
  left: [string, string, string]
  right: [string, string, string]
  result: 'left' | 'right' | 'draw'
  weight: number // 1.0 or 1.5 (dominant)
  notes: MatchNote[]
}

interface MatchNote {
  text: string // raw text with {heroName} references
  heroes: string[] // extracted hero names from {}
}

interface HeroStats {
  name: string
  matches: number
  wins: number
  losses: number
  draws: number
  weightedWins: number
  weightedLosses: number
  winRate: number // Bayesian-smoothed (prior 3.0)
}

interface Recommendation {
  hero: string
  score: number // 0-1, model-specific
  confidence: 'high' | 'medium' | 'low'
  breakdown: Record<string, number> // model-specific components
  relevantNotes: MatchNote[] // notes where this hero appears in {}
}

interface MatchupPrediction {
  leftWinProbability: number
  rightWinProbability: number
  confidence: 'high' | 'medium' | 'low'
  breakdown: Record<string, number>
  relevantNotes: MatchNote[] // only notes where ALL {} heroes present
}

interface RecordedMatch {
  left: [string, string, string]
  right: [string, string, string]
  winner: 'left' | 'right' | 'draw'
  dominant: boolean
  notes: string
}
```

## 5. Shared Statistical Foundations

### Bayesian Prior (analysis.ts)

All win rate calculations use a **Bayesian prior of 3.0** — equivalent to adding 3 virtual wins and 3 virtual losses. This aggressively pulls heroes with few matches toward 50%:

| Actual record | Raw win rate | Bayesian-smoothed |
| ------------- | ------------ | ----------------- |
| 2W / 0L       | 100%         | 62.5%             |
| 5W / 2L       | 71.4%        | 61.5%             |
| 12W / 8L      | 60%          | 57.7%             |
| 30W / 20L     | 60%          | 58.9%             |

Prior fades naturally as data grows. At 50+ matches per hero it's negligible. Applied consistently to: hero win rates, synergy pair rates, counter matchup rates, and pair/trio records.

**Why 3.0?** Prior of 1.0 was too weak — heroes with 2W/0L scored 75%, outranking well-tested heroes. Increasing to 3.0 brings that down to 62.5%, which is much closer to properly-tested heroes' rates.

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

### Team Counter Detection

When you have 2 teammates and opponent has 2+ heroes, checks if [your 2 + candidate] has beaten any team containing those opponent heroes in match data. Shows badge only when wins > losses. Works with partial opponent teams (doesn't require all 3 known) since your 3rd pick always happens before the opponent's 3rd.

## 6. Prediction Models

All models implement `RecommendationModel` with `recommend()` and `predictMatchup()`. They run independently in separate tabs. Pick order does not affect predictions — all models evaluate teams as unordered sets.

Tab order: **Popular Pick** | **Total Team Power (B-T Model)** | **Hero Synergy (Composite Model)** | **Records**

### Model A: Popular Pick (`popularPick.ts`)

**Philosophy**: Observable co-occurrence — "who's popular and tends to win alongside your team?"

#### Scoring — Dynamic Weights by Draft Stage

| Draft stage            | Win Rate | Pick Rate | Pair Records |
| ---------------------- | -------- | --------- | ------------ |
| 1st pick (0 teammates) | 60%      | 40%       | —            |
| 2nd pick (1 teammate)  | 35%      | 20%       | 45%          |
| 3rd pick (2 teammates) | 25%      | 15%       | 60%          |

**Win Rate**: Contextual win rate filtered to matches where candidate appeared alongside current teammates/opponents. Blends with overall when <3 contextual matches. Shows both when they differ: "62.5% (55.0% overall)".

**Pick Rate**: Hero appearances relative to most-picked hero. Normalized 0-1. Meta popularity signal.

**Pair Records**: Actual W/L with each teammate. For 2 teammates, blends individual pairs (60%) + trio record (40%) if available. Displayed as `w/ [Name]: XW / YL` with green/red coloring.

#### Breakdown

- Win Rate % (with overall if different)
- Pick Rate %
- Per-teammate pair W/L record

---

### Model B: Bradley-Terry — "Total Team Power" (`bradleyTerry.ts`)

**Philosophy**: Statistically principled strength estimation — "what is each hero's true power level?"

Each hero has latent strength `λ`. Team win probability = `Σλ(team) / (Σλ(team) + Σλ(opponent))`.

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

#### Breakdown

- Strength: λ parameter (relative to average 1.0)
- Win Prob: predicted team win probability
- Pick Rate: informational only, not used in score

---

### Model C: Composite — "Hero Synergy" (`composite.ts`)

**Philosophy**: Analytical interaction modeling — "how much better/worse do heroes perform together than expected?"

#### Factors

**Win Rate (0.5)**: Bayesian-smoothed individual win rate.

**Synergy (0.3)**: `bayesianPairWinRate - (winRate(A) + winRate(B)) / 2` for each teammate pair. Positive = synergize, negative = clash.

**Counter (0.2)**: `bayesianVsWinRate - overallWinRate` for each opponent. Match weights (1.5 for dominant) applied consistently.

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
- Pick Rate % (informational, not in score — deliberately excluded to keep Composite focused on team interactions and distinct from Popular Pick)

---

### Model Comparison

| Aspect           | Popular Pick                       | Total Team Power (B-T)                             | Hero Synergy (Composite)                        |
| ---------------- | ---------------------------------- | -------------------------------------------------- | ----------------------------------------------- |
| Min useful data  | ~5 matches                         | ~20 matches (regularized)                          | ~20 matches                                     |
| What it captures | Popularity + pair win records      | Individual hero strength (additive)                | Synergy + counter interactions                  |
| Small data       | Pick rate weight                   | L2 regularization toward λ=1.0                     | Dynamic weights + Bayesian prior + sample bonus |
| Team awareness   | Pair records (observational)       | Sum of strengths (no interactions)                 | Pairwise synergy + counter (analytical)         |
| Strengths        | Works immediately; intuitive       | Statistically principled; calibrated probabilities | Explains _why_; captures team chemistry         |
| Weaknesses       | No explicit interaction modeling   | No synergy/counter                                 | Heuristic weights; needs pair data              |
| Best for         | Default; "who's popular and wins?" | Objective strength ranking                         | Team composition; draft counter-picks           |

**Why no pick rate in Composite?** Adding pick rate made Composite overlap with Popular Pick without adding analytical value. The stronger Bayesian prior (3.0) + sample bonus + dynamic weight redistribution handles small-sample heroes without a popularity signal. Each model is now genuinely distinct.

### How Models Update With New Data

All models recompute from scratch on every page load. Workflow: add matches to `wandwars.data` → rebuild → everything recalculated.

| Matches | Popular Pick                                  | Bradley-Terry                    | Composite                                    |
| ------- | --------------------------------------------- | -------------------------------- | -------------------------------------------- |
| 5-20    | Already useful; win rates + pick rates        | Regularization dominates         | Win Rate dominates; sparse pair data         |
| 20-50   | Pair records appearing; team suggestions work | Regularization fading            | Synergy/counter starting to appear           |
| 50-100  | Rich pair data; strong team suggestions       | Reliable for frequent heroes     | Popular pairs show synergy                   |
| 100-200 | Very reliable pair records                    | Stable for most heroes           | Medium+ confidence; synergy fills in         |
| 200-500 | Complementary to B-T/Composite                | Stable; calibrated probabilities | Rich synergy/counter; mostly high confidence |
| 500+    | Quick reference + pair lookup                 | Could extend to pairwise terms   | Diminishing returns per match                |

### Future: Neural Network (1000+ matches)

Reserved as fourth model tab. 60-dim one-hot → Dense(64) → Dense(32) → Sigmoid. Train offline, run via ONNX Runtime Web. Not implemented.

## 7. Top Teams & Suggestions (`teamSuggestions.ts`)

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

## 8. Counter Indicators & Team Counter

### Per-Hero Counter Indicators

Shown on all model tabs when opponents known. Uses Composite's counter matrix:

- **Shield (green) + "Strong against [Name]"** — counterScore > 0.1
- **Warning (red) + "Weak against [Name]"** — counterScore < -0.1
- Per-hero, not per-pair. Informational only.

### Team Counter Badge

When you have 2 teammates and opponent has 2+ heroes:

- **Star (yellow) + "Potential team counter XW / YL"**
- Checks if [your 2 + candidate] has beaten any team containing the known opponents
- Works with partial opponent teams (2 of 3 known) since your 3rd pick always precedes opponent's 3rd in draft order
- Only shows when wins > losses

### Why "Strong/Weak against" not "Counters/Countered by"

The softer language avoids absolute claims with limited data. A hero ranked #1 by Popular Pick showing "Weak against Faramor" is not contradictory — it means "popular and strong, but has a matchup disadvantage against that specific opponent." Different axes, both useful.

## 9. Page Layout

Single-page. Left: hero picker. Right: tabbed analysis panel. Full-width responsive (max 1600px, stacks at 768px).

### Left Column

- **Pick slots**: 6 `CharacterIcon` circles (70px), dashed border when empty (teal/red by team). Click to remove. Portrait images offset (`center 20%` / `margin-top: 6px`) to center on face.
- **Active side**: Full opacity + "▶ Picking" label during draft. Both full opacity when all 6 picked.
- **Hero grid**: 70px circular portraits with level backgrounds. Sorted S→A→Rare, then faction, then name. Picked heroes dimmed.
- **Controls row**: Faction `FilterIcons` + Undo/Reset buttons, padded to align with grid.

### Right Column — Tabs

**Popular Pick** (default) | **Total Team Power (B-T Model)** | **Hero Synergy (Composite Model)** | **Records** (with count badge)

#### During Draft

1. **Top Teams card** (1+ hero picked): data trios with W/L + constructed trios with dashed border
2. **Side indicator**: "Recommending for [Left/Right] side" (teal/red)
3. **Recommendation cards**: portrait, name, [confidence badge] [Score: X%], model breakdown, counter indicators (strong/weak/team counter), relevant notes (hero names in teal bold)

#### All 6 Picked

1. **All model predictions**: Active tab's model full (confidence, win probability bar, verdict, notes). Others compact below.
2. **Save Result form**: 5 result buttons (Left Win Sweep / Left Win / Draw / Right Win / Right Win Sweep), notes textarea, "Save Result" + "Reset Teams" buttons.

#### Records Tab

View-only list. Each record: match line + notes below. Three actions: **Copy Data** (clipboard, "Copied!" feedback) | **Export .data** (file) | **Clear All**.

## 10. Record Storage

`localStorage` key: `stargazer.wandwars.records`

- Records are **immutable snapshots** — teams captured at submit time, not affected by subsequent picker changes
- Persists across page reloads and tab switches
- "Save Result" appends + saves to localStorage
- "Clear All" removes localStorage key
- "Copy Data" copies all in `.data` format for pasting into master data file
- "Export .data" downloads as file

## 11. Design Decisions

| Decision                  | Choice                                                                      | Rationale                                                            |
| ------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Page style                | Standalone, full-width (max 1600px), responsive                             | Two-column layout; stacks at 768px                                   |
| Page structure            | Single page; four tabs                                                      | No mode switching needed                                             |
| Tab order                 | Popular Pick → B-T → Composite → Records                                    | Simplest/most useful first                                           |
| Draft order               | L1→R1→R2→L2→L3→R3; auto-detected side                                       | No manual toggle                                                     |
| Pick order irrelevance    | Models evaluate unordered team sets                                         | Order affects strategy, not strength                                 |
| Hero exclusion            | Picked heroes excluded from recs + team suggestions                         | Can't pick same hero twice                                           |
| Bayesian prior            | 3.0 across all win rates                                                    | Aggressively pulls low-sample toward 50%; fades with growth          |
| B-T regularization        | L2 via virtual observations, weight = 3.0/(1+matchCount)                    | Proper Bayesian; no pick rate hack                                   |
| Composite: no pick rate   | Win Rate (0.5) + Synergy (0.3) + Counter (0.2)                              | Focused on interactions; distinct from Popular Pick                  |
| Dynamic weights           | Synergy/counter scale by data availability; unused → Win Rate               | Prevents unreliable sparse data from dominating                      |
| Score normalization       | Synergy/counter clamped [-0.5, +0.5] → shifted to [0, 1]                    | All components on same scale                                         |
| Sample size bonus         | Up to +5% for 20+ appearances (Composite only)                              | Tie-breaker for well-tested heroes                                   |
| Popular Pick pair records | Dynamic: 0→45→60% pair weight as teammates increase                         | Progressively team-aware                                             |
| Top Teams filtering       | Exclude picked heroes; require wins > losses                                | Only actionable, winning teams                                       |
| Constructed teams         | Built from pair records; dashed border, no W/L                              | Surfaces combos missed by limited data                               |
| Team hero ordering        | Picked first (pick order), then remaining alphabetically                    | Intuitive "your picks + suggestion"                                  |
| Counter indicators        | Green shield "Strong against" / Red warning "Weak against" (threshold ±0.1) | Informational; from Composite counter matrix; all tabs               |
| Team counter              | Yellow star "Potential team counter" with W/L; 2+ known opponents           | Partial opponent match (draft order means opponent 3rd unknown)      |
| Label: "Popular Pick"     | Renamed from "Meta Pick"                                                    | Clearer expectation; "popular" doesn't conflict with weakness badges |
| Wilson confidence         | 95% CI width thresholds                                                     | Statistically grounded                                               |
| All-model matchup         | Active tab full, others compact                                             | Compare at a glance                                                  |
| Notes display             | Hero in `{}` required; ALL `{}` heroes for matchup; teal bold highlight     | Relevant, not noisy                                                  |
| Draw handling (B-T)       | 0.5 wins each side                                                          | Preserves information                                                |
| Counter weighting         | Match weights (1.5) in counter matrix                                       | Consistent with hero stats                                           |
| Record immutability       | Snapshot on submit; picker stays                                            | Faithful capture; no accidental edits                                |
| Record storage            | `localStorage` + copy/export                                                | Persists; portable                                                   |
| Portrait alignment        | `object-position: center 20%` / `margin-top: 6px`                           | Centers on face instead of top of head                               |
| Hero grid sorting         | S-tier → A-tier → Rare, then faction, then name                             | Strong heroes surface first                                          |
