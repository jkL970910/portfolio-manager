# Recommendation V3 / 进货工作台 Plan

Last updated: 2026-05-18

## 2026-05-18 Dynamic Pool / CandidatePoolPolicy Decision

The next recommendation-engine slice should move from a static curated pool
toward a governed dynamic pool, but it must stay rules-first and auditable.

Final decisions from product review:

1. `CandidatePoolPolicy` is a hard eligibility layer, not just a score boost.
2. Hard filters must never be silently bypassed to make the page look non-empty.
3. If strict user rules produce zero eligible candidates, the API should return
   a structured `needs_policy_relaxation` result instead of forcing a default
   symbol.
4. Any fallback must be user-confirmed and limited to high-confidence core-pool
   candidates.
5. External workers provide candidate facts and evidence. They do not own the
   final recommendation decision.
6. Cash/cash-parking candidates should be policy-controlled. High-risk users can
   hide routine cash recommendations, but cash can still re-enter when there is
   a near-term liability, reserve gap, all risk assets are blocked, or the
   execution modifier says `wait_pullback`.

Recommended empty-result contract:

```ts
type RecommendationPoolStatus =
  | { status: "ok" }
  | {
      status: "needs_policy_relaxation";
      reason: string;
      blockers: string[];
      suggestedRelaxations: Array<{
        type: "allow_role" | "allow_asset_class" | "lower_threshold";
        value: string;
        label: string;
      }>;
    };
```

User-facing behavior:

- Show `候选池边界过严，暂无可推荐标的`.
- Show the main blockers, such as `固定收益被禁用` or `美股已超配`.
- Offer explicit actions:
  - `放宽核心池`
  - `去设置调整规则`
  - `查看被排除原因`
- If the user confirms fallback, the request should carry
  `fallbackMode: "core_only_relaxed"` and the resulting cards must label the
  source as `放宽规则后的核心池候选`.

## User-Visible Pool Model

Do not expose internal terms such as `raw pool`, `eligible pool`, or
`rejectedCandidates` in the mobile UI. The user should still have enough
visibility to understand where their watched securities went.

User-facing mapping:

1. `进货优先级`
   - The primary recommended pool.
   - Contains candidates that passed policy filtering and entered ranking.
   - These are the only cards that should look like actionable recommendations.
2. `囤货清单`
   - User watchlist.
   - Shows watched securities even when they are not recommended today.
   - Each card should carry a compact status:
     - `已进推荐池`
     - `暂不推荐`
     - `待刷新资料`
     - `资料待确认`
     - `规则已排除`
3. `待鉴定包裹`
   - Quarantine for identity-incomplete or low-confidence candidates.
   - These must not enter ranking until the user or worker resolves identity /
     profile quality.
4. `为什么没进货`
   - Optional expanded explanation on a watched candidate.
   - Should explain the largest blocker in plain Chinese, such as overexposure,
     missing identity, stale data, excluded role, or cash/liability guardrail.

This keeps the recommendation page explainable without turning it into an
engineering audit table.

## CandidatePoolPolicy

`CandidatePoolPolicy` should be built from Preference Factors V2, recommendation
constraints, account availability, portfolio state, and current cash/liability
context.

It should run before scoring:

1. Build the raw candidate set from `core_pool + dynamic_pool + watchlist`.
2. Resolve identity and economic exposure.
3. Apply hard eligibility rules.
4. If empty, return `needs_policy_relaxation`.
5. Score eligible candidates.
6. Apply guardrails and execution modifiers.
7. Return `CandidateBrief` cards plus rejection / exclusion evidence.

Policy inputs:

- risk capacity and risk appetite
- concentration tolerance
- preferred / avoided sectors and themes
- allowed asset classes and security types
- account/tax routing constraints
- home-purchase, emergency-cash, and near-term liquidity goals
- watchlist source and candidate identity confidence
- provider confidence / freshness from worker-maintained data

Example policy shape:

```ts
type CandidatePoolPolicy = {
  includeRoles: Array<"core" | "satellite" | "defensive" | "cash_parking">;
  excludeRoles: Array<"core" | "satellite" | "defensive" | "cash_parking">;
  allowedAssetClasses: string[];
  avoidedAssetClasses: string[];
  preferredSectors: string[];
  avoidedSectors: string[];
  maxExpenseBps: number | null;
  minLiquidityScore: number;
  allowSingleStocks: boolean;
  allowSectorEtfs: boolean;
  allowCommodity: boolean;
  allowCashParking: boolean;
  requireCleanIdentity: boolean;
  minProviderConfidence: "low" | "medium" | "high";
};
```

Implementation rule:

- `excludeRoles` and explicit user exclusions are hard filters.
- Preference tilts can boost/penalize score only after a candidate passes hard
  eligibility.
- High-risk preference can remove routine `cash_parking`, but cannot override
  short-term liability and reserve guardrails.

## Dynamic Candidate Pool

The dynamic pool should be implemented as a registry, not direct provider search
inside the recommendation request path.

Target architecture:

1. `Core ETF Universe`
   - code/seeded high-trust Canadian-investor ETF list
   - source of truth for first production V3 decisions
2. `Dynamic Candidate Registry`
   - DB-backed table populated by workers
   - stores identity, profile, exposure, liquidity, expense, confidence, source,
     TTL, and eligibility notes
3. `Watchlist Candidate Feed`
   - user ideas
   - must pass identity resolution and policy eligibility before becoming
     recommendable
4. `CandidateProvider`
   - backend abstraction that returns normalized candidates from all three
     sources

Provider data must be treated as confidence-rated evidence:

- High confidence: clean identity, reliable quote/profile, known exposure.
- Medium confidence: identity clean but exposure/profile partial.
- Low confidence: missing exchange/currency/security id, weak ETF profile,
  ticker-only match, or stale provider result.

Low-confidence candidates should appear under `待鉴定包裹`, not the main
recommendation list.

## External Worker Accuracy Boundary

