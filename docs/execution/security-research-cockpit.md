# Security Research Cockpit / 估值证据链计划

Last updated: 2026-05-09

## Purpose

Turn single-security research from a generic data report into a decision
workbench that helps a long-term Canadian retail investor answer:

- 这个标的是否值得继续研究？
- 如果值得，适合在什么组合前提下考虑？
- 当前价格/市场环境是否支持现在行动，还是更适合观察？
- 哪些数据不足、组合约束或账户/税务因素会阻止行动？

This is not a short-term trading signal system and not an automated DCF oracle.
The product goal is a transparent, evidence-led research cockpit where the
backend rules engine owns the conclusion and GPT/大臣 explain the reasoning.

## Core Principles

1. `规则引擎给结论，LLM 负责解释`
   - Next.js BFF computes the decision, guardrails, evidence, and action-plan
     boundaries.
   - GPT / AI 大臣 may summarize, explain, and help users ask follow-up
     questions, but must not override deterministic blockers.
2. `Portfolio Fit > Valuation > Entry Timing`
   - A portfolio/account/tax blocker can veto an attractive valuation.
   - Valuation can improve or weaken the case, but cannot ignore user-specific
     risk and concentration constraints.
   - Entry timing only refines “how/when to consider”, not “must buy”.
3. `Evidence chain, not black-box DCF`
   - Automated DCF is fragile and sensitive to assumptions.
   - MVP should use a valuation evidence layer with confidence, sanity checks,
     and clear limitations.
4. `ETF and stocks need different logic`
   - Stocks can use valuation evidence such as multiples, analyst consensus,
     cash-flow anchors, and historical percentile when provider data exists.
   - ETFs should use an `etf_macro_proxy` path: macro water level, index
     valuation context, expense/tracking/asset allocation, DCA, and rebalancing.
5. `No fabricated data`
   - If a provider lacks a value, omit it or mark it unavailable.
   - Do not invent FCF, analyst targets, support zones, or macro scores.

## High-Level Architecture

```text
Flutter Security Detail / Loo国研究台
  -> app/api/mobile/analysis/quick-scan
  -> buildSecurityResearchContext(userId, securityId)
       - security identity
       - quote/history/freshness
       - portfolio exposure/account/tax context
       - preference factors
       - valuation evidence cache
       - macro/ETF proxy cache
       - entry timing key levels
  -> evaluateSecurityResearchDecision(ctx)
       - hard blockers
       - business diagnostics
       - portfolio fit
       - valuation evidence
       - entry timing
       - action-plan orchestration
  -> GPT enhancement / Minister explanation, user-triggered only
```

All IO belongs in the route/service context builder. The evaluator should stay
pure and testable with fixture JSON.

## Proposed DTO

```ts
type SecurityResearchDecision = {
  version: "security-research-v1";
  generatedAt: string;
  security: {
    securityId: string;
    symbol: string;
    exchange: string;
    currency: string;
    name: string;
    assetType: "stock" | "etf" | "fund" | "cash" | "other";
    identityStatus: "resolved" | "ambiguous" | "missing";
  };
  decision: {
    label:
      | "适合继续研究"
      | "继续持有观察"
      | "保持观察"
      | "暂不适合"
      | "需要补充数据";
    confidenceScore: number;
    primaryReason: string;
    vetoedBy?: Array<"identity" | "freshness" | "portfolio_fit" | "account_tax" | "liquidity">;
  };
  guardrails: Array<{
    id: string;
    severity: "info" | "warning" | "blocker";
    title: string;
    detail: string;
  }>;
  portfolioFit: {
    score: number;
    sleeve: string;
    targetGapLabel: string;
    currentExposureLabel: string;
    duplicateExposureLabel?: string;
    accountTaxFitLabel?: string;
    liquidityFitLabel?: string;
  };
  valuationEvidence: {
    method:
      | "multiples_evidence"
      | "analyst_consensus"
      | "dcf_reference"
      | "etf_macro_proxy"
      | "unavailable";
    confidence: "low" | "medium" | "high";
    summary: string;
    anchors: Array<{
      label: string;
      value: string;
      source: string;
      asOf?: string;
    }>;
    sanityChecks: Array<{
      label: string;
      status: "pass" | "watch" | "fail" | "unavailable";
      detail: string;
    }>;
  };
  entryTiming: {
    posture: "consider_now" | "wait_for_pullback" | "wait_for_confirmation" | "not_applicable";
    keyLevels: Array<{
      label: string;
      value: string;
      type: "MA200" | "52W_HIGH" | "52W_LOW" | "RECENT_HIGH" | "RECENT_LOW" | "VALUATION_ANCHOR";
      source: string;
    }>;
    marketPulseLabel?: string;
  };
  actionPlans: Array<{
    type: "watch_only" | "dca_accumulate" | "value_pullback" | "breakout_confirmed" | "avoid";
    title: string;
    detail: string;
    isBlockedByPortfolioFit: boolean;
    requiredConfirmations: string[];
  }>;
  evidence: Array<{
    source: string;
    sourceType: "quote" | "history" | "fundamental" | "macro" | "portfolio" | "preference" | "external_research";
    freshnessLabel: string;
    reliabilityLabel: string;
  }>;
};
```

