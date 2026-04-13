# WandWars

> Living document for the WandWars feature. Updated as design evolves.

## 1. Background

WandWars is a 3v3 PvP game event where two players alternate picking heroes, then battle. This tool analyzes historical match data to recommend optimal hero picks.

**Draft rule**: Left picks 1st → Right picks 1st & 2nd → Left picks 2nd & 3rd → Right picks 3rd.

**Goal**: Given past match data, predict the best next hero to pick at each stage of the draft to maximize win probability. When all 6 heroes are picked, predict which team is favored.

## 2. Data Format

Source: `src/wandwars/wandwars.data` (~77 matches, growing)

```
leftHero1,leftHero2,leftHero3 <symbol> rightHero1,rightHero2,rightHero3;optional note
```

- `>` left wins, `<` right wins, `>>` / `<<` dominant win, `=` draw
- Hero names are kebab-case, matching `src/data/character/*.json`
- Notes use `{heroName}` to reference specific heroes
- Dominant wins (`>>` / `<<`) get weight 1.5, normal wins get 1.0

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
      wandwars.data       # Match data (gitignored)
    types.ts              # Domain types
    parser.ts             # Text file → MatchResult[]
    serializer.ts         # RecordedMatch[] → .data text (for export)
    analysis.ts           # Hero stats, synergy matrix, counter matrix
    metaPick.ts           # Meta Pick model (win rate + pick rate + pair records)
    composite.ts          # Composite scoring model (synergy + counter)
    bradleyTerry.ts       # Bradley-Terry model (team power)
    modelUtils.ts         # Shared model utilities (notes, confidence)
    confidence.ts         # Wilson score interval for confidence levels
    formatting.ts         # Shared formatting (percent, names, notes HTML)
    teamSuggestions.ts    # Top teams and constructed team suggestions
    recommend.ts          # Unified interface, data loading, caching
    constants.ts          # Weights, thresholds, draft order
  views/
    WandWarsView.vue      # Standalone page (no PageContainer)
  components/
    wandwars/
      WandWarsPicker.vue          # Left column: slots + hero grid + undo/reset
      WandWarsPickSlots.vue       # 6 pick circles using CharacterIcon
      WandWarsHeroGrid.vue        # Hero grid with faction FilterIcons + undo/reset
      WandWarsAnalysis.vue        # Right panel: tabbed [Meta Pick][Synergy][Power][Records]
      WandWarsRecommendation.vue  # Single recommendation card
      WandWarsTopTeams.vue        # Pinned top teams + suggested teams card
```

### Route

```typescript
{ path: '/wandwars', component: () => import('../views/WandWarsView.vue') }
```

No locale prefix, not SSG pre-rendered. Temporary/personal tool. No back button — user navigates via site icon.

### Data Loading

Vite's `?raw` import loads `wandwars.data` as a string at build time — the file content is inlined into the JS bundle, not served as a separate URL. Analysis is computed on first access and cached. Every rebuild picks up the latest data automatically.

```typescript
import rawData from './wandwars.data?raw'

const matches = parseMatchData(rawData)
```

### Component Reuse

The WandWars feature reuses several existing components:

- **`CharacterIcon`** — used in pick slots for filled hero circles (with level background, tooltip on hover)
- **`FilterIcons`** — used for faction filtering in the hero grid (icon-based filter buttons)
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
  winRate: number // Bayesian-smoothed
}

interface Recommendation {
  hero: string
  score: number // 0-1 normalized composite score
  confidence: 'high' | 'medium' | 'low'
  breakdown: Record<string, number> // model-specific components
  relevantNotes: MatchNote[] // notes where this hero appears in {}
}

interface MatchupPrediction {
  leftWinProbability: number
  rightWinProbability: number
  confidence: 'high' | 'medium' | 'low'
  breakdown: Record<string, number>
  relevantNotes: MatchNote[] // only notes where ALL referenced heroes are present
}

interface RecordedMatch {
  left: [string, string, string]
  right: [string, string, string]
  winner: 'left' | 'right' | 'draw'
  dominant: boolean
  notes: string
}
```

## 5. Prediction Models

All models implement a shared `RecommendationModel` interface with `recommend()` (during draft) and `predictMatchup()` (full teams). They run independently and the UI shows them in tabs. Pick order does not affect predictions — all models evaluate teams as unordered sets, since what matters is the final team composition, not the order heroes were drafted.