The external worker should improve recall and freshness, not become the
decision-maker.

Expected precision by data type:

- Identity (`symbol + exchange + currency + security_id`): high only when
  OpenFIGI/provider/registry agree; otherwise quarantine.
- Quotes and price history: medium-high if provider-backed and fresh.
- ETF profile / expense / category: medium, because free providers often have
  incomplete TSX ETF coverage.
- ETF holdings / sector / region look-through: medium to low unless sourced
  from a specialized ETF provider or curated registry.
- News / sentiment: low to medium; usable for evidence and warnings, not
  hard recommendations.

Provider and cost boundary:

- Free APIs are enough for a small curated/core-pool worker and watchlist smoke.
- Broad dynamic discovery and ETF look-through will likely need a paid provider
  later.
- Page load must not call provider discovery APIs.
- Worker writes should be quota-ledgered and cache/TTL controlled.

The first implementation should therefore keep provider scope small:

1. Refresh held securities, watchlist, and core-pool candidates only.
2. Upsert dynamic candidates only when identity and basic profile are clean.
3. Store uncertainty explicitly.
4. Keep low-confidence rows out of primary recommendations.

## P1 Deep Recommendation Algorithm Backlog

Recommendation V4 is complete as the first production-grade pool and policy
layer. The next algorithm work should not be treated as hotfixes; it belongs in
P1 because it changes recommendation quality, provider dependencies, and user
preference semantics.

P1 algorithm tasks:

1. `CandidatePoolPolicy` factor calibration
   - tune how risk appetite, risk capacity, preferred/avoided sectors, allowed
     security types, concentration tolerance, and liquidity needs affect hard
     filters versus score boosts
   - keep explicit exclusions as hard filters
   - add fixture-based regression tests for conservative, balanced, and
     high-risk profiles
2. Dynamic pool precision upgrade
   - expand the worker-backed dynamic pool beyond current watchlist/recent/core
     coverage only when identity, exchange, currency, liquidity, expense, and
     economic exposure confidence are sufficient
   - keep broad external discovery behind TTL, quota ledger, and provider
     confidence labels
   - do not run provider discovery during page load
3. Core ETF universe expansion
   - add a richer Canadian-investor core matrix for cash, short-term fixed
     income, aggregate bonds, Canadian equity, US equity, international equity,
     global all-in-one ETFs, commodities / gold, and USD-listed tax-efficient
     RRSP candidates
   - encode role, sleeve, tax-routing hints, currency, hedging, expense, and
     economic exposure in the universe
4. Execution modifier calibration
   - connect valuation evidence, key levels, market pulse, and stale-data state
     to action modifiers such as `lump_sum`, `dca`, `wait_pullback`, and
     `watch_only`
   - keep portfolio guardrails higher priority than valuation/timing
5. Counterfactual and rejection explanation quality
   - for each watched/recent candidate, expose the largest blocker in plain
     Chinese without dumping audit logs
   - persist enough rejected-candidate context on the recommendation run so old
     runs remain explainable after watchlist/preferences change
6. Backtest / replay harness
   - replay recommendation runs against fixed portfolio/profile fixtures and
     historical candidate pools
   - compare V4/V5 output stability, turnover, concentration, and sleeve-gap
     improvement before changing production weights
7. Provider cost and confidence dashboard
   - show whether dynamic-pool evidence came from curated registry, free
     provider, paid provider, or heuristic fallback
   - separate user-facing capability labels from raw env flags

Non-goals for P1:

- no LLM-generated buy/sell decision
- no silent fallback candidate when hard filters remove everything
- no ticker-only automatic promotion into the recommendation pool
- no paid-provider dependency before the free/curated pipeline proves the UX
  value

## 2026-05-18 MDD Signoff Scope

The next build slice is the foundation for the mobile `进货` workbench and the
future Daily Brief worker. It is intentionally additive.

In scope now:

1. Add a curated `Core ETF Universe` for Canadian-investor routing.
2. Gate new mobile watchlist additions behind clean `symbol + exchange +
   currency` identity.
3. Add a mobile-compatible `CandidateBrief` contract on recommendation
   priorities while preserving existing V2.1 fields.
4. Record Daily Brief architecture as deterministic snapshot diffing first.
5. Let mobile users re-run the workbench with preset contribution amounts from
   the hero card, while keeping custom amount entry available.
6. Render recommendation priority cards from `CandidateBrief` first: action,
   amount, target account, match score, portfolio-impact, and compact badges.
7. Move scorelines, V3 overlay, intelligence refs, guardrails, and execution
   detail into an expandable evidence drawer.
8. Quarantine identity-incomplete watchlist rows as `待鉴定包裹` so they cannot
   be mistaken for actionable recommendation candidates.
9. Collapse the recommendation-engine explanation into a compact `囤货规矩`
   panel with a Settings link for Preference Factor edits.

Out of scope for this slice:

- Full V3 scoring replacement.
- Real queue infrastructure.
- GPT-generated daily summaries by default.
- Automated trading signals.

## Product Boundary

`进货` is a rules-first funding workbench. The backend decides from allocation
gap, account placement, tax fit, FX friction, economic exposure, concentration,
and user cash/home-goal guardrails. LLM, AI 大臣, external news, and future Daily
Briefs are evidence/explanation layers only.

Watchlist items are candidate ideas. They should not bypass guardrails, and
identity-incomplete entries must be quarantined or resolved before they enter
the primary recommendation flow.

## Core ETF Universe

The core universe is a high-trust candidate pool for filling allocation gaps.
It should be maintained as code/registry first, not user-editable DB rows yet.

Required metadata:

- canonical identity: symbol, exchange, currency, security type
- economic exposure: asset class, region, sector/theme tags
- role: core / satellite / cash-parking / defensive
- cost/liquidity hints: expense bps and liquidity score
- tax routing hints: preferred accounts, avoided accounts, withholding notes
- execution hints: lump sum / DCA / wait-pullback defaults

Initial examples:

- `CASH.TO`: cash parking / liquidity buffer
- `XBB.TO`: Canadian aggregate bonds / fixed income
- `VFV.TO`: CAD-listed US equity core for TFSA/FHSA/Taxable paths
- `VOO`: USD-listed US equity core, preferentially RRSP when USD path exists
- `XEF.TO`: developed international equity
- `VCN.TO` / `XIC.TO`: Canadian equity core

## CandidateBrief Contract

`CandidateBrief` is a compact card-oriented contract for Flutter. It is added
beside existing recommendation priority fields so older rendering remains
compatible.

```ts
type CandidateBrief = {
  identity: {
    securityId?: string | null;
    symbol: string;
    name: string;
    exchange?: string | null;
    currency?: "CAD" | "USD" | null;
  };
  source: "core_pool" | "watchlist" | "existing_holding" | "manual";
  decision: {
    action: "lump_sum" | "dca" | "wait_pullback" | "avoid";
    matchScore: number;
    recommendedAmountCad: number;
    targetAccount: "TFSA" | "RRSP" | "FHSA" | "Taxable";
  };
  portfolioImpact: {
    gapResolved: { beforePct: number | null; afterPct: number | null };
  };
  badges: string[];
  primaryBlocker: string | null;
  rejectionReason: string | null;
  dailyBriefId: string | null;
};
```

Action semantics:

- `lump_sum`: amount and context are clean enough for a one-shot contribution.
- `dca`: candidate is acceptable, but timing/market or size suggests staging.
- `wait_pullback`: candidate fits structurally, but price/market timing argues
  for waiting.
- `avoid`: hard blocker or poor fit; show reason, do not make it the primary
  purchase path.

## Daily Brief Worker Direction

First version should be deterministic and cheap.

Inputs:

- current holdings
- clean watchlist identities
- Core ETF Universe
- latest security research profile / key levels
- valuation evidence state
- market pulse snapshot
- cached external-research documents

Process:

1. Build a normalized daily snapshot per security.
2. Compute `guardrailHash`, `valuationHash`, `keyLevelHash`, and
   `marketContextHash`.
3. Compare against the previous snapshot.
4. Write a brief only when material state changes.

GPT is optional:

- default worker writes deterministic Chinese diff summaries
- GPT summary may run only on material changes or user-triggered enhancement
- page load never calls GPT or live news providers

## Current Implementation Status

### 2026-05-18 V4 Pool Visibility Slice

Completed in this slice:

- Added backend `recommendation-v4` visibility DTOs for the mobile workbench.
- Added a `buildRecommendationV4Visibility` summarizer that builds a
  user-visible candidate-pool audit from:
  - existing recommendation priorities
  - saved watchlist symbols
  - recent observed/search securities
- Preserved the existing V2.1/V3 recommendation result shape. V4 currently adds
  transparency and repair guidance; it does not replace the deterministic
  scoring core yet.
- Implemented no-silent-fallback behavior at the visibility layer:
  - zero eligible candidates returns an explicit empty state
  - the system does not inject a default ETF just to avoid an empty UI
- Mobile `进货台` now parses and renders:
  - raw candidate count vs entered recommendation-pool count
  - source breakdown such as core pool / 囤货清单 / 近期观察
  - status breakdown such as 已进推荐池 / 仅观察 / 身份待确认 / 资料待补
  - first-pass reasons for watched or observed securities that did not become
    actionable recommendations
- Added backend tests for:
  - watchlist candidate not selected by policy
  - missing watchlist identity quarantine
  - recent observations entering raw pool
  - selected recommendation deduping against watchlist

Still pending for full V4:

1. Replace the current static/core candidate construction with a real
   `CandidateProvider` that merges `core_pool + dynamic_pool + watchlist`.
2. Persist dynamic-pool candidates in DB with provider confidence, TTL, and
   source metadata.
3. Move hard filtering into a first-class `CandidatePoolPolicy` module consumed
   before scoring, not only a visibility summarizer.
4. Add user-facing controls for allowed/excluded roles and asset classes in
   Settings.
5. Add explicit fallback confirmation flow (`core_only_relaxed`) rather than
   automatic fallback.
6. Feed daily snapshot diff / Daily Brief IDs into candidate cards once the
   worker pipeline exists.

### 2026-05-18 V4 CandidateProvider / Policy Slice

Completed in this slice:

- Extended `RecommendationCandidateProvider` beyond the static core ETF
  universe.
- Added watchlist and recent-observation providers into the candidate pipeline.
  These candidates now enter the same raw candidate set as core-pool candidates.
- `buildRecommendationV2` can now receive holdings, security metadata records,
  and recent mobile observations, then pass them into candidate construction.
- `createRecommendationRun` and scenario runs now provide recent observations
  and security metadata to the recommendation engine.
- V4 mobile visibility now reuses real `CandidatePoolPolicy` evaluations rather
  than only summarizing the final recommendation list after the fact.
- Added repository support for batched security metadata loading by id.
- Added a persisted `poolEvaluation` snapshot on `recommendation_runs`. This
  stores the exact raw / eligible / rejected candidate pool used by a run, so
  mobile visibility can explain that run without silently recomputing against a
  later watchlist or preference state.
- Added a Drizzle migration:
  - `drizzle/0029_recommendation_pool_evaluation.sql`
  - column: `recommendation_runs.pool_evaluation jsonb`
- Added tests proving:
  - watchlist candidates can enter the candidate pool when identity and asset
    sleeve match
  - recent observations can enter the candidate pool when identity and asset
    sleeve match
  - V4 visibility reflects the broader policy-evaluated pool, not just the
    final selected recommendation rows
  - V4 visibility prefers persisted `poolEvaluation` when present, avoiding a
    mismatch between the historical recommendation run and current watchlist /
    observation state

Important product boundary:

- Watchlist and recent-observation candidates are allowed into the raw candidate
  pool, not directly into actionable recommendation output.
