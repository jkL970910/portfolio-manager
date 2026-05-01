# Recommendation Engine V2 Plan

> [!IMPORTANT]
> As of 2026-04-25, this project is now Flutter-first, mobile-first, Chinese-only, and Loo皇-themed. When this document conflicts with `docs/execution/flutter-mobile-migration-plan.md`, follow the migration plan first.

> [!IMPORTANT]
> As of 2026-05-01, `Recommendation V2` is deprecated as a product-facing
> version. This document is retained as historical design context. Current
> implementation and UI should use `V2.1 Core`, with external evidence shown as
> `V3 Overlay`.


## Objective

Define the next-generation recommendation engine for Loo国的财富宝库 / Portfolio Manager as a reviewable system design that can be challenged by specialist agents before implementation begins.

This document is intentionally more detailed than the v1 execution note. It separates:

- what v2 is solving
- what remains deterministic and rule-based
- where quantitative optimization is introduced
- where LLM support is useful
- what should explicitly remain out of scope in the first v2 release

## Why V2 Is Needed

The current engine is a v1 drift allocator:

- it only allocates new money toward underweight sleeves
- account placement is shallow
- ticker selection is static
- explanations are free-text summaries rather than structured rationale

This is acceptable for alpha, but it is not enough for a trustworthy beta recommendation surface.

V2 should improve four things:

1. asset-allocation accuracy after contribution
2. account-placement quality
3. security selection quality
4. recommendation explainability

## V2 Product Questions

The engine should answer these questions for each run:

1. Which asset classes should receive the next contribution?
2. Which account should each sleeve go into?
3. Which security should express that sleeve?
4. Why is that recommendation reasonable under the user’s constraints?

## Design Principles

1. Keep the core recommendation path deterministic.
2. Use quantitative optimization for allocation, not free-form AI generation.
3. Keep LLM usage in interpretation and explanation layers, not in the final money-allocation decision.
4. Persist structured rationale so the frontend can show audit-friendly explanations.
5. Build V2 so that it can later support richer risk models without rewriting the whole stack.
6. Model FX friction as a user-configurable policy, not as a single hard-coded penalty.
7. Keep risk-parity-style analysis in the portfolio diagnostics layer unless and until the product explicitly supports alternate optimization modes.

## V2 Architecture

### Layer A: Eligibility and Constraints Engine

Purpose:

- define the feasible solution space before optimization starts

Responsibilities:

- identify eligible accounts
- enforce contribution-room constraints
- apply watchlist / blacklist / target constraints
- apply account-type eligibility rules by asset class
- apply minimum trade thresholds
- apply currency / FX policy flags
- return explicit rejection reasons for ineligible options

Output:

- eligible accounts
- eligible asset-class placements
- eligible securities
- constraint-hit metadata

Rule clarification:

- for new-money recommendations, sheltered accounts with `available room <= 0` must drop out of the usable placement order for that run
- the saved preference order still matters, but it must only be applied inside the subset of accounts that are actually usable for the current contribution
- the frontend should therefore distinguish between:
  - the user’s saved account order
  - the usable order for this specific contribution

### Layer B: Allocation Optimizer

Purpose:

- allocate the contribution amount across eligible sleeves so the post-trade portfolio moves closer to target while respecting account and placement preferences

Responsibilities:

- compute current allocation
- compare against target allocation
- assign optimization weights
- minimize target-tracking error plus penalty terms

Output:

- proposed amount per asset class
- proposed amount per account
- proposed amount per security

### Layer C: Execution Formatter

Purpose:

- convert optimization outputs into practical user-facing actions

Responsibilities:

- round suggested amounts
- filter out sub-threshold trades
- attach ticker details
- produce account/security/action cards for the UI

Output:

- recommendation items ready for persistence and rendering

### Layer D: Explanation Engine

Purpose:

- provide structured explanation first, natural-language explanation second

Responsibilities:

- produce structured rationale JSON
- optionally generate beginner-friendly or expert-friendly explanations from the JSON
- support scenario-style explanation when the user asks follow-up questions

Output:

- structured rationale object
- optional LLM-generated explanation text

## Mathematical Model

V2 should start with target-tracking optimization, not mean-variance portfolio construction.

### Decision Variables

Let:

- `x[a,i,s]` = amount allocated to security `s` in asset class `i` inside account `a`

Where:

- `a` = account
- `i` = asset class
- `s` = security

### Portfolio State

Let:

- `V` = current total portfolio value in CAD-normalized terms
- `C` = contribution amount in planning-base CAD
- `H_i` = current holding value of asset class `i`
- `T_i` = target allocation weight of asset class `i`
- `W_i = H_i / V` = current asset-class weight

After contribution:

- `H'_i = H_i + Σ_a Σ_s x[a,i,s]`
- `V' = V + C`
- `W'_i = H'_i / V'`

### Base Objective Function

V2.0 should minimize:

```text
J =
Σ_i α_i (W'_i - T_i)^2
+ λ1 * TaxPenalty
+ λ2 * ConcentrationPenalty
+ λ3 * SecurityPenalty
+ λ4 * FXFrictionPenalty
+ λ5 * MinTradePenalty
```

Interpretation:

- `allocation error`: drives post-trade allocation toward target
- `TaxPenalty`: penalizes poor account placement
- `ConcentrationPenalty`: discourages excessive clustering
- `SecurityPenalty`: discourages poor product selection
- `FXFrictionPenalty`: discourages avoidable FX mismatch or broker-specific conversion friction
- `MinTradePenalty`: discourages tiny, noisy suggestions

This is a practical quadratic-program-like framework and is more appropriate than a full capital-markets optimizer for the current data maturity of the project.

### FX Friction Policy Model

FX costs should be configurable at the user and account level rather than globally hard-coded.

Suggested profile inputs:

- `has_usd_funding_path: boolean`
- `broker_fx_friction_bps: number`
- `allow_cross_currency_trades: boolean`
- `preferred_trading_currency: CAD | USD | mixed`

This allows the engine to distinguish between:

- users who must pay retail broker FX spreads on every cross-currency trade
- users who can fund USD accounts directly and therefore face much lower friction
- users who are indifferent to currency location because their trading workflow already neutralizes the cost

The penalty should therefore be applied as:

```text
FXFrictionPenalty = f(user_fx_profile, account_currency, asset_currency, funding_path)
```

## Account-Fit and Tax-Location Model

The first real upgrade from v1 should be an explicit score matrix.

### Account Placement Score

Define:

- `L[a,i,s] ∈ [0,1]`

Meaning:

- how appropriate account `a` is for placing asset class `i` or security `s`

Illustrative matrix for V2.0:

| Asset Class | TFSA | RRSP | FHSA | Taxable |
|---|---:|---:|---:|---:|
| Canadian Equity | 0.90 | 0.80 | 0.90 | 0.80 |
| US Equity | 0.75 | 0.95 | 0.75 | 0.65 |
| International Equity | 0.70 | 0.85 | 0.70 | 0.45 |
| Fixed Income | 0.65 | 0.95 | 0.75 | 0.20 |
| Cash | 0.80 | 0.60 | 0.90 | 0.70 |

Then:

```text
TaxPenalty = Σ_a Σ_i Σ_s x[a,i,s] * (1 - L[a,i,s])
```

This is not a full tax engine. It is an explicit, explainable placement heuristic that can later be refined with Canadian account-treatment rules.

### Contribution-Room Constraint

```text
Σ_i Σ_s x[a,i,s] <= room[a]
```

For taxable accounts:

- room is effectively unbounded
- but their placement score should be lower for tax-inefficient assets

## Security Selection Model

V1 uses static ticker maps. V2 should move to ranking.

### Security Score

For each eligible security `s`:

```text
Score_security(s) =
b1 * ExposureMatch
+ b2 * WatchlistBoost
- b3 * FeePenalty
- b4 * TrackingErrorPenalty
- b5 * LiquidityPenalty
- b6 * CurrencyMismatchPenalty
```

V2.0 should keep this pragmatic.

Initial candidate features:

- exposure match to target sleeve
- watchlist inclusion
- blacklist exclusion
- listing currency
- basic product fee
- simple liquidity proxy

This requires a `security_master` table or equivalent curated universe.

## Quantitative Analysis Strategy

Yes, V2 should use quantitative analysis, but in a disciplined way.

### Recommended for V2.0

1. target-tracking optimization
2. account-fit score matrix
3. security ranking score
4. minimum trade threshold logic
5. concentration penalty
6. configurable FX friction policy

This is already quantitative, but it stays aligned with the user’s actual problem: allocating new money into a target-driven personal portfolio.

### Recommended for V2.5

1. historical volatility penalty by asset class or security
2. correlation-aware diversification penalty
3. simple scenario comparison mode
4. richer multi-account FX and funding-path modeling

### Explicitly Defer

Do not make these the first V2 implementation:

- mean-variance optimization
- Black-Litterman
- CVaR optimization
- full risk-parity optimizer as the default recommendation engine

Reason:

- current product data is not mature enough
- assumptions would be difficult to justify to retail users
- the explanation burden would exceed the value at this stage

### Risk Parity Positioning

Risk parity should be treated as a diagnostics and comparison framework before it becomes a recommendation-engine mode.

Recommended placement:

- `Portfolio Health Score`
- `Radar Analysis`
- future comparison mode for advanced users

