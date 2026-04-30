# Recommendation V3 External Intelligence Plan

Last updated: 2026-04-30

## Decision

Upgrade toward `Recommendation Engine V3` instead of stretching V2.

V2 remains the deterministic core:

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

## Why Not Just Patch V2

V2 is currently a rule engine. It is good for transparent, stable decisions.

Adding live news, forum sentiment, personal goals, sector tilts, and life-event
planning directly inside V2 would make it harder to test and explain. The safer
structure is:

1. V2 produces baseline candidate recommendations.
2. External-intelligence workers attach cached evidence to candidate identities.
3. V3 reranks / annotates V2 candidates using that evidence and the expanded
   preference profile.
4. Mobile shows both the baseline reason and the external-intelligence impact.

## New Product Surfaces

### 1. Recommendation V3

Goal:

- Show recommendations that combine portfolio drift, account/tax placement,
  and curated external context.

Required behavior:

- Preserve `symbol + exchange + currency` on every candidate.
- Keep V2 baseline score visible.
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

Initial output model:

- `engineVersion: "v3"`
- `baselineV2Score`
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
| External info | Not used in scoring | Cached news/filings/fundamentals/sentiment overlay with source freshness |
| Candidate universe | Static curated ETF list plus manual candidate scoring | Verified identity universe from search/watchlist/holdings/provider metadata |
| Validation | Unit tests for constraints and preference scoring direction | Backtests, scenario tests, stale-data checks, confidence calibration |

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
4. Recommendation V3 reads V2 candidates plus cached external evidence.
5. Loo国大臣 answers using page context plus saved analysis references.

Suggested tables:

- `external_research_documents`
- `external_research_document_links`
- `recommendation_external_signals`
- `daily_intelligence_items`
- `preference_factor_profile`

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

1. Finish current cached market-data / provider status foundation.
2. Add docs and contract for Recommendation V3 external signals.
3. Add Preference Factors V2 backend schema as optional fields with safe
   defaults.
4. Add a local-only `今日秘闻` API that surfaces cached provider/portfolio
   signals before live news adapters.

P1:

1. Add first structured news/announcement adapter behind worker/cache flags.
2. Add V3 recommendation overlay using cached external documents.
3. Add mobile `今日秘闻` card.
4. Add guided preference questions for sector/style/life/tax factors.

P2:

1. Add institutional/fundamentals source.
2. Add community sentiment with low-confidence labels.
3. Add cost dashboard and per-source opt-in controls.