- They still must pass identity, provider-confidence, role, asset-class,
  liquidity, fee, security-type, and user-exclusion rules before ranking.
- Incomplete or low-confidence items remain visible as repairable / rejected
  candidates instead of becoming `Loo皇推荐`.
- A recommendation run is now auditable as a snapshot. Current watchlist or
  recent-observation changes can affect the next run, but they should not
  rewrite the explanation for an already-created run.

Still pending for full V4:

1. Persist a DB-backed `dynamic_pool` populated by workers, instead of relying
   only on recent observations.
2. Store provider confidence, TTL, source metadata, and last-refresh state for
   DB-backed dynamic candidates.
3. Add Settings controls for role/asset-class exclusions and fallback approval.
4. Add explicit fallback confirmation request shape such as
   `fallbackMode: "core_only_relaxed"`.
5. Add worker-generated daily snapshot diff references into `CandidateBrief`.
6. Replace remaining product-facing `V2.1 Core` naming with a cleaner
   `Rules Core + V4 Pool` naming once the core scoring module is fully renamed.

### 2026-05-18 V4 Policy Controls / Explicit Fallback Slice

Completed in this slice:

- Extended saved `recommendationConstraints` with V4 candidate-pool controls:
  - `includedCandidateRoles`
  - `excludedCandidateRoles`
  - `allowRelaxedCoreFallback`
- `CandidatePoolPolicy` now applies these role controls before scoring. This
  lets user preference rules hide or allow candidate classes such as
  `core`, `satellite`, `cash_parking`, and `defensive` without changing the
  scoring formula itself.
- Added an explicit `fallbackMode: "core_only_relaxed"` request contract for
  recommendation-run creation.
- Relaxed fallback is not automatic. It only runs when:
  1. the client explicitly sends `fallbackMode: "core_only_relaxed"`, and
  2. the saved profile has `allowRelaxedCoreFallback: true`.
- Mobile now has a user-confirmed `放宽核心池` action from the empty-pool
  state. The fallback path still does not override explicit excluded symbols;
  it only relaxes role/liquidity/confidence thresholds toward core-pool
  candidates.
- Settings mobile models preserve the new V4 fields so preference saves do not
  accidentally erase them.
- Added tests proving:
  - role exclusions can remove satellite candidates before scoring
  - strict rules still return `needs_policy_relaxation` by default
  - explicit relaxed-core fallback can recover a core recommendation when
    invoked intentionally

Product boundary:

- Fallback is a user action, not a hidden system behavior.
- The UI can offer `放宽核心池`, but the backend remains the authority on whether
  relaxed fallback is allowed for that profile.
- This is still not a trading signal. It only relaxes candidate-pool eligibility
  so the deterministic rules engine can produce a conservative core-pool option.

Still pending after this slice:

1. Add the polished Advanced Settings UI controls for candidate roles and
   fallback approval.
2. Expand dynamic-pool workers from clean watchlist/recent observations to
   scheduled provider-backed discovery.
3. Surface dynamic candidate TTL/confidence/source metadata in a compact
   user-facing repair/audit sheet.
4. Render `dailyBriefId` in the recommendation card as a clickable “宝库晨报”
   reference.

### 2026-05-18 V4 Dynamic Pool / Daily Brief Wiring Slice

Completed in this slice:

- Added DB-backed `recommendation_dynamic_candidates`.
- Added repository methods:
  - `recommendationDynamicCandidates.upsert`
  - `recommendationDynamicCandidates.listFreshByUserId`
- Added a deterministic dynamic-pool worker helper:
  - `refreshRecommendationDynamicPoolForUser(userId)`
- The worker currently upserts only clean-identity watchlist and recent
  observation candidates that already have known economic exposure. It does not
  call external search providers from page load.
- Dynamic candidate records persist:
  - canonical listing identity
  - asset class
  - role
  - provider confidence
  - liquidity score
  - expense estimate
  - source metadata
  - `lastRefreshedAt`
  - `expiresAt`
- `RecommendationCandidateProvider` now includes a DB-backed dynamic provider.
- `createRecommendationRun` refreshes the dynamic pool before scoring and then
  passes fresh dynamic candidates into V4 pool evaluation.
- `CandidateBrief.dailyBriefId` now links to matching cached daily intelligence
  when an existing brief matches the recommended listing.

Important boundary:

- The dynamic pool is still an eligibility source, not a recommendation by
  itself.
- Items from dynamic pool still must pass `CandidatePoolPolicy`, identity,
  confidence, role, asset-class, liquidity, fee, and user exclusion checks.
- Page load reads cached DB state only. It does not fan out to external
  discovery APIs.

Next implementation targets:

1. Add Settings UI controls for V4 role rules and fallback approval.
2. Add a scheduled dynamic-pool refresh endpoint/worker for held securities,
   clean watchlist entries, recent observations, and core-pool candidates.
3. Add compact mobile visibility for dynamic candidate confidence/TTL/source
   without exposing raw engineering logs.
4. Render clickable Daily Brief references inside recommendation cards.

The V3 shape exists, but raw live news/forum information is not enabled yet.

- Completed: V2.1 Core remains the deterministic baseline; V3 Overlay can read
  persisted `external_research_documents` and saved analysis runs.
- Completed: `Loo国今日秘闻` reads cached/persisted intelligence and saved
  analysis, not live news on page load.
- Completed: security identity is listing-aware through `security_id`,
  `symbol + exchange + currency`, and external documents cannot use ticker-only
  evidence as confirmed listing-level data.
- Completed: security metadata has provider boundaries, including OpenFIGI for
  identity/alias support and Alpha Vantage profile for company/ETF metadata.
- Completed: the external-research worker can persist Alpha Vantage company/ETF
  profile snapshots into `external_research_documents` when the `profile`
  source is explicitly enabled.
