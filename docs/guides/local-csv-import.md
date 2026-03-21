# Local CSV Import Guide

## Goal

Use local CSV files to import either:

- portfolio account and holding data
- spending transaction data

These are now separate workflows in the app. They intentionally use separate frontend and backend entry points so future broker integrations and future bank/card integrations can evolve independently.

## Import Workflow Split

### Portfolio Import
Use this for:
- account rows
- holding rows
- guided onboarding for a single account
- manual holding entry

This workflow updates:
- `investment_accounts`
- `holding_positions`
- recommendation baseline refresh when portfolio data changes materially

### Spending Import
Use this for:
- transaction rows only
- spending, inflow, and category history

This workflow updates:
- `cashflow_transactions`

It does not overwrite:
- holdings
- portfolio accounts
- recommendation runs directly

## Portfolio CSV

### Supported Row Types

The portfolio importer accepts these row types:

- `account`
- `holding`

Rows are linked with `account_key`.

### Canonical Holding Model

The current holding model treats a holding as:

- account identity
- ticker symbol
- optional security name
- asset class
- sector
- quantity
- average cost per share
- optional explicit cost basis
- optional current price
- optional explicit current market value override

The importer will derive missing values when enough fields are available.

In the CSV workflow, the canonical field names are now:

- `account_currency`
- `holding_currency`
- `market_value`
- `avg_cost_per_share`
- `cost_basis`
- `last_price`

`market_value` serves the same purpose as the UI's `Override total value`:

- if `market_value` is present and greater than `0`, it is treated as the explicit total position value in the row currency
- if `market_value` is empty, the importer falls back to `quantity x last_price`

Use `account_currency` and `holding_currency` to declare whether the amounts are in `CAD` or `USD`. The backend normalizes those values to CAD for analytics, while the product can still display CAD or USD globally.

### Guided Setup

#### Single-account CSV

Use this when you want to onboard one account at a time.

1. Choose account type
2. Choose `Upload one account CSV`
3. Choose whether to add a new account or use an existing account
4. Enter or confirm institution, nickname, and contribution room
5. Upload the CSV
6. Review detected headers and adjust field mapping
7. Click `Continue` to run a dry-run validation
8. Review parsed counts and row-level issues
9. Click `Confirm guided setup` to run the real merge import

#### Manual Entry

Use this when you want to add holdings without a broker export.

1. Choose account type
2. Choose `Enter holdings manually`
3. Choose whether to add a new account or use an existing account
4. Enter or confirm institution, nickname, and contribution room
5. Add one or more holdings
6. For each holding, you can:
   - search by ticker or security name
   - normalize the symbol before saving
   - fetch a latest-available quote
7. For each holding, confirm or enter:
   - ticker symbol
   - optional holding name
   - asset class
   - sector
   - quantity
   - average cost per share
   - current price
   - optional override total value
8. Review the write
9. Confirm the write to upsert holdings into the target account

Manual entry no longer asks for gain/loss directly. The application derives it from cost basis and valuation inputs.

`Current market value` is now a read-only derived field:

- normal path: `quantity x current price`
- override path: `override total value`

Use `Override total value` only when you intentionally want to replace the computed total position value.

### Direct Portfolio CSV Import

Use this when your broker export already contains multiple accounts and holdings in one file.

1. Upload the file
2. Review the preview
3. Map fields if the broker headers differ from the canonical names
4. Save a preset if you want to reuse the mapping
5. Choose import mode:
   - `Replace`
   - `Merge`
6. Click `Validate and review import`
7. Review:
   - row counts
   - validation issues
   - symbol audit output
   - final write values after corrections
8. If needed, override symbol or name for flagged securities
9. Click `Confirm import` to write the changes into the database

### Portfolio Template

Download:

```text
/templates/portfolio-import-template.csv
```

### Portfolio Minimum Required Fields

#### Core

- `record_type`
- `account_key`

#### Account Rows

Required:

- `account_type`

Optional:

- `institution`
- `account_nickname`
- `account_currency`
- `market_value`
- `contribution_room_cad`

#### Holding Rows

Required:

- `symbol`
- `asset_class`
- `holding_currency`
- `market_value`
  - or `quantity` plus `last_price`

Optional:

- `name`
- `sector`
- `quantity`
- `avg_cost_per_share`
- `cost_basis`
- `last_price`
- `weight_pct`
- `gain_loss_pct`

`market_value` has higher priority than `quantity x last_price`.
Use it when you want to explicitly override the computed total value for the holding.

## Spending CSV

### Supported Row Types

The spending importer accepts:

- `transaction`

`account_key` is optional at the workflow level, but still available when you want to preserve a source-level account reference.

### Direct Spending CSV Import

Use this when you want to import cash-flow history separately from portfolio positions.

1. Open `Spending Import`
2. Upload the file
3. Review the preview
4. Map transaction fields if needed
5. Choose import mode:
   - `Merge`
   - `Replace`
6. Click `Validate and review spending import`
7. Review transaction counts and row-level issues
8. Click `Confirm spending import`

### Spending Template

Download:

```text
/templates/spending-import-template.csv
```

### Spending Minimum Required Fields

Required:

- `record_type`
- `booked_at`
- `merchant`
- `category`
- `amount_cad`
- `direction`

Optional:

- `account_key`

## Validation Rules

- `account_type` must be one of `TFSA`, `RRSP`, `FHSA`, `Taxable`
- `direction` must be `inflow` or `outflow`
- `booked_at` must use `YYYY-MM-DD`
- numeric fields must be parseable after removing `$` and commas
- each portfolio `holding` row and `account` row must include `account_key`
- each holding must provide either:
  - `market_value`
  - or `quantity` plus `last_price`
- if both `market_value` and `quantity + last_price` are present, `market_value` wins

## Mapping Presets

The portfolio import screen supports:

- built-in presets
- exact-header auto-detect
- database-backed saved presets for the signed-in user

Use `Save current preset` after you finish a custom mapping. The preset is stored in the Loo国的财富宝库 database and can be reused by the same signed-in user on any machine.

Saved presets can also be renamed or deleted from the direct portfolio import screen.

## Symbol Audit

Direct portfolio CSV import performs a symbol audit during review.

This review can show:

- normalized symbol suggestions
- provider-backed name lookups
- quote availability
- warnings for symbols that need review

If a row needs correction, you can override the final symbol or final name before confirming the import.

## Why Gain/Loss Is No Longer the Primary Input

Typing gain/loss directly is fragile because it is derived data.

The preferred source fields are:

- quantity
- average cost per share
- current price
- optional override total value

From these, the importer can derive:

- cost basis
- market value
- gain/loss percentage

This is a better foundation for future live-price integrations and reduces manual entry mistakes.

