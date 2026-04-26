# Portfolio Manager BRD Gap Analysis

> [!IMPORTANT]
> As of 2026-04-25, this project is now Flutter-first, mobile-first, Chinese-only, and Loo皇-themed. When this document conflicts with `docs/execution/flutter-mobile-migration-plan.md`, follow the migration plan first.


## Overall Assessment

The BRD has a clear product idea: this is not a generic personal finance app, but a portfolio decision platform for a Canadian self-directed investor. That positioning is strong. The current draft is also good at naming core modules and user-visible outputs.

The main gap is that the document is still closer to a feature inventory than a decision-driving product strategy. It explains what the product may include, but it does not yet make enough hard choices about target segment, strategic trade-offs, success metrics, defensibility, compliance boundaries, and MVP sequencing.

The biggest strategic risk is scope spread. The draft tries to cover a large part of Monarch, portfolio analytics, recommendation logic, watchlists, and spending analysis in one MVP. That makes it harder to ship the differentiated part of the product quickly.

## What Is Working Well

- The product has a sharp core question: where should new capital be allocated?
- The primary user is concrete enough to start with: Canada-based investor using Wealthsimple with ETF core plus selected stocks.
- The platform concept is differentiated from expense-first finance apps.
- Core modules are understandable and map to clear user jobs.
- The document already separates MVP, P1, and P2 at a high level.

## Product Strategy Canvas Gaps

### 1. Vision

Current state:
- The vision is directionally clear: centralized wealth decision support.

Missing:
- A stronger aspirational statement for what changes for the user.
- Product values and operating principles.
- A clearer statement of what the product is optimizing for: clarity, confidence, discipline, or return improvement.

Recommended improvement:
- Reframe the vision around helping an investor make better capital allocation decisions with less manual analysis and less portfolio drift.

### 2. Market Segments

Current state:
- One initial user profile is defined.

Missing:
- Jobs to Be Done framing.
- Why this segment is the first wedge.
- Explicit exclusion of other segments.
- Segment constraints such as account structure, tax rules, manual workflows, and risk tolerance.

Recommended improvement:
- Define the first segment as self-directed Canadian retail investors with multiple investment accounts who already know what they own, but struggle to decide where new money should go.

### 3. Relative Costs

Current state:
- No cost position is defined.

Missing:
- Whether the product competes on simplicity and focus or on broad platform coverage.
- Build versus buy choices for data aggregation, classification, pricing data, and recommendation logic.

Recommended improvement:
- Optimize for focused, high-value decision support rather than broad finance platform breadth. Use low-integration, import-first workflows early to reduce complexity.

### 4. Value Proposition

Current state:
- The draft lists product value at a high level.

Missing:
- Explicit before / how / after framing.
- Alternatives users rely on today.
- Why the recommendation engine is meaningfully better than spreadsheets, broker dashboards, or manual thinking.

Recommended improvement:
- Define the user journey like this:
  - Before: portfolio data is fragmented and next-step decisions are vague.
  - How: the platform consolidates holdings, diagnoses drift, and recommends where new money should go.
  - After: the user has a ranked action plan with account and ticker guidance.
  - Alternatives: Wealthsimple dashboards, spreadsheets, Monarch, and manual portfolio review.

### 5. Trade-offs

Current state:
- Some out-of-scope items are listed.

Missing:
- Hard product trade-offs inside the in-scope list.
- A clear statement that the MVP is not trying to replace all of Monarch.

Recommended improvement:
- Remove or demote broad expense tracking in MVP.
- Focus MVP on import, visibility, diagnostics, and funding guidance.
- Keep "70% of Monarch functionality" out of MVP success criteria. It pulls the product toward parity instead of differentiation.

### 6. Key Metrics

Current state:
- Success criteria are outcome-shaped but too vague.

Missing:
- North Star Metric.
- One Metric That Matters for the first quarter.
- Behavioral success metrics tied to the recommendation engine.

Recommended improvement:
- North Star Metric: number of monthly capital allocation decisions supported by the platform.
- OMTM: percentage of active users who import data and receive an actionable funding recommendation in one session.

### 7. Growth

Current state:
- Growth model is not defined.