### Model A: Meta Pick — "Meta Pick"

A lightweight model designed to be useful from day one. Ranks heroes by individual strength, popularity, and **pair win records** that progressively adapt as teammates are picked.

**Dynamic weights based on draft stage:**

| Draft stage | Win Rate | Pick Rate | Pair Records |
|-------------|----------|-----------|--------------|
| 1st pick (0 teammates) | 60% | 40% | — |
| 2nd pick (1 teammate) | 35% | 20% | 45% |
| 3rd pick (2 teammates) | 25% | 15% | 60% |

**Factors:**

1. **Win Rate** — contextual win rate that filters to matches where the candidate appeared alongside current teammates/opponents. Blends with overall win rate when contextual data is sparse (<3 matches). When contextual rate differs from overall, both are shown: "62.5% (55.0% overall)"
2. **Pick Rate** — how often the hero appears relative to the most-picked hero (meta popularity signal)
3. **Pair Records** — actual W/L record when paired with each current teammate. For 2 teammates, blends individual pair records (60%) with trio record (40%) if available. Displayed as "w/ Hero Name: 6W / 2L" with colored W/L.

```
Score = winRateWeight × contextualWinRate + pickRateWeight × normalizedPickRate + pairWeight × pairScore
```

**Breakdown displayed**: Win Rate % (with overall if different), Pick Rate %, pair W/L per teammate

**When to use**: Default tab. Best for early data or when you want "who's generally strong and tends to win alongside my current team?" Uses observable co-occurrence rather than modeled interactions.

**Key difference from Composite**: Meta Pick asks "what actually happens when these heroes appear together?" (observational). Composite asks "how much better/worse do they perform together than expected?" (analytical).

**Matchup prediction**: Sums contextual win rate weighted by pair records for each team.

### Model B: Composite Scoring — "Hero Synergy"

Lightweight heuristic model. Works from day one with small data. The recommendation card shows a combined **Score** (sorted descending) with a breakdown of three factors:

#### Win Rate (displayed as "Win Rate")

The hero's individual Bayesian-smoothed win rate across all matches:

```
winRate = (weightedWins + 1) / (weightedWins + weightedLosses + 2)
```

The `+1` / `+2` is a Bayesian prior (Beta(1,1)) that pulls heroes with few matches toward 50%:

- 1 match, 1 win → 66.7% (not 100%)
- 1 match, 0 wins → 33.3% (not 0%)
- 50 matches, 30 wins → 59.6% (barely affected, close to raw 60%)

Dominant wins (`>>` / `<<`) count as 1.5 in the weighted totals.

#### Synergy (displayed as "Synergy")

How much better or worse two heroes perform _when on the same team_ vs their individual rates:

```
synergyScore(A, B) = bayesianSmoothedPairWinRate - (winRate(A) + winRate(B)) / 2
```

The pair win rate is also Bayesian-smoothed to prevent extreme values with few co-appearances. Positive = they synergize (win more together than expected). Negative = they clash.

When evaluating a candidate, synergy scores with all current teammates are summed. Becomes meaningful once a hero pair has appeared together 3-5+ times.

#### Counter (displayed as "Counter")

How much better or worse a hero performs _when facing a specific opponent_ vs their overall rate:

```
counterScore(A vs B) = bayesianSmoothedVsWinRate - A's overall winRate
```

Both the per-matchup win rate and the hero's overall rate use Bayesian smoothing. Match weights (1.5 for dominant wins) are applied consistently — the counter matrix now uses the same weighting as hero stats. Positive = A counters B. Negative = A is countered by B.

When opponents are known, counter scores against all known opponents are summed.

#### Combined Score (Dynamic Weights)

The ideal weights are 0.5 (Win Rate) / 0.3 (Synergy) / 0.2 (Counter), but these are **dynamically adjusted** based on how much data supports each component:

```
dataStrength(matchCount) = min(1, matchCount / 10)  // 0-1 ramp

effectiveSynergyWeight = 0.3 × avgPairDataStrength
effectiveCounterWeight = 0.2 × avgMatchupDataStrength
effectiveBaseWeight    = 0.5 + (unused synergy + counter weight)

Score = effectiveBaseWeight × Win Rate
      + effectiveSynergyWeight × normalize(Synergy)
      + effectiveCounterWeight × normalize(Counter)
```