- Completed: first-pass US market pulse context is cached in
  `market_sentiment_snapshots`, shown on Overview as `今日市场脉搏`, included in
  `Loo国今日秘闻`, and consumed by Recommendation V3 Overlay as a low-weight
  timing/risk signal. The current snapshot stores FGI score/level, VIX
  value/level, and an A-I 3x3 matrix quadrant with a user-facing buy-tempo
  strategy. The current provider is explicitly labeled as
  `derived-us-market-sentiment`; it is not presented as live CNN/VIX data.
- Completed: automated tests cover the profile document consumption chain:
  `external_research_documents` -> `Loo国今日秘闻` -> Recommendation V3 overlay
  -> AI 大臣 `external-intelligence` facts. The chain remains cache-backed and
  does not call providers from Flutter page load.
- Partial: `portfolio-analyzer.skill` has been productized as a guarded/cached
  analysis path, but still needs real local/cloud smoke on profile documents.
- Not completed: live news/forum/announcement provider adapters remain disabled.
  The next P0 task is to run profile smoke on representative real candidates,
  then add one bounded announcement/filing/earnings-calendar style provider.
  Both must write `external_research_documents` through the worker, not from
  Flutter page load.

## Version Naming Decision

`Recommendation V2` is now deprecated as a product-facing version name.

- `V2` remains a historical design document and some internal file/function names
  still use `recommendation-v2` to avoid a broad rename.
- Current recommendation execution should be described as `V2.1 Core`.
- External evidence should be described as `V3 Overlay`.
- UI, docs, and AI 大臣 answers should not present `V2` as the active engine.

## Decision

Upgrade toward `Recommendation Engine V3` instead of stretching the deprecated
V2 product version.

V2.1 Core is the active deterministic core:

- target allocation gap
- account placement
- tax-aware placement
- FX friction
- watchlist / excluded / preferred identities
- asset-class bands
- security-type constraints

V3 adds an external-intelligence overlay:

- cached market-data freshness and trend context
- cached market pulse / VIX + FGI timing context
- curated news / announcement / institutional sources
- optional low-confidence community sentiment
- richer investor preference factors
- better explanation of why a candidate is recommended, postponed, or rejected

The V3 engine must remain auditable. External information can adjust ranking and
warnings, but it must not silently override the user's saved allocation,
account rules, or explicit exclusions.

## Why Not Just Patch Deprecated V2

V2 was the original rule-engine design. V2.1 is now the active version because it
adds Preference Factors V2, recommendation constraints, security identity,
account/tax/FX handling, and data-freshness boundaries.

Adding live news, forum sentiment, personal goals, sector tilts, and life-event
planning directly inside the core engine would make it harder to test and explain. The safer
structure is:

1. V2.1 Core produces baseline candidate recommendations.
2. External-intelligence workers attach cached evidence to candidate identities.
3. V3 reranks / annotates V2.1 candidates using that evidence and the expanded
   preference profile.
4. Mobile shows both the baseline reason and the external-intelligence impact.

## New Product Surfaces

### 1. Recommendation V3

Goal:

- Show recommendations that combine portfolio drift, account/tax placement,
  and curated external context.

Required behavior:

- Preserve `symbol + exchange + currency` on every candidate.
- Keep V2.1 baseline score visible.
- Add V3 overlays such as:
  - external information score
  - confidence level
  - positive catalysts
  - risk flags
  - freshness / source mode
  - why now / why not now
- Never recommend a security if the user explicitly excluded that exact
  identity.
- Never treat community sentiment as high-confidence fact.
- Never let market pulse directly override target allocation, explicit
  exclusions, account/tax/FX constraints, or identity rules. It can only adjust
  timing language, risk warnings, and small overlay score calibration.
- Never use live external data directly in the mobile request path. V3 must
  consume persisted/cached documents produced by workers.

Initial output model:

- `engineVersion: "v3"`
- `baselineScore` (V2.1 Core)
- `externalInsightScore`
- `preferenceFitScore`
- `finalScore`
- `sourceMode: local | cached-external | live-external`
- `sourceFreshness`
- `externalSignals[]`
- `preferenceSignals[]`
- `riskFlags[]`
- `explanation`

### 2. Loo国今日秘闻

Goal:

- Give the user a compact, curated daily intelligence card, not a raw news feed.
- The full card belongs on Overview only. Recommendation should consume the same
  cached intelligence for scoring/explanation, but should only show lightweight
  `外部资料纳入推荐` status plus item-level evidence snippets.
- Daily overview intelligence is refreshed by worker/cache/quota boundaries, not
  by Flutter page load. Single-security refresh is allowed later only as an
  explicit, quota-limited Security Detail action.

Recommended sources:

- P0.5: cached/derived US market pulse using a VIX + FGI 3x3 decision matrix
- P1: cached market-data anomalies and quote/provider events
- P1: company announcements / filings / earnings-calendar style records
- P1: selected financial news API summaries
- P2: institutional / ETF holding / fundamentals data
- P2/P3: Reddit/forum/community sentiment as low-confidence color only

Current source policy:

- Active now: persisted external research documents, saved analysis runs, cached
  market-data documents, opt-in Alpha Vantage profile documents, and
  `derived-us-market-sentiment` market pulse snapshots.
- Next P0: one structured announcement / filing / earnings-calendar /
  fundamental-event style adapter.
- Next P0.5/P1 provider upgrade: replace or supplement the derived FGI/VIX
  inputs with bounded provider-backed sources such as CNN Fear & Greed and a
  stable VIX quote/history source if legal/stable endpoints are selected. If
  the provider fails, keep using the last cached snapshot or the derived
  fallback; do not call live sentiment APIs from Flutter page load.
- Later: curated financial news APIs.
- Last: forum/community sentiment, always low-confidence and never treated as
  fact.

Card behavior:

- Show 3-7 curated items max.
- Each item must include:
  - title
  - related symbol identity when available
  - source type
  - source freshness / as-of
  - relevance reason
  - confidence
  - user action: `查看标的`, `加入观察`, `问大臣`, `忽略`
