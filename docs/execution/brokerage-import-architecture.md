# Brokerage Import Architecture

Status: P1 architecture approved, implementation not started.

This document defines the target brokerage import flow for Loo 国. It is not a
CSV import replacement and should not split the mobile Import page into
provider-specific top-level tabs.

## Product IA

The mobile Import page should have two top-level paths:

1. `手动维护`
   - add account
   - add holding
   - review existing accounts
2. `券商同步`
   - IBKR
   - Wealthsimple

The top-level distinction is manual maintenance versus brokerage sync. Provider
workflows can differ after the user enters `券商同步`, but all providers must
write to the same import preview and confirmation pipeline.

## Provider Priority

### IBKR Flex Query

IBKR Flex Query is the first build target.

Inputs:

- Flex Token
- Activity Query ID
- optional Trade Confirmation Query ID

Expected data:

- accounts
- holdings / positions
- cash balances
- transactions
- dividends
- fees and commissions
- FX activity

Limits:

- Flex Query is an account statement/report source, not a realtime quote source.
- Imported securities still need the existing metadata, quote, history, and
  external-research workers after confirmation.
- First version should support one-time/manual sync. Do not store IBKR tokens by
  default.

### Wealthsimple Via SnapTrade

Wealthsimple is the first feasibility spike, not an immediate production
integration.

Verify before building the final integration:

- Wealthsimple connection is available.
- TFSA/RRSP/FHSA/Non-registered account labels are returned.
- holdings are returned with enough identity fields.
- cash balances and transactions are returned.
- native currency, symbol, and exchange/listing data are reliable enough.
- OAuth/reconnect behavior works on Flutter Web/mobile.
- free-plan brokerage connection limits are acceptable for personal use.

Plaid and Flinks remain backup research paths until the SnapTrade spike is
complete.

## Shared Provider Contract

Every provider must normalize into the same internal draft model:

```ts
type BrokerageImportProvider =
  | "ibkr-flex"
  | "snaptrade"
  | "plaid"
  | "flinks"
  | "manual";

type BrokerageImportDraft = {
  id: string;
  runId: string;
  provider: BrokerageImportProvider;
  accounts: ImportedAccount[];
  holdings: ImportedHolding[];
  cashBalances: ImportedCashBalance[];
  transactions: ImportedTransaction[];
  dividends: ImportedDividend[];
  fees: ImportedFee[];
  unresolvedSecurities: UnresolvedSecurity[];
  conflicts: ImportConflict[];
  summary: BrokerageImportSummary;
  expiresAt: string;
};
```

Provider raw payloads can be stored for audit/debug, but user-facing copy should
describe the resulting accounts, holdings, cash, transactions, and conflicts.

## Draft Before Write

External data must never write directly into the main account/holding tables.

Flow:

```text
provider raw payload
-> normalize provider rows
-> resolve security identity
-> generate idempotency keys
-> diff against existing ledger
-> generate conflicts
-> persist draft preview
-> user resolves blockers
-> user confirms
-> write to main ledger
```

The draft is the quarantine zone. It can contain incomplete, ambiguous, or dirty
external data. The main ledger must remain clean.

Recommended persistence:

```ts
brokerage_import_runs
- id
- userId
- provider
- status
- startedAt
- finishedAt
- errorMessage
- sourceMetadataJson

brokerage_import_drafts
- id
- runId
- userId
- provider
- accountsJson
- holdingsJson
- cashBalancesJson
- transactionsJson
- unresolvedSecuritiesJson
- conflictsJson
- summaryJson
- createdAt
- expiresAt
```

Draft rows must have TTL cleanup. Use the existing worker/cron pattern to delete
expired drafts once cloud jobs are stable.

## Security Identity Rules

The import pipeline must preserve exact security identity:

```text
symbol + exchange/listing market + trading currency
```

Strong match:

- symbol, exchange, and currency all match an existing `security_id`
- may be default-selected in preview, but should remain visible

Medium match:

- symbol and currency match, but exchange is missing or normalized uncertainly
- require user confirmation

Weak match:

- ticker-only match
- never auto-select

Ambiguous:

- same ticker has CAD/USD or multiple listing candidates
- require user confirmation

## Unresolved Securities