**Why dynamic weights?** With sparse pair data (common early on), synergy/counter values are unreliable. Rather than giving them their full weight, the system scales them down proportional to data availability and redistributes the unused weight to Win Rate (which has the most data). As pair data grows to 10+ matches, the full 0.3/0.2 weights apply.

**Score normalization**: Raw synergy/counter values are clamped to [-0.5, +0.5] and shifted to [0, 1] so all components are on the same scale:

```
normalize(value) = clamp(value, -0.5, 0.5) + 0.5
```

**Sample size bonus**: A small additive bonus (up to +5%) for heroes with more match appearances, ramping linearly from 0 at 0 matches to the max at 20+ matches. Acts as a tie-breaker favoring well-represented heroes whose stats are more reliable.

#### Confidence (Wilson Score)

Uses the **Wilson score interval** for binomial proportions rather than raw match counts. This provides statistically grounded confidence based on both sample size and win rate variance:

```
Wilson 95% CI width < 0.3 → High confidence
Wilson 95% CI width < 0.5 → Medium confidence
Otherwise → Low confidence
```

A hero with 10 matches at 50% has a wider interval (lower confidence) than one with 10 matches at 90%. Confidence degrades further if synergy/counter pair data is very sparse (<3 matches).

Displayed as "high confidence", "medium confidence", "low confidence" with a tooltip explaining the meaning.

#### Matchup Prediction

Sums each team's normalized composite score (Win Rate + Synergy + Counter per hero) and converts to a win probability. Confidence is the worst Wilson score across all 6 heroes.

### Model B: Bradley-Terry — "Total Team Power Model"

Statistically principled model. Each hero has a latent strength parameter `λ`. Team win probability = `Σλ(team) / (Σλ(team) + Σλ(opponent))`.

Parameters fitted via MM algorithm (guaranteed convergence, no learning rate). Dominant wins weighted 1.5 in the likelihood. **Draws are treated as 0.5 wins for each side** rather than being discarded, preserving information that would otherwise be lost.

The recommendation card shows:

- **Score**: predicted win probability with this hero on the team
- **Strength**: hero's fitted `λ` parameter (relative to average = 1.0)
- **Win Prob**: predicted team win probability

When opponents are not yet known, the model compares against **average team strength computed from the fitted parameters** rather than a hardcoded value.

Note: Bradley-Terry evaluates teams by summing individual hero strengths — it does _not_ model pairwise synergy or counter matchups. That's the key difference from the Composite model.

**Confidence**: Uses Wilson score intervals (same as Composite) based on each hero's match data.

**Graceful degradation:**

- <100 matches: runs but shows warning banner ("estimates may be unreliable")
- 200-500: stable individual estimates, reliable team predictions
- 500+: could extend to pairwise interaction terms (future)

**Matchup prediction**: Uses fitted `λ` parameters directly — `P(left wins) = Σλ(left) / (Σλ(left) + Σλ(right))`. Confidence is worst Wilson score across all 6 heroes.

### Model Comparison

| Aspect           | Meta Pick                               | Hero Synergy (Composite)                | Total Team Power (B-T)                             |
| ---------------- | --------------------------------------- | --------------------------------------- | -------------------------------------------------- |
| Min useful data  | ~5 matches                                              | ~20 matches                                      | ~200 matches                                       |
| What it captures | Strength + popularity + pair win records                 | Hero strength + synergy + counter                | Hero strength only (additive)                      |
| Strengths        | Works immediately; progressively team-aware via pairs    | Interpretable; models interactions analytically   | Statistically principled; calibrated probabilities |
| Weaknesses       | No explicit synergy/counter modeling                     | Heuristic weights; needs pair data               | No synergy/counter; needs more data                |
| Best for         | Default; observable "who wins together"                  | Understanding _why_; analytical team-aware picks  | Larger datasets; accurate win probability          |

All models are always available. Meta Pick is the default tab and most useful early on. As data grows, Composite and B-T become more reliable. Users can compare tabs.

### How Models Update With New Data

Both models recompute from scratch on every page load — no saved model files or incremental updates. Workflow: add matches to `wandwars.data` → rebuild → all statistics and parameters recalculated.

**Composite Scoring:**

- Every stat is a direct aggregation over all matches. Adding data immediately affects all three factors
- **Win Rate** shifts toward the hero's true strength as more matches reduce the Bayesian prior's influence
- **Synergy/counter scores** become meaningful once a hero pair has appeared together 3-5+ times
- Confidence indicators improve automatically as match counts cross 5 and 10