This is a better fit than using risk parity as the default contribution-planning engine because the product already centers on explicit target allocations, registered-account constraints, and user-specified sleeve preferences.

## LLM Integration Strategy

LLM should assist, not decide.

### Good LLM Roles

#### 1. Preference Interpreter

Convert natural-language intent into structured preference inputs.

Example:

- user says: “I may buy a house in 5 years but still want some growth”
- LLM outputs structured hints for:
  - time horizon
  - liquidity need
  - risk tolerance
  - account-priority hints

#### 2. Recommendation Explainer

Take structured rationale JSON and produce:

- plain-language explanation
- beginner version
- expert version
- Chinese / English localized reasoning

#### 3. Scenario Translator

Map follow-up questions into deterministic reruns.

Examples:

- “What if I only want RRSP contributions next month?”
- “What if I avoid buying more US equity?”

LLM turns those into scenario inputs. The deterministic engine reruns the optimization.

#### 4. Consistency Checker

Detect contradictions between stated user preferences and current setup.

Examples:

- says conservative, but watchlist is growth-heavy
- says minimize FX, but selected preferred products are USD-only

### Bad LLM Roles

Do not let LLM:

- choose the final dollar amounts directly
- override account constraints
- invent security recommendations without the security universe
- generate return forecasts as if they were model outputs

## Recommended Runtime Shape

```text
UI
 -> Recommendation API
   -> constraint engine
   -> allocation optimizer
   -> security ranker
   -> structured rationale
   -> optional LLM explanation service
```

Not:

```text
UI -> LLM -> recommendation
```

## Structured Rationale Model

Each recommendation item should persist fields like:

- `allocation_gap_before_pct`
- `allocation_gap_after_pct`
- `account_fit_score`
- `tax_fit_score`
- `security_score`
- `constraint_hits`
- `reasoning_json`

This is the bridge between deterministic math and AI-assisted explanation.

## Proposed Data Model Changes

### recommendation_runs

Add:

- `engine_version`
- `run_type`
- `scenario_source`
- `display_currency`
- `optimization_objective`
- `confidence_score`

### recommendation_items

Add:

- `security_symbol`
- `security_name`
- `security_score`
- `allocation_gap_before_pct`
- `allocation_gap_after_pct`
- `account_fit_score`
- `tax_fit_score`
- `constraint_hits`
- `reasoning_json`

### New Tables

1. `security_master`
2. `security_tax_traits`
3. `recommendation_scenarios`
4. `recommendation_explanations`
5. `fx_policy_overrides`

Potential future table:

5. `capital_market_assumptions`

## API and Service Layer Proposal

### Service Functions

- `buildRecommendationContext(userId)`
- `solveContributionPlan(context, input)`
- `rankEligibleSecurities(context, sleeve)`
- `buildRecommendationRationale(context, solution)`
- `generateRecommendationExplanation(rationale, locale)`

### API Endpoints

Short-term:

- extend existing `/api/recommendations/runs`
- add optional scenario payloads
- add optional explanation mode

Future:

- `/api/recommendations/scenarios`
- `/api/recommendations/explanations`
- `/api/recommendations/compare`

## Implementation Phases

### Phase 1: V2 Foundation

- account-fit score matrix
- security master table
- structured rationale schema
- persisted `engine_version`
- recommendation source metadata

### Phase 2: Allocation Optimizer

- target-tracking optimizer
- concentration penalty
- min-trade filter
- security ranking integration

### Phase 3: Explanation Upgrade

- explanation JSON schema
- deterministic rationale generation
- optional LLM explanation rendering
- what-if scenario translation layer

### Phase 4: Advanced Quant Layer

- volatility-aware penalties
- correlation-aware diversification
- richer FX friction modeling
- scenario comparison and simulation

## Success Criteria

V2 is successful when:

1. recommendation runs are meaningfully better than v1 on account placement and sleeve targeting
2. users can see structured explanations for why each amount landed where it did
3. the system can support Chinese and English explanation surfaces without duplicating recommendation logic
4. the engine remains deterministic and testable even when LLM features are disabled

## Review Questions For Specialist Agents

1. Is target-tracking optimization the right first quantitative model for this product stage?
2. Is the proposed account-fit score matrix sufficient for a Canadian investing workflow, or does it need explicit wrapper-tax rules earlier?
3. Should security ranking stay heuristic in V2.0, or is there enough value to introduce a formal factor model?
4. Which rationale fields are essential for user trust, and which can be deferred?
5. Is the proposed LLM boundary strict enough to preserve deterministic recommendation quality?

## Out of Scope For V2.0

- full sell-side rebalance engine
- full budgeting integration into recommendation optimization
- institutional-grade factor investing model
- direct broker execution
- fully autonomous AI recommendation generation




