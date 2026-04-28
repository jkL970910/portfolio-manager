# Mobile Chart Contracts

Last updated: 2026-04-28

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
- `security_price_history` currently stores `symbol + currency`, but not full
  exchange/listing identity. This means CAD-vs-US separation is stronger than
  ticker-only, but still not complete for all future cases.

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

1. Add a backend mapper that can emit `MobileChartSeries` for Security Detail.
2. Keep existing `performance` fields temporarily for backward compatibility.
3. Update Flutter `LooLineChartPoint` parsing to prefer the new chart DTO.
4. Add tests proving `symbol + exchange + currency` survives chart payloads.

P1:

- Account and portfolio value replay chart DTOs.
- Asset-class drilldown chart DTOs.
- Tooltip/detail rendering in Flutter.

P2:

- Multi-series comparison charts.
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