**Bradley-Terry:**

- The MM algorithm re-fits all `λ` parameters from the complete match history each time
- With <100 matches, `λ` values are unstable; at 200+, parameters settle and new matches cause only incremental shifts
- New heroes start at `λ = 1.0` (average) and converge based on their match outcomes
- Dominant wins have outsized impact (1.5× weight in the likelihood)

**Practical impact of data growth:**

| Matches | Meta Pick                                      | Composite                                          | Bradley-Terry                       |
| ------- | ---------------------------------------------- | -------------------------------------------------- | ----------------------------------- |
| 5-20    | Already useful; win rates + pick rates               | Win Rate dominates; almost no pair data            | Too unstable                        |
| 20-50   | Pair records start appearing; team suggestions work  | Synergy/counter starting to appear                 | Many heroes <3 appearances          |
| 50-100  | Rich pair data; strong team suggestions              | Common heroes reliable; popular pairs show synergy | Stabilizing for frequent heroes     |
| 100-200 | Pair records very reliable; good alongside Composite | Most heroes medium+ confidence; synergy fills in   | Reliable for top-picked heroes      |
| 200-500 | Complementary to Composite/B-T                       | Rich synergy/counter; confidence mostly high       | Stable; team predictions calibrated |
| 500+    | Still useful as quick reference                | Diminishing returns per match                      | Could extend to pairwise terms      |

### Future: Neural Network (1000+ matches)

Reserved as a third tab. Input: 60-dim one-hot → Dense(64) → Dense(32) → Sigmoid. Train offline, run via ONNX Runtime Web. Not implemented yet.

## 6. Page Layout

Single-page, no mode toggle. Left column is the hero picker, right column is a tabbed analysis panel. Full-width responsive layout (max 1600px, stacks vertically at 768px).

### Shared Left Column

- **Pick slots**: 6 circular slots (3 left, 3 right) using `CharacterIcon` for filled slots (level background, tooltip on hover). Empty slots show dashed circles in team color (teal/red). Click a filled slot to remove.
- **Active side indicator**: During draft, the currently-picking side shows full opacity with a "▶ Picking" label; the other side is dimmed. When all 6 are picked, both sides show full opacity with no picking label. Always follows draft order (L1 → R1 → R2 → L2 → L3 → R3).
- **Hero grid**: Circular portraits (70px) with level-colored backgrounds, matching `CharacterIcon` style. Sorted by tier (S → A → Rare), then faction, then name. Unavailable (already picked) heroes are dimmed.
- **Faction filter**: Uses `FilterIcons` component for icon-based faction filtering. Undo/Reset buttons sit on the same row.

### Right Column — Tabbed Panel

Four tabs: **Meta Pick** | **Hero Synergy (Composite Model)** | **Total Team Power (B-T Model)** | **Records**

Meta Pick is the default active tab.

The Records tab shows a badge with the current count when records exist.

#### During Draft (Model Tabs)

```
┌──────────────────────────┬───────────────────────────────┐
│                          │  [Meta][Synergy][Power]       │
│  ▶ Picking               │  [Records 3]                 │
│  ┌───┐ ┌───┐ ┌───┐      │  ───────────────────────────  │
│  │ L1│ │ L2│ │ L3│      │  Recommending for Left side   │
│  └───┘ └───┘ └───┘      │                               │
│     vs                   │  1. Hero Name  42.5%  [high] │
│  ┌───┐ ┌───┐ ┌───┐      │     SCORE                    │
│  └───┘ └───┘ └───┘      │     WinRate 52% Syn +8%      │
│     R1   R2   R3         │     Ctr +5%                  │
│                          │     "Faramor true damage..." │
│  [Faction] [Undo][Reset] │  2. Hero B    38.2%  [med]  │
│  ┌──────────────────┐    │  3. Hero C    35.1%  [low]  │
│  │ Hero icon grid   │    │  ...                          │
│  └──────────────────┘    │                               │
└──────────────────────────┴───────────────────────────────┘
```

**Top Teams card** (pinned above recommendations, visible on all model tabs when 1+ hero picked):
- **Top Teams**: Up to 3 exact trios from match data with actual W/L record (green/red colored)
- **Suggested Teams**: Up to 3 constructed trios from best pair combinations (dashed border, no W/L). Built by finding the strongest pair partners and combining them, even if the exact trio never appeared in data. Sorted by Bayesian-smoothed win rate.