## P0 / P1 Split

### P0.10 Security Research Cockpit Plan Lock

Status: completed / implementation started.

P0.10 is not a large implementation slice. Its job is to lock the product and
architecture boundaries before coding the next feature:

- Decision wording stays compliance-safe: no direct `buy/sell` command.
- The backend owns deterministic conclusions and guardrails.
- GPT/大臣 remains explanation-only.
- Valuation becomes evidence with confidence, not a standalone oracle.
- ETF logic uses macro/rebalancing/DCA framing instead of stock DCF.
- The evaluator uses pure functions; IO is isolated in the BFF context builder.

### P1 Implementation Slices

1. `P1.1 SecurityResearchDecision DTO + fixtures`
   - Status: first pass implemented on 2026-05-09.
   - Add backend contract and tests.
   - Keep existing quick-scan contract populated for mobile compatibility.
   - Add stock, ETF, missing-data, and portfolio-blocker fixtures.
   - Current implementation adds optional `securityResearchDecision` to
     analyzer results while preserving legacy `securityDecision`, `summary`,
     `scorecards`, `portfolioFit`, and `actionItems`.
   - Current quick scan emits stock vs ETF asset type, identity status,
     portfolio-fit labels, valuation evidence placeholder/proxy, entry key
     levels from cached history, action plans, and evidence rows.
2. `P1.2 Valuation Evidence MVP`
   - Status: first pass implemented on 2026-05-09.
   - Starts with the existing cached `alpha-vantage-profile` external-research
     document path instead of page-load live calls.
   - Stock candidates can now surface cached valuation anchors such as
     analyst target, P/E, forward P/E, PEG, P/B, 52-week range, dividend yield,
     market cap, and beta when the provider cache contains them.
   - ETF/fund candidates keep the `etf_macro_proxy` path and use profile
     anchors such as expense ratio, yield, and 52-week range without claiming a
     single-company intrinsic value.
   - Quick-scan cache invalidation now treats newer external-research documents
     like newer market data, so fresh evidence can trigger recomputation.
   - Legacy quick-scan fields remain populated for mobile compatibility.
   - Still not implemented: full historical multiple percentile, multi-provider
     sanity checks, and any automated DCF default.
   - Prefer stable evidence: analyst consensus, current multiples, historical
     multiple percentile, and provider freshness where available.
   - Do not implement full automated DCF as the default path.
3. `P1.2a Valuation Evidence Cache`
   - Persist provider evidence with TTL, source, as-of, reliability, and
     provider usage records.
   - Page load must read cached evidence only.
4. `P1.2b ETF Macro Proxy`
   - Status: first pass implemented on 2026-05-09.
   - For ETFs, expose macro water level, expense/tracking/asset-class context,
     and DCA/rebalancing framing.
   - Do not output fake intrinsic price ranges for ETFs.
   - Current implementation combines cached ETF/fund profile anchors, target
     allocation gap, and cached market pulse (`FGI/VIX/strategyLabel`) into an
     ETF-specific macro proxy. It can distinguish DCA/fear-driven accumulation,
     wait-for-pullback, neutral DCA, and rebalance-watch framing without
     creating a fake single-security target price.
5. `P1.3 Entry Timing Key Levels`
   - Use simple, durable levels: MA200/MA250, 52-week high/low, recent high/low,
     and valuation anchors.
   - Avoid complex support/resistance/FVG algorithms in MVP.
6. `P1.4 Action Plan Orchestrator`
   - Apply priority: Portfolio Fit > Valuation > Entry Timing.
   - Convert evidence into watch/DCA/pullback/confirmation/avoid plans.
   - Mark plans blocked by portfolio fit instead of hiding them.
7. `P1.5 Flutter Research Cockpit UI`
   - Render verdict, veto/guardrails, valuation evidence, key levels, action
     plans, evidence freshness, and optional GPT explanation.
   - Keep the first fold compact and decision-first.
8. `P1.6 Minister / Quick Scan Integration`
   - 大臣 can explain the current research decision and answer follow-up
     questions using cached context.
   - 大臣 can propose running/refreshing analysis, but user confirmation is
     required for costful actions.

## Provider Strategy

MVP should use a single primary provider path first, then add cross-provider
validation only after the closed loop works.

Recommended order:

1. Reuse existing Alpha Vantage / Twelve Data / Yahoo-compatible evidence where
   already configured.
2. Cache all provider output in backend tables with TTL and source lineage.
3. Add manual refresh only behind explicit user action and quota.
4. Add multi-provider sanity checks later for fields that materially change the
   decision.

Rationale:

- Multi-provider orchestration before DTO stability creates slow, fragile code.
- A single provider + cache is enough to validate UX and evidence rendering.
- The decision engine can already express `unavailable` or `low confidence`
  without fabricating a conclusion.

## QA Expectations

Add manual QA after P1.1/P1.2:

- Held stock with resolved identity.
- Unheld stock candidate with `0%` current exposure.
- ETF candidate using `etf_macro_proxy`.
- Missing/ambiguous identity must return `需要补充数据`.
- Stale valuation evidence must reduce confidence or mark unavailable.
- Portfolio overexposure must veto attractive valuation.
- GPT enhancement must explain the backend decision without changing it.