Missing:
- Distribution channel assumptions.
- Whether this is initially a personal tool, niche community tool, or commercial SaaS.
- How the product gets repeated use rather than one-time setup.

Recommended improvement:
- For now, assume a product-led workflow focused on repeated monthly or biweekly contribution decisions.
- Build habit loops around portfolio review, new cash deployment, and drift alerts.

### 8. Capabilities

Current state:
- Modules are listed, but capabilities are not.

Missing:
- Data ingestion capability plan.
- Rule engine or recommendation logic design.
- Compliance-aware language for investment guidance.
- Tax and account rule support for Canadian account types.

Recommended improvement:
- Call out these required capabilities:
  - import and normalize holdings data
  - compute exposure and concentration metrics
  - apply rule-based recommendation logic
  - store user preferences and target allocation
  - present guidance as decision support, not regulated advice

### 9. Defensibility

Current state:
- Defensibility is not addressed.

Missing:
- Why a user stays after first use.
- What becomes harder to replace over time.
- Whether the moat is workflow, personalization, historical data, or trust.

Recommended improvement:
- Early defensibility should come from personalized allocation logic, account-aware guidance, saved preferences, historical portfolio context, and workflow integration into the user's monthly investing habit.

## Major BRD Gaps To Fix Before Development

### Gap 1: MVP scope is too broad

Why it matters:
- Trying to replace a large portion of Monarch while also building differentiated portfolio intelligence will slow delivery and blur the product's identity.

Fix:
- Make the recommendation engine the center of the MVP.
- Reduce spending analysis to a light support feature or postpone it.

### Gap 2: Recommendation engine is underspecified

Why it matters:
- This is the core differentiator, but the BRD does not define input signals, decision logic, constraints, or output quality expectations.

Fix:
- Specify what data the engine uses, what rules it applies, how it explains decisions, and what confidence means.

### Gap 3: Compliance boundary is missing

Why it matters:
- "Investment guidance" can become a legal and trust issue if the product appears to give personalized regulated advice.

Fix:
- Define the product as decision support and portfolio alignment assistance.
- Add a clear disclaimer and rule-based explanation model.

### Gap 4: Metrics are not operational

Why it matters:
- The current success statements are hard to measure and will not guide iteration.

Fix:
- Add product activation, repeat usage, and recommendation usefulness metrics.

### Gap 5: Data acquisition path is unclear

Why it matters:
- Without a practical import path, the product cannot produce value.

Fix:
- Start with manual and CSV import for Wealthsimple and standardized holdings entry.

## Critical Hypotheses

These must be true for the product to work:

1. Users care more about "where should I put new money?" than full personal finance parity.
2. Users are willing to manually import or maintain data if the recommendation value is strong enough.
3. Rule-based guidance is good enough for early trust before advanced optimization exists.
4. A Canada-first account-aware experience is valuable enough to feel different from generic tools.
5. Portfolio diagnostics plus actionable next steps creates recurring usage.

## Low-Effort Validation Experiments

1. Prototype a recommendation report from a sample CSV portfolio and see whether the output changes user confidence or action.
2. Test a manual workflow with 3 to 5 investors using a spreadsheet input and a static rules engine.
3. Ask users to rank value among these outcomes:
   - unified net worth
   - exposure analysis
   - contribution recommendation
   - expense tracking
4. Validate whether users will maintain watchlist targets and portfolio preferences over time.

## Recommended Strategic Reframe

Use this sharper product framing:

> Portfolio Manager helps self-directed Canadian investors decide where new money should go by turning fragmented account data into a clear portfolio diagnosis and an actionable funding plan.

This framing makes the product easier to build, easier to explain, and easier to prioritize.

## Recommended Next Document Changes

1. Replace the "70% of Monarch functionality" goal with a narrower MVP objective.
2. Move spending analysis from core MVP to optional support scope.
3. Add a dedicated section for recommendation engine logic.
4. Add explicit success metrics, hypotheses, and compliance boundaries.
5. Define the first target segment using Jobs to Be Done and constraints.
6. Add MVP trade-offs: what will not be built in version one.

## Conclusion

The BRD has a strong core insight and a usable first user profile. The next step is not more breadth. The next step is sharper focus around the decision workflow: import data, diagnose the portfolio, recommend where new money should go, and explain why.