**Recommendation card layout:**

- Rank number, hero portrait, hero name
- Right side: **Confidence badge** (high/medium/low) + **Score** (the combined recommendation score). This is the number the list is sorted by.
- **Breakdown** (Meta Pick): Win Rate % (with overall if different), Pick Rate %, pair W/L per teammate (green W / red L)
- **Breakdown** (Composite): Win Rate %, Synergy ±%, Counter ±%, Pick Rate %
- **Breakdown** (B-T): Strength (λ relative), Win Prob %
- **Notes** — relevant match notes where this hero is referenced in `{}`, with hero names **highlighted in teal bold**

#### All 6 Picked (Model Tabs)

Recommendations replaced by:

1. **All model predictions** — the active tab's model prediction is shown first (full size with verdict and notes), followed by compact predictions from the other models for comparison. Each shows win probability bar (teal vs red) and confidence badge. Notes only appear on the primary prediction and only when **all** heroes referenced in `{}` are present in the current teams.
2. **Save Result form** below the predictions — 5 result buttons (`Left Win (Sweep)` | `Left Win` | `Draw` | `Right Win` | `Right Win (Sweep)`), optional notes textarea, "Save Result" button, and "Reset Teams" button. Submitting snapshots the current teams as an immutable record saved to `localStorage` (`stargazer.wandwars.records`). The picker is **not** reset — teams stay for review.

**Notes display**: Notes appear on recommendation cards only when the candidate hero is referenced in `{heroName}` tags. For matchup predictions, notes only appear when ALL referenced heroes are in the teams. `{heroName}` brackets are stripped and names formatted as proper names (e.g., `{granny-dahnie}` → "Granny Dahnie"). Hero names in notes are **highlighted in teal bold** to make them stand out from the surrounding text.

#### Records Tab

```
┌──────────────────────────┬───────────────────────────────┐
│                          │  [Meta][Synergy][Power]       │
│  ┌───┐ ┌───┐ ┌───┐      │  [Records 3]                 │
│  │ L1│ │ L2│ │ L3│      │  ───────────────────────────  │
│  └───┘ └───┘ └───┘      │  ┌─────────────────────────┐ │
│     vs                   │  │ L1,L2,L3 >> R1,R2,R3 ✕ │ │
│  ┌───┐ ┌───┐ ┌───┐      │  │   notes text below...   │ │
│  └───┘ └───┘ └───┘      │  │ L1,L2,L3 <  R1,R2,R3 ✕ │ │
│     R1   R2   R3         │  │ L1,L2,L3 =  R1,R2,R3 ✕ │ │
│                          │  └─────────────────────────┘ │
│  [Faction] [Undo][Reset] │  [Copy Data][Export][Clear]  │
│  ┌──────────────────┐    │                               │
│  │ Hero icon grid   │    │                               │
│  └──────────────────┘    │                               │
└──────────────────────────┴───────────────────────────────┘
```

View-only list of recorded matches. Each record is an **immutable snapshot** of the teams at the time of recording — changing the picker doesn't affect existing records. Notes (if any) appear in a div below the match record. Delete individual records with ✕. Three action buttons:

- **Copy Data** — copies all records to clipboard in `.data` format (shows "Copied!" feedback for 2s). Paste directly into the master data file.
- **Export .data** — downloads as a file.
- **Clear All** — deletes all records.

## 7. Data Growth Strategy

- **Manual**: Edit `wandwars.data` directly, rebuild
- **Record + Copy**: Record matches in the UI, copy to clipboard, paste into master data file
- **Record + Export**: Record matches, export as `.data` file, append to master file
- **Recomputation**: All stats computed on page load from full dataset (fast even at 1000+)
- **No model files**: Scoring functions _are_ the model, operating on raw data
- **Versioning**: Data file is git-tracked

Future: if data reaches thousands, move computation to build-time JSON output.

## 8. Design Decisions