- Do not present random headlines. Every item must be tied to:
  - a current holding
  - a watchlist candidate
  - a recommendation candidate
  - a material macro/tax/FX event relevant to the user's profile

### 3. Preference Factors V2

Current factors are too shallow for the user's intended behavior. Add a richer
profile that can express sector tilts, life goals, and account constraints.

Implementation status:

- Backend storage started in `preference_profiles.preference_factors`.
- The first contract is intentionally JSONB so factor groups can iterate
  without repeated table migrations.
- Missing or partial payloads are normalized to safe defaults, so existing
  preference forms remain backward compatible.
- Flutter Settings now exposes manual `进阶` configuration, and guided setup
  generates a Preference Factors V2 draft before applying it.
- Recommendation V2.1 now consumes a small safe subset for candidate ordering
  and explanation: preferred/avoided sectors, style/thematic tilts, risk
  capacity, concentration tolerance, and near-term home-purchase risk buffer.
- V2.1 does not let these factors override saved target allocation. V3 should
  make the preference-fit overlay explicit in the output model.

AI-guided workflow requirement:

- AI 大臣 can ask beginner-friendly questions across goals, risk, sector/style,
  tax, liquidity, and external-info preferences.
- The AI must return a structured Preference Factors V2 payload, not free-form
  prose.
- Before applying, mobile must show the generated parameters and the user must
  confirm or manually edit them.
- Manual configuration remains available and can override AI-generated values.
- First implementation: Settings `进阶` provides a narrative prompt box. It
  asks the 大臣 to produce a structured draft, fills the manual form, and
  requires an explicit save. Provider failures fall back to a deterministic
  local draft rather than blocking the user.
- Product IA: expose only two top-level preference paths to reduce beginner
  confusion: `新手引导` and `手动进阶`. Manual advanced editing may still group
  basic allocation, recommendation rules, and advanced factors internally.
- `新手引导` is the primary beginner path and must walk through the full
  Preference Factors V2 surface. It should produce a complete deterministic
  draft first, then let AI 大臣 refine the structured factors when provider
  access is available. The user must still review and apply the final draft.

V2.1 coverage vs V3 backlog:

| Area | V2.1 behavior | V3 upgrade |
| ---- | ------------- | ---------- |
| Sector/style tilts | Light boost/penalty for known static candidates | Dynamic candidate universe, sector exposure caps, style factor attribution |
| Life goals | Home goal adds risk-buffer penalty to equity candidates | Goal buckets, timeline-aware cash/FHSA/down-payment planning |
| Tax strategy | Still mostly existing account-type matrix | Real province/tax bracket/withholding/taxable turnover model |
| External info | Visible overlay from cached analysis runs; not a hidden scoring override | Cached news/filings/fundamentals/sentiment overlay with calibrated source freshness |
| Candidate universe | Static curated ETF list plus manual candidate scoring | Verified identity universe from search/watchlist/holdings/provider metadata |
| Validation | Unit tests for constraints and preference scoring direction | Backtests, scenario tests, stale-data checks, confidence calibration |

Current bridge implementation:

- AI quick-scan results consume cached quote lineage, security price history,
  and portfolio snapshot metadata when available.
- Recommendation mobile view surfaces cached AI/market-data analysis as
  `Loo国今日秘闻` so users can see relevant context before acting on a recommendation.
- Recommendation priority cards can now show `相关秘闻` references from cached
  analysis runs. The bridge uses canonical identity first: exact `security_id`
  matches are `当前上市版本情报`, exact `symbol + exchange + currency` is the strict
  fallback for older records, and unresolved ticker-only matches are downgraded
  to `底层资产情报`. The latter can explain company/fund context, but quote, FX,
  and freshness data still belong to the current listing only.
- Mobile labels this layer as `V3 Overlay / V2.1 Core` when cached intelligence
  exists. This is intentionally honest: V3 evidence is surfaced and linked, but
  deterministic V2.1 still owns target-allocation/account/tax execution.
- Each priority now carries a V3 overlay DTO:
  - `baselineScore`: V2.1 security/account/tax baseline
  - `preferenceFitScore`: Preference Factors V2 contribution
  - `externalInsightScore`: cached analysis/external-intelligence contribution
  - `finalScore`: transparent weighted result
  - `signals` and `riskFlags`: user-visible explanation of what changed
- Current V3 weighting is intentionally conservative: 70% V2.1 deterministic
  baseline, 15% Preference Factors V2, and 15% cached intelligence. This
  prevents a stale or shallow external signal from overpowering saved allocation
  and account rules.
- Recommendation cards now expose `偏好契合` and named `进阶偏好因子` impacts so
  Preference Factors V2 can be verified from the result page, not only from
  Settings.
- Recommendation priority cards expose a `查看标的详情` entry. New V2.1 runs carry
  the lead security's trading currency into mobile detail navigation; older
  runs without currency remain navigable but should be treated as unresolved
  listing context until detail resolution returns canonical identity.
- This bridge is deliberately an overlay, not a hidden scoring override.
  Deterministic V2.1 allocation/account/tax scoring remains the execution
  baseline until V3 has calibrated source quality, TTL, and stale-data tests.
- Live news/forum/institutional adapters remain disabled on page load. Any future
  provider must run through the worker/cache/TTL boundary first.

New factor groups:

#### Risk and behavior

- risk capacity vs risk tolerance
- max drawdown comfort
- volatility comfort
- concentration tolerance
- leverage / options / crypto permission
- transition speed from current holdings

#### Sector and style tilts

- preferred sectors: technology, energy, financials, healthcare, industrials
- avoided sectors
- growth vs value tilt
- dividend preference
- quality / profitability preference
- small-cap tolerance
- thematic interests

#### Life goals

- home purchase horizon
- house down-payment target
- emergency fund target
- expected large expenses
- immigration / tax residency uncertainty
- retirement horizon

#### Tax and account strategy

