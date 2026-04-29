# Mobile Chart Contracts

Last updated: 2026-04-29

## Purpose

Mobile charts should be driven by explicit backend contracts, not by parsing
formatted display strings or by inventing placeholder curves in Flutter.

This matters because the portfolio can hold US common shares, CAD-listed
versions, CDRs, CAD-hedged ETFs, and manual/special holdings with overlapping
tickers. Chart data must preserve security identity whenever that identity is
available.

## Current State

- Flutter has reusable chart primitives:
  - `LooLineChart`
  - `LooDistributionBar`
  - `LooRadarChart`
- Security Detail already renders a first-pass performance line chart.
- Some backend series still fall back to reference curves when real replay data
  is shallow.
- `security_price_history` now stores `symbol + exchange + currency + date`.
  This is the chart/history identity boundary for preventing US common shares,
  CAD-listed versions, CDRs, and hedged listings from sharing one ticker-only
  history series.
- Portfolio quote refresh now writes one daily `security_price_history` point
  per refreshed `symbol + exchange + currency`, and records/updates the
  current-day portfolio snapshot through the existing recalculation path.
- Overview and Portfolio value charts append/replace today's point from the
  current state-table total, so the chart's latest point must match the visible
  total asset / portfolio value card even when older exchange-aware history is
  incomplete.

## Contract Rule

Every mobile chart payload should separate:

- `displayLabel`: short label for the UI
- `rawDate`: ISO date when the point is time-based
- `value`: raw numeric value for plotting
- `displayValue`: formatted string for labels/tooltips
- `currency`: when the value is money-like
- `sourceMode`: `local | cached-external | live-external`
- `freshness`: explicit status for whether the chart is fresh, stale, or a
  fallback/reference curve
- `identity`: when the chart is security-specific
  - `symbol`
  - `exchange`
  - `currency`

Do not build charts by converting strings such as `$12,345` or `+4.2%` back
into numbers.

## Initial Mobile Chart DTO

```ts
interface MobileChartPoint {
  displayLabel: string;
  rawDate?: string;
  value: number;
  displayValue: string;
}

interface MobileChartSeries {
  id: string;
  title: string;
  kind: "line" | "distribution" | "radar";
  valueType: "money" | "percent" | "index" | "score" | "quantity";
  currency?: "CAD" | "USD";
  sourceMode: "local" | "cached-external" | "live-external";
  freshness: {
    status: "fresh" | "stale" | "fallback";
    label: string;
    latestDate: string | null;
    detail: string;
  };
  identity?: {
    symbol: string;
    exchange?: string | null;
    currency?: "CAD" | "USD" | null;
  };
  points: MobileChartPoint[];
  notes: string[];
}
```

## Priority

P0 next chart work:

1. Keep existing legacy `performance` arrays temporarily for backward
   compatibility.
2. Add tests whenever a new chart surface moves to `MobileChartSeries`.
3. Move remaining non-chart historical/performance displays onto typed DTOs only
   when Flutter needs richer interaction than a static list.

P1:

- Tooltip/detail rendering in Flutter.
- Multi-series comparison charts.
- Add exchange/listing identity to `security_price_history` before relying on
  it for symbols where the same ticker can trade in multiple markets with the
  same currency.

P2:

- External/live source annotations.
- Hosted worker refresh for expensive history hydration.
- Data freshness dashboard for stale/fallback chart surfaces.

## Non-Goals

- Do not add paid/live quote history calls from normal page load.
- Do not use ticker-only security history matching once exchange/currency data
  is available.
- Do not show stale or fallback/reference data without an explicit label.
- Do not block current Health/AI work on full chart refactors; migrate one
  endpoint at a time.

## Implemented

- Security Detail now emits `chartSeries.priceHistory`.
- The series includes raw numeric points, display values, source mode, freshness
  status, latest cached date, and `symbol + exchange + currency` identity.
- Flutter Security Detail prefers this DTO and shows the freshness label/detail
  below the line chart. Existing `performance` remains as a fallback.
- Portfolio Overview now emits `chartSeries.portfolioValue`.
- Mobile Overview now emits `chartSeries.netWorth`.
- Flutter Portfolio and Overview pages render these chart DTOs with explicit
  freshness/source labels. If real replay/snapshot history is shallow, the chart
  is labeled as a reference curve instead of being presented as real movement.
- Account Detail now emits `chartSeries.accountValue`.
- Flutter Account Detail renders the account-level series directly below the
  account summary and labels whether it came from local replay, snapshots, or a
  reference fallback.
- Asset Class drilldown items now emit `chartSeries.valueHistory`.
- Flutter Asset Class drilldown pages render the sleeve-level series with the
  same freshness/source labels.
- Holding Detail now emits `chartSeries.holdingValue`.
- Flutter Holding Detail renders the holding-level value series below the
  summary, separate from Security Detail's price chart. This keeps
  position-level value movement distinct from ticker-level price movement.
- Portfolio quote refresh writes refreshed prices into daily history points and
  returns `historyPointCount` plus `snapshotRecorded`, so mobile QA can verify
  that refresh improves future chart freshness instead of only updating the
  current holding rows.