Unresolved investment securities are blockers in the draft preview. They must
not enter the main ledger as normal holdings.

```ts
type UnresolvedSecurity = {
  idempotencyKey: string;
  sourceProvider: BrokerageImportProvider;
  sourceAccountId: string;
  sourceSymbol: string;
  sourceName?: string;
  sourceCurrency?: "CAD" | "USD";
  sourceExchange?: string;
  quantity?: number;
  marketValue?: number;
  reason:
    | "missing_exchange"
    | "missing_currency"
    | "ambiguous_listing"
    | "unknown_symbol"
    | "unsupported_asset";
  candidates: SecurityCandidate[];
};
```

Flutter preview actions:

- select a suggested candidate
- manually search Loo 国 security identity
- skip that imported row
- mark as restricted `Other Asset` only when it is genuinely not a listed
  security

`Other Asset` rows can contribute to net worth only if explicitly confirmed.
They must be excluded from recommendations, quick scan, security detail,
security intelligence matching, and portfolio fit calculations.

## Idempotency

Every provider row must receive a stable idempotency key before preview.

Recommended inputs:

```text
userId
provider
sourceAccountId
sourceRowType
symbol
exchange
currency
tradeDate or statementDate
quantity
amount
providerRowId if reliable
```

The idempotency key prevents repeated confirm actions from duplicating holdings
or transactions and enables import diff display.

## Confirm Modes

P1 should use snapshot import as the source of truth. Transactions are evidence,
not the current holdings source of truth yet.

```ts
type BrokerageImportConfirmMode =
  | "snapshot_replace"
  | "snapshot_merge"
  | "transactions_only";
```

Initial public modes:

- `snapshot_replace`: use for complete account snapshots. Holdings missing from
  the snapshot should be soft-closed, not hard-deleted.
- `snapshot_merge`: use for partial or early provider validation. Only touched
  holdings update; untouched holdings remain unchanged.

`transactions_only` is deferred until a full accounting ledger exists.

Closed holdings should keep historical audit fields:

- `status = "closed"`
- `closedAt`
- `closeReason`
- quantity can be zero, but historical cost and lineage should remain available

Merge mode should update `lastSyncedAt` on touched holdings. Old untouched
holdings can later show a light stale-sync warning.

## Cross-Provider Conflicts

Cross-provider holdings must not merge silently.

Automatic update is allowed only when all are true:

```text
existingHolding.sourceProvider == imported.provider
existingHolding.sourceAccountId == imported.sourceAccountId
existingHolding.securityId == imported.securityId
```

Manual versus brokerage, or different provider versus same security, must be
handled as an explicit conflict.

```ts
type ImportConflict = {
  id: string;
  kind:
    | "possible_duplicate_holding"
    | "account_mapping_required"
    | "provider_takeover_required"
    | "manual_holding_stale";
  severity: "blocker" | "warning";
  existingHolding: ExistingHoldingSummary;
  importedHolding: ImportedHoldingSummary;
  suggestedResolution:
    | "provider_takeover"
    | "import_as_new"
    | "skip_import"
    | "archive_manual";
  allowedResolutions: ImportConflictResolution[];
};
```

User-visible choices:

- use brokerage provider to take over the existing manual holding
- import as a separate holding
- skip this row
- archive the stale manual holding

Provider takeover should preserve data lineage:

- previous source: manual
- new source provider
- source account id
- provider holding key
- takeover import run id
- takeover timestamp

## API Shape

Target mobile endpoints:

```text
GET  /api/mobile/import
POST /api/mobile/import/brokerage/ibkr-flex/preview
POST /api/mobile/import/brokerage/snaptrade/session
GET  /api/mobile/import/brokerage/drafts/[draftId]
POST /api/mobile/import/brokerage/drafts/[draftId]/resolve
POST /api/mobile/import/brokerage/drafts/[draftId]/confirm
```

The preview and confirm APIs should be backend-owned. Flutter should render
backend-supplied DTOs and submit selected resolutions, not re-run matching logic.

## Non-Goals

- No mobile CSV import unless explicitly requested.
- No realtime quote fetching through IBKR Flex Query.
- No ticker-only merges.
- No automatic write to main holdings before preview confirmation.
- No transaction-sourced accounting ledger in P1.