- province
- marginal tax bracket range
- RRSP deduction priority
- TFSA growth preference
- FHSA home-goal priority
- taxable-account tax sensitivity
- USD funding path
- dividend withholding-tax sensitivity

#### Cash and liquidity

- monthly contribution capacity
- required cash buffer
- minimum trade size
- liquidity needs by timeframe
- willingness to hold cash during uncertainty

#### External-info preference

- allow news impact in recommendations
- allow analyst / institutional signals
- allow community sentiment as low-confidence signal
- preferred cache freshness
- maximum daily external calls / cost guardrail

## Architecture

Do not let mobile pages or the AI provider directly run arbitrary web search.

Use this pipeline:

1. Provider adapters fetch structured external documents.
2. Worker deduplicates, scores relevance, and writes cached records.
3. Analyzer normalizes those records into `portfolio_analysis_runs`.
4. Recommendation V3 reads V2.1 Core candidates plus cached external evidence.
5. Loo国大臣 answers using page context plus saved analysis references.

Suggested tables:

- `external_research_documents`
- `external_research_document_links`
- `recommendation_external_signals`
- `daily_intelligence_items`
- `preference_factor_profile`

Current structured document boundary:

- `lib/backend/external-research-documents.ts` defines the first source-agnostic
  external research document contract.
- `external_research_documents` is now backed by DB persistence. Successful
  external research worker runs can upsert provider documents by
  `user_id + provider_id + provider_document_id`.
- Every future adapter must normalize into this shape before Recommendation V3
  reads it:
  - source type: market-data / news / forum / institutional / manual
  - identity: `security_id` or complete `symbol + exchange + currency`, with
    optional `underlying_id` for company/fund-level context
  - freshness: `publishedAt`, `capturedAt`, `expiresAt`
  - scoring inputs: confidence, sentiment, relevance, source reliability
  - user-visible content: title, summary, key points, risk flags, source URL
- The ranking layer intentionally separates `listing`, `underlying`, `macro`,
  and `unresolved` scopes. Ticker-only documents are unresolved and cannot be
  used as listing-level evidence.
- The current cached market-data provider emits a structured market-data
  document for the exact listing request. The worker persists that document
  alongside the saved analysis run.
- Mobile Recommendations now reads fresh `external_research_documents` directly
  and merges them with saved analysis runs for `Loo国今日秘闻` / V3 overlay
  matching. This keeps the recommendation bridge usable even when the analysis
  run is only a compact report and the richer source document needs to remain
  queryable.
- `GET /api/mobile/intelligence/daily` now exposes the same curated daily
  intelligence feed as a standalone mobile contract. Overview, Security Detail,
  and AI 大臣 can reuse it without duplicating document/run mapping logic.
- Flutter Overview and Security Detail consume the standalone feed through a
  shared mobile DTO/card. Overview keeps the full daily briefing card.
  Recommendations no longer loads this feed or displays a duplicate card; it
  only shows whether cached external materials are already reflected in the
  recommendation DTO and keeps `相关秘闻` evidence on priority cards. Portfolio
  no longer loads the feed to avoid duplication. Security Detail filters the
  feed by exact `securityId` or complete `symbol + exchange + currency`;
  ticker-only matches are intentionally excluded. This is still read-only cache
  display: loading any page must not trigger live news, forum, or paid external
  API calls.
- AI 大臣 now automatically enriches every answer request with the same daily
  intelligence feed on the backend. Flutter pages do not need to inject the
  feed manually; the minister receives up to three `external-intelligence`
  facts, preferring the current `symbol + exchange + currency` listing when the
  page has a resolved security subject.
- Recommendation V3 overlay now reads document evidence fields when available:
  `confidence`, `relevanceScore`, `sourceReliability`, and `riskFlags`. Saved
  analysis runs without those fields still use the conservative source/scope/
  freshness heuristic.

## Source Strategy

Recommended order:

1. Company announcements / filings / earnings-calendar style APIs.
2. Financial news APIs with ticker filters.
3. ETF/fundamental/institutional data.
4. Community/forum sentiment.
5. General search only as a fallback, through a structured search API, not raw
   Google scraping.

TTL policy:

- market data: 30 minutes to 24 hours depending on source
- news: 6-24 hours
- filings/announcements: 7+ days or immutable snapshots
- community sentiment: 12-24 hours
- AI summaries: 6-24 hours

## Recommendation Scoring Guidance

External information should mostly affect:

- candidate order inside an already-needed sleeve
- caution labels
- `why now` / `why wait`
- confidence
- risk notes

External information should not:

- create an allocation target by itself
- bypass account/tax constraints
- override excluded identities
- treat forum sentiment as fact
- cause frequent trading by default

Example V3 score:

```text
finalScore =
  45% allocation/account/tax baseline
  20% preference factor fit
  15% current holding/concentration fit
  10% external evidence quality
  10% market-data freshness / risk flags
```

The exact weights should be user-configurable later, but the initial version can
use transparent defaults and show the score components.

## My Product Opinion

The user is right that the current preference model is too shallow.

However, external news should not become the main recommendation driver. The
core engine should still answer:

- What does the portfolio need?
- Which account should receive new money?
- Which security expresses that sleeve cleanly?
- What tax/FX/cash constraints matter?

External information should answer:

- Is there a recent reason to be more cautious?
- Is the candidate temporarily less attractive due to stale data or risk flags?
- Are there fresh catalysts worth reading before buying?
- Is this recommendation still consistent with the user's preferred sector/style
  tilts and life goals?

For this project, the best differentiator is not a generic news feed. It is a
personalized decision layer that connects:

- user's real holdings
- target allocation
- account types
- tax/FHSA/RRSP/TFSA context
- cash/home goals
- saved watchlist
- curated external context
- AI explanation in Loo国 tone

## Implementation Order

P0.5:

1. Complete: current cached market-data / provider status foundation.
2. Complete: docs and contract for Recommendation V3 external signals.
3. Complete: Preference Factors V2 backend schema as optional fields with safe
   defaults.
