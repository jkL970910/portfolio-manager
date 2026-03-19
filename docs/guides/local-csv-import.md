# Local CSV Import Guide

## Goal

Use a local broker export CSV to replace the current signed-in user's accounts, holdings, and transactions in the Portfolio Manager database.

## Supported Row Types

The importer accepts one flat CSV with a `record_type` column.

- `account`
- `holding`
- `transaction`

Each row type can share the same file. Rows are linked with `account_key`.

## Quick Start

1. Start the app:

```powershell
npm run db:start
npm run dev
```

2. Open the import page:

```text
http://localhost:3000/import
```

3. Download the starter template:

```text
/templates/portfolio-import-template.csv
```

4. Fill in your local CSV or map your broker headers to the required fields in the UI.

5. Choose import mode:

- `Replace`: overwrite the current imported accounts, holdings, and transactions for the signed-in user
- `Merge`: reuse matching accounts, update matching holdings, append new transactions, and preserve unrelated existing data

6. Click `Validate, import, and refresh recommendations`.

## Minimum Required Fields

### Core

- `record_type`
- `account_key`

### Account Rows

- `account_type`

Optional:

- `institution`
- `account_nickname`
- `market_value_cad`
- `contribution_room_cad`

### Holding Rows

- `symbol`
- `asset_class`
- `market_value_cad`

Optional:

- `name`
- `sector`
- `weight_pct`
- `gain_loss_pct`

### Transaction Rows

- `booked_at`
- `merchant`
- `category`
- `amount_cad`
- `direction`

## Example

```csv
record_type,account_key,account_type,institution,account_nickname,market_value_cad,contribution_room_cad,symbol,name,asset_class,sector,weight_pct,gain_loss_pct,booked_at,merchant,category,amount_cad,direction
account,tfsa_main,TFSA,Questrade,Main TFSA,20500,12000,,,,,,,,,
holding,tfsa_main,TFSA,Questrade,Main TFSA,14500,12000,VFV,Vanguard S&P 500 Index ETF,US Equity,Multi-sector,70.73,8.4,,,,,
transaction,tfsa_main,TFSA,Questrade,Main TFSA,,,,,,,,,2026-03-08,Loblaws,Groceries,182.44,outflow
```

## What Happens On Import

If validation passes:

1. A completed `import_job` is created.
2. Existing user-scoped accounts are replaced.
3. Existing user-scoped holdings are replaced.
4. Existing user-scoped transactions are replaced.
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

## Field Mapping

If your broker export uses different header names:

1. Upload the CSV
2. Review detected headers
3. Map each canonical field to the broker column
4. Re-run validation/import

The importer prefills any exact header matches automatically.

## Mapping Presets

The import screen supports:

- built-in presets
- exact-header auto-detect
- browser-local saved presets

Use `Save current preset` after you finish a custom mapping. The preset is stored in local browser storage and can be reused for later imports from the same machine/browser profile.

## CSV Preview

After you upload a file, the importer shows the first 20 data rows before import. Use this to confirm:

- the file is the correct export
- the headers are what you expect
- account, holding, and transaction rows are all present
- date and amount columns look parseable
