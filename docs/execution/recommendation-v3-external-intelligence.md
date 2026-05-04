# Recommendation V3 External Intelligence Plan

Last updated: 2026-05-04

## Current Implementation Status

The V3 shape exists, but live external information is not enabled yet.

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
- Partial: `portfolio-analyzer.skill` has been productized as a guarded/cached
  analysis path, but needs more end-to-end QA on real cached data.
- Not completed: live news/forum/announcement provider adapters remain disabled.
  The next P0 task is to QA the profile adapter end-to-end, then add one
  bounded announcement/filing/earnings-calendar style provider. Both must write
  `external_research_documents` through the worker, not from Flutter page load.

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

Recommended sources:

- P1: cached market-data anomalies and quote/provider events
- P1: company announcements / filings / earnings-calendar style records
- P1: selected financial news API summaries
- P2: institutional / ETF holding / fundamentals data
- P2/P3: Reddit/forum/community sentiment as low-confidence color only

Current source policy:

- Active now: persisted external research documents, saved analysis runs, cached
  market-data documents, and opt-in Alpha Vantage profile documents.
- Next P0: one structured announcement / filing / earnings-calendar /
  fundamental-event style adapter.
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
  intelligence feed as a standalone mobile contract. Overview, Portfolio,
  Recommendations, and AI 大臣 can reuse it without duplicating document/run
  mapping logic.
- Flutter Overview, Recommendations, and Security Detail now consume the
  standalone feed through a shared mobile DTO/card. Overview keeps the full daily
  briefing card; Recommendations uses a collapsed summary entry for decision
  context; Portfolio no longer loads the feed to avoid duplication; Security
  Detail filters the feed by exact `securityId` or complete `symbol + exchange +
  currency`; ticker-only matches are intentionally excluded. This is still
  read-only cache display: loading any page must not trigger live news, forum,
  or paid external API calls.
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