| Decision                  | Choice                                                                                  | Rationale                                                                |
| ------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Page style                | Standalone, full-width (max 1600px), responsive                                         | Two-column layout needs space; stacks at 768px                           |
| Page structure            | Single page, no mode toggle; four tabs in right panel                                   | Simpler UX, everything in one place                                      |
| Navigation                | No back button                                                                          | User navigates via site icon                                             |
| Draft order               | L1→R1→R2→L2→L3→R3; auto-detected side                                                   | No manual toggle needed                                                  |
| Pick order irrelevance    | Models evaluate unordered team sets                                                     | Draft order affects strategy, not team strength                          |
| Pick slots                | `CharacterIcon` with tooltip, level background                                          | Consistent with main app                                                 |
| All-picked state          | Both sides full opacity, no picking label                                               | Clear visual that draft is complete                                      |
| Hero grid                 | 70px circular portraits; sorted S→A→Rare, then faction                                  | Tier-first sorting surfaces strong heroes; matches `CharacterIcon` style |
| Faction filter            | `FilterIcons` (icon-based) + Undo/Reset on same row                                     | Consistent with main app; compact controls                               |
| Recommendation card       | Score (prominent) + breakdown + confidence + notes                                      | Score is the sort key; breakdown explains _why_                          |
| Score display             | "Score: X%" next to confidence badge, right-aligned                                     | Prominent alongside confidence for at-a-glance ranking                   |
| Composite breakdown       | Win Rate / Synergy / Counter                                                            | Three factors with intuitive names                                       |
| B-T breakdown             | Strength / Win Prob                                                                     | Key model outputs                                                        |
| Tab labels                | "Meta Pick" / "Hero Synergy (Composite Model)" / "Total Team Power (B-T Model)"         | Describes what each model does; technical name in parentheses            |
| Top Teams card            | Data-backed trios (W/L) + constructed trios (dashed, no W/L); pinned above recs          | Shows proven and suggested teams; Bayesian-sorted                        |
| Meta Pick pair records    | Dynamic weights: 0→45→60% pair weight as teammates increase                              | Progressively team-aware; pair W/L shown with colored text               |
| All-model matchup         | Active tab's prediction shown full, others shown compact below                           | Compare all models at a glance on any tab                                |
| Confidence labels         | "high/medium/low confidence" with tooltip                                               | Clear meaning; tooltip explains match count thresholds                   |
| Matchup prediction        | Win probability bar + confidence + verdict + record form                                | Seamless flow: predict → record                                          |
| Matchup notes             | Only show when ALL `{}` heroes are in teams                                             | Prevents irrelevant notes                                                |
| Notes hero highlight      | Hero names rendered in teal bold via `v-html`                                           | Stand out from surrounding italic text                                   |
| Score normalization       | Synergy/counter clamped [-0.5, +0.5] → shifted to [0, 1]                                | All three score components on same scale                                 |
| Dynamic weights           | Synergy/counter weights scale by pair data availability (0-1); unused weight → win rate | Prevents unreliable sparse data from dominating; adapts per-hero         |
| Sample size bonus         | Up to +5% score boost for heroes with 20+ appearances                                   | Tie-breaker favoring well-represented heroes with reliable stats         |
| Pick Rate metric          | Hero appearances / total matches, shown in breakdown                                    | Indicates meta popularity; high = common pick, low = niche               |
| Counter weighting         | Counter matrix uses match weights (1.5 for dominant)                                    | Consistent with hero stats weighting                                     |
| Synergy/counter smoothing | Bayesian-smoothed pair/matchup win rates                                                | Prevents extreme values with few observations                            |
| Draw handling (B-T)       | Draws = 0.5 wins for each side                                                          | Preserves information; more principled than discarding                   |
| B-T unknown opponents     | Average team strength from fitted params                                                | Data-driven rather than hardcoded assumption                             |
| Confidence method         | Wilson score intervals (95% CI width)                                                   | Statistically grounded; accounts for sample size and variance            |
| Record immutability       | Teams snapshotted on submit; picker stays                                               | Prevents accidental edits; faithful capture                              |
| Record notes display      | Shown in div below match record (not tooltip)                                           | Always visible, no hover needed                                          |
| Record actions            | Copy Data / Export .data / Clear All                                                    | Copy for quick paste; export for file; clear for fresh start             |
| Reset from prediction     | "Reset Teams" button under record form                                                  | Convenient after recording without scrolling to picker                   |
| Record storage            | `localStorage` (`stargazer.wandwars.records`) + export/copy                             | Persists across page reloads; Clear All removes from storage             |
| URL sharing               | Not implemented                                                                         | Not needed for personal tool                                             |
