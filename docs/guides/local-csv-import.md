# Local CSV Import Guide

## Goal

Use a local broker export CSV to review, validate, and then write the current signed-in user's accounts, holdings, and transactions into the Portfolio Manager database.

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

4. Choose the import path:

- `Guided setup`: create one account sleeve first, then continue account-specific import later
- `Direct CSV import`: upload one file containing multiple accounts, holdings, and transactions

### Guided setup: single-account CSV

If you choose `Guided setup` and then `Upload one account CSV`:

1. Select the account type
2. Select `Upload one account CSV`
3. Enter the institution and nickname
4. Upload the account-specific CSV file
5. Review the detected headers and adjust field mapping
6. Click `Continue` to run a guided dry-run validation
7. Review the parsed counts and any row-level issues
8. Click `Confirm guided setup` to run the real merge import

5. For direct CSV import, upload your local file or map your broker headers to the required fields in the UI.

6. Choose import mode:

- `Replace`: overwrite the current imported accounts, holdings, and transactions for the signed-in user
- `Merge`: reuse matching accounts, update matching holdings, append new transactions, and preserve unrelated existing data

7. Click `Validate and review import`.

8. Review the parsed row count, account count, holding count, and transaction count.

9. Click `Confirm import` to write the reviewed changes into the database.

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

If validation passes and you confirm the write:

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
4. Re-run validation

The importer prefills any exact header matches automatically.

## Mapping Presets

The import screen supports:

- built-in presets
- exact-header auto-detect
- database-backed saved presets for the signed-in user

Use `Save current preset` after you finish a custom mapping. The preset is stored in the Portfolio Manager database and can be reused by the same signed-in user on any machine.

Saved presets can now also be renamed or deleted from the import screen.

## CSV Preview

After you upload a file, the importer shows the first 20 data rows before import. Use this to confirm:

- the file is the correct export
- the headers are what you expect
- account, holding, and transaction rows are all present
- date and amount columns look parseable