4. Complete for cached market-data: local-only `今日秘闻` surface from cached provider/portfolio
   signals before live news adapters. A standalone mobile API now backs the
   curated feed, and Flutter Overview/Recommendations/Security Detail have a
   first-pass shared card consuming it. Recommendations uses a collapsed summary
   surface; Portfolio intentionally does not load it; Security Detail uses
   strict listing-identity filtering.
5. Complete for cached market-data: identity-safe external research provider. Cached market-data
   research now requires `security_id` or complete `symbol + exchange +
   currency`; ticker-only fallback is intentionally skipped.
6. Complete: cached market-data provider results are persisted as structured
   external research documents and consumed by Recommendation V3 overlay.
7. Complete: AI 大臣 backend prompt/context enrichment consumes the standalone
   `今日秘闻` feed as `external-intelligence` facts without triggering live
   research.
8. Complete for profile document consumption: Alpha Vantage profile documents
   map to institutional `今日秘闻` cards, Recommendation V3 can score them as
   cached external evidence, and 大臣 can cite matching profile intelligence by
   complete `security_id` / `symbol + exchange + currency`.

P1:

1. Add first structured news/announcement adapter behind worker/cache flags.
2. Deepen V3 scoring calibration with more source types, backtests, and
   source-specific stale-data rules. The first document-evidence scoring bridge
   is implemented for cached market-data documents.
3. Add deeper guided preference questions for sector/style/life/tax factors.
4. Expand the shared `今日秘闻` card from Security Detail to account/holding
   detail pages where it improves decision context without cluttering the
   primary workflow.

P2:

1. Add institutional/fundamentals source.
2. Add community sentiment with low-confidence labels.
3. Add cost dashboard and per-source opt-in controls.

## Recommendation V4 Candidate Pool Status

Current implementation status:

1. Complete: CandidateProvider pipeline now builds a raw pool from the curated
   core universe, watchlist identities, recent observations, and DB-backed
   dynamic candidates.
2. Complete: CandidatePoolPolicy runs before account/security scoring. It
   supports role inclusion/exclusion, minimum confidence/liquidity, and explicit
   no-silent-fallback behavior.
3. Complete: strict fallback semantics. If rules empty the pool, the engine
   returns a policy-relaxation state instead of forcing a default ETF. A relaxed
   core-pool fallback only runs when the user enabled it in settings and taps the
   fallback action.
4. Complete: pool evaluation snapshots persist on recommendation runs. Mobile
   visibility reads the persisted snapshot first, so later watchlist changes do
   not rewrite the historical explanation.
5. Complete: dynamic pool storage and worker. The
   `/api/workers/recommendation-dynamic-pool/run` endpoint refreshes dynamic
   candidates from clean watchlist/recent-observation identities with TTL and
   confidence metadata. It uses the existing worker secret auth.
6. Complete: Settings exposes user-facing V4 controls without leaking raw env or
   implementation flag names: allowed/excluded candidate roles and manual
   relaxed-core fallback.
7. Complete: mobile recommendations expose raw-pool visibility, rejected
   candidates, dynamic-candidate freshness/confidence, and policy empty states.
8. Complete: mobile copy now treats this as `候选池治理`, not manual result
   editing. Users can manage watchlist/self-selected candidates, preferred
   identities, excluded identities, account placement preferences, asset/security
   type boundaries, role inclusion/exclusion, and explicit relaxed-core fallback.
   These settings only decide what can enter the raw/eligible pool; the final
   `Loo皇推荐` remains owned by the deterministic rules engine and cannot be
   manually forced.

Design constraints:

- Watchlist can enter the raw pool, but it is not automatically recommended.
  It must have clean identity and pass CandidatePoolPolicy.
- Recent observations can enter the raw pool for visibility/review, then policy
  decides whether they are eligible.
- Dynamic candidates are acceleration/cache records, not the source of truth.
  Their TTL prevents stale watched symbols from silently living in the pool.
- Raw pool and recommendation pool are visible to the user at a product level:
  source counts, policy status, and rejected reasons are shown; implementation
  fields stay hidden.
- User editing boundary: the app may let users add or remove candidate inputs
  and constraints, but it must not let users directly pin an item into final
  recommendations. Exclusions are hard boundaries; preferences are scoring
  weights. Any fallback must stay explicit and user-triggered.

## Recommendation V4 QA Checklist

Before signing off the V4 recommendation flow, test these paths on the mobile
URL:

1. Baseline generation:
   - Open `进货`.
   - Recalculate with CAD 500 / 2500 / custom amount.
   - Expected: `Loo皇推荐` changes only from deterministic inputs; no silent
     default ETF is inserted when the pool is empty.
2. Watchlist visibility:
   - Add a clean listing identity to `囤货清单`.
   - Reopen `进货`.
   - Expected: the symbol appears in raw-pool transparency. It is recommended
     only if it passes identity/data/policy rules.
3. Recent observation persistence:
   - Open a symbol from `搜货台` or Security Detail.
   - Return to `进货`.
   - Expected: `近期观察` is visible even when empty, and newly opened symbols
     appear after the observation API succeeds.
4. Candidate role rules:
   - Settings -> investment preferences -> recommendation constraints.
   - Exclude `现金停泊`, then regenerate.
   - Expected: routine cash candidates disappear unless the cash sleeve itself
     is the target gap.
5. Empty-pool behavior:
   - Make rules intentionally strict enough to empty the pool.
   - Expected: the page shows a policy-relaxation state and does not auto-force
     a default candidate.
6. Explicit fallback:
   - Enable relaxed core fallback in Settings.
   - Trigger fallback from the empty-pool state.
   - Expected: a separate run is created using relaxed core candidates, and the
     action is user-initiated.
7. Dynamic pool worker:
   - Call `/api/workers/recommendation-dynamic-pool/run` with worker auth.
   - Expected: clean watchlist/recent-observation identities refresh into the DB
     dynamic candidate table with TTL/confidence metadata.
