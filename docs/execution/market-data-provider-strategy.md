# Market Data Provider Strategy

## Goal

Add a stable market-data layer that supports:

- security search during import and manual holding entry
- symbol normalization to reduce typos and duplicate securities
- latest-available quotes for gain/loss calculations
- future recommendation-engine upgrades that depend on price and security metadata

## Recommended runtime architecture

Do not couple the app directly to one external provider in page code or business logic.

Use a provider adapter layer:

- `searchSecurities(query)`
- `resolveSecurity(symbol)`
- `getSecurityQuote(symbol)`
- `getBatchSecurityQuotes(symbols)`

All UI and recommendation logic should call this internal layer instead of calling vendor APIs directly.

## Provider selection

### OpenFIGI

Use for:

- security normalization
- identifier mapping
- reducing symbol/name ambiguity

Do not use as the primary quote provider.

### Twelve Data

Use for:

- symbol search / autocomplete
- USD-listed latest-available quote lookup
- future batch quotes and streaming extensions

This remains useful for US-listed securities and broad search, but it is no longer the only quote path. Canadian CAD CDR / CAD-listed wrapper quotes must not fall back to a bare US ticker because that can silently overwrite CAD positions with USD primary-listing prices.

### Yahoo Finance unofficial

Use for:

- CAD-listed quote lookup for the current personal portfolio workflow
- Cboe Canada / NEO CDR symbols such as `NVDA.NE`, `META.NE`, `MSFT.NE`, `NFLX.NE`, and `AVGO.NE`
- TSX-listed Canadian ETFs and stocks through `.TO` symbols

This is an unofficial provider and has no SLA. The app must cache aggressively, validate returned currency, and keep the previous usable price when the provider fails or rate-limits.

### Alpha Vantage

Keep as an optional fallback path for future autocomplete or lightweight lookup work.

It is not the primary recommendation for the app's main runtime data plane.

### OpenBB

Do not use OpenBB as the primary runtime data provider for the product UI.

OpenBB is better treated as a future research and agent-facing aggregation layer, not the first external dependency for core product runtime features.

## Current implementation

The project now includes:

- `GET /api/market-data/search?query=...`
- `GET /api/market-data/resolve?symbol=...`
- `GET /api/market-data/quote?symbol=...`
- `GET /api/market-data/quotes?symbols=...`

The implementation includes an in-process TTL cache to reduce provider usage during local development and single-instance deployments.

Default cache policy:

- search: 6 hours
- normalization: 7 days
- quote: 30 minutes

If a provider call fails after a cached value exists, the service can return stale cached data instead of failing immediately.

Current provider routing:

- search -> Twelve Data
- normalization -> OpenFIGI
- USD quote -> Twelve Data first, with Yahoo Finance as a lightweight fallback
- CAD quote with `NEO` / Cboe Canada -> Yahoo Finance using `.NE`
- CAD quote with `TSX` -> Yahoo Finance using `.TO`
- CAD quote with `TSXV` -> Yahoo Finance using `.V`
- `Other / Manual` quote -> no automatic provider lookup

If keys are missing, the layer returns safe fallback payloads instead of crashing the app.

Quote identity is now explicit:

- `symbol + exchange + currency` is the quote identity used by refresh flows.
- CAD positions must stay CAD-native at the holding row.
- USD positions must stay USD-native at the holding row.
- CAD conversion happens at aggregation / display time, not by changing a holding's native quote currency.
- A provider response whose currency does not match the requested holding currency is rejected.
- Physical assets such as manually tracked gold should be marked `Other / Manual` so a stock ticker collision cannot overwrite them.

## Current product usage

Market-data is already wired into:

- guided manual holding entry
  - search
  - normalization
  - single-symbol quote lookup
- direct CSV import review
  - symbol audit
  - correction review
- portfolio
  - batch price refresh
  - freshness / coverage display
- dashboard
  - top holdings latest-price and freshness display

## Required environment variables

- `OPENFIGI_API_KEY`
- `TWELVE_DATA_API_KEY`
- `ALPHA_VANTAGE_API_KEY` (optional, not used in the first adapter)
- `MARKET_DATA_SEARCH_CACHE_TTL_SECONDS`
- `MARKET_DATA_RESOLVE_CACHE_TTL_SECONDS`
- `MARKET_DATA_QUOTE_CACHE_TTL_SECONDS`

## Next steps

1. add a persisted quote-provider status / stale-age field so rows can explain whether a price is fresh, stale, or manual
2. validate EODHD and Financial Modeling Prep as optional official fallbacks for Canadian symbols
3. add durable cloud cache when the app moves beyond single-instance deployment
4. introduce security-master persistence if import and recommendation logic start depending on richer security metadata
5. add a commodity / metals provider or manual-price workflow for physical gold and other non-equity holdings

## Important deployment note

The current cache is process-local memory, not Redis or Memcached.

This is the correct first step for local development and single-instance demos, but it is not enough for multi-instance cloud deployments. When the app moves to multiple app instances, replace or supplement this cache with Redis.
