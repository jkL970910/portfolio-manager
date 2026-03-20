# Local CSV Import Guide

## Goal

Use a local broker export CSV to review, validate, and then write the current signed-in user's accounts, holdings, and transactions into the Portfolio Manager database.

## Supported Row Types

The importer accepts one flat CSV with a `record_type` column.

- `account`
- `holding`
- `transaction`

Each row type can share the same file. Rows are linked with `account_key`.

## Canonical Holding Model

The current import model treats a holding as:

- account identity
- ticker symbol
- optional security name
- asset class
- sector
- quantity
- average cost per share
- optional explicit cost basis
- optional current price
- optional explicit current market value

The importer will derive missing values when enough fields are available.

## Quick Start

1. Start the app:

```powershell
npm run local:start
```

2. Open the import page:

```text
http://localhost:3000/import
```

3. Download the starter template:

```text
/templates/portfolio-import-template.csv
```

## Guided Setup

### Single-account CSV

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

### Manual Entry

Use this when you want to add holdings without a broker export.

1. Choose account type
2. Choose `Enter holdings manually`
3. Choose whether to add a new account or use an existing account
4. Enter or confirm institution, nickname, and contribution room
5. Add one or more holdings
6. For each holding, enter:
   - ticker symbol
   - optional holding name
   - asset class
   - sector
   - quantity
   - average cost per share
   - current price or current market value
7. Review the write
8. Confirm the write to upsert holdings into the target account

Manual entry no longer asks for gain/loss directly. The application derives it from cost basis and valuation inputs.

## Direct CSV Import

Use this when your broker export already contains multiple accounts, holdings, and transactions in one file.

1. Upload the file
2. Review the preview
3. Map fields if the broker headers differ from the canonical names
4. Save a preset if you want to reuse the mapping
5. Choose import mode:
   - `Replace`
   - `Merge`
6. Click `Validate and review import`
7. Review row counts and validation issues
8. Click `Confirm import` to write the changes into the database

## Minimum Required Fields

### Core

- `record_type`
- `account_key`

### Account Rows

Required:

- `account_type`

Optional:

- `institution`
- `account_nickname`
- `market_value_cad`
- `contribution_room_cad`

### Holding Rows

Required:

- `symbol`
- `asset_class`
- `market_value_cad`
  - or `quantity` plus `last_price_cad`

Optional:

- `name`
- `sector`
- `quantity`
- `avg_cost_per_share_cad`
- `cost_basis_cad`
- `last_price_cad`
- `weight_pct`
- `gain_loss_pct`

### Transaction Rows

Required:

- `booked_at`
- `merchant`
- `category`
- `amount_cad`
- `direction`

## Example

```csv
record_type,account_key,account_type,institution,account_nickname,market_value_cad,contribution_room_cad,symbol,name,asset_class,sector,quantity,avg_cost_per_share_cad,cost_basis_cad,last_price_cad,weight_pct,gain_loss_pct,booked_at,merchant,category,amount_cad,direction
account,tfsa_main,TFSA,Questrade,Main TFSA,20500,12000,,,,,,,,,,,,,,
holding,tfsa_main,TFSA,Questrade,Main TFSA,14500,12000,VFV,Vanguard S&P 500 Index ETF,US Equity,Multi-sector,60,223.50,13410.00,241.67,70.73,8.13,,,,,
transaction,tfsa_main,TFSA,Questrade,Main TFSA,,,,,,,,,,,,,2026-03-08,Loblaws,Groceries,182.44,outflow
```

## What Happens On Import

If validation passes and you confirm the write:

1. A completed `import_job` is created.
2. Accounts are created or matched in user scope.
3. Holdings are inserted or updated in user scope.
4. Transactions are inserted in user scope.
5. A new baseline recommendation run is generated automatically.

If validation fails:

1. A draft `import_job` is created.
2. No portfolio data is replaced.
3. Row-level validation errors are shown in the UI.

## Validation Rules

- `account_type` must be one of `TFSA`, `RRSP`, `FHSA`, `Taxable`
- `direction` must be `inflow` or `outflow`
- `booked_at` must use `YYYY-MM-DD`
- numeric fields must be parseable after removing `$` and commas
- each `holding` row and `account` row must include `account_key`
- each holding must provide either:
  - `market_value_cad`
  - or `quantity` plus `last_price_cad`

## Field Mapping

If your broker export uses different header names:

1. Upload the CSV
2. Review detected headers
3. Map each canonical field to the broker column
4. Re-run validation

The importer prefills any exact header matches automatically.

## Mapping Presets

The import screen supports:

- built-in presets
- exact-header auto-detect
- database-backed saved presets for the signed-in user

Use `Save current preset` after you finish a custom mapping. The preset is stored in the Portfolio Manager database and can be reused by the same signed-in user on any machine.

Saved presets can also be renamed or deleted from the direct import screen.

## Why Gain/Loss Is No Longer the Primary Input

Typing gain/loss directly is fragile because it is derived data.

The preferred source fields are:

- quantity
- average cost per share
- current price
- or current market value

From these, the importer can derive:

- cost basis
- market value
- gain/loss percentage

This is a better foundation for future live-price integrations and reduces manual entry mistakes.
