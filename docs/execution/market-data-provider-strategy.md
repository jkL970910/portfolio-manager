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
- latest-available quote lookup
- future batch quotes and streaming extensions

This is the preferred runtime provider for the current app because it is a better fit for later quote-driven workflows than Alpha Vantage.

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

The first implementation also includes an in-process TTL cache to reduce provider usage during local development and single-instance deployments.

Default cache policy:

- search: 6 hours
- normalization: 7 days
- quote: 15 minutes

If a provider call fails after a cached value exists, the service can return stale cached data instead of failing immediately.

Current provider routing:

- search -> Twelve Data
- normalization -> OpenFIGI
- quote -> Twelve Data

If keys are missing, the layer returns safe fallback payloads instead of crashing the app.

## Required environment variables

- `OPENFIGI_API_KEY`
- `TWELVE_DATA_API_KEY`
- `ALPHA_VANTAGE_API_KEY` (optional, not used in the first adapter)
- `MARKET_DATA_SEARCH_CACHE_TTL_SECONDS`
- `MARKET_DATA_RESOLVE_CACHE_TTL_SECONDS`
- `MARKET_DATA_QUOTE_CACHE_TTL_SECONDS`

## Next steps

1. Connect the import manual-entry symbol field to `/api/market-data/search`
2. Normalize confirmed symbols through `/api/market-data/resolve`
3. Add delayed quote refresh for holdings and derived gain/loss
4. Add batch quote support before wiring quote refresh into dashboard and portfolio pages

## Important deployment note

The current cache is process-local memory, not Redis or Memcached.

This is the correct first step for local development and single-instance demos, but it is not enough for multi-instance cloud deployments. When the app moves to multiple app instances, replace or supplement this cache with Redis.
