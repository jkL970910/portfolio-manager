# Backend Data Model

## Current persisted tables

### users
- id
- email
- password_hash
- display_name
- base_currency
- created_at
- updated_at

### investment_accounts
- id
- user_id
- institution
- type
- nickname
- currency
- market_value_amount
- market_value_cad
- contribution_room_cad
- created_at
- updated_at

### holding_positions
- id
- user_id
- account_id
- symbol
- name
- asset_class
- sector
- currency
- quantity
- avg_cost_per_share_amount
- cost_basis_amount
- last_price_amount
- market_value_amount
- market_value_cad
- weight_pct
- gain_loss_pct
- created_at
- updated_at

Notes:
- `account_id` is currently the only strong bridge between account and holding detail.
- the product still lacks dedicated account-merge metadata and holding edit history.

### cashflow_transactions
- id
- user_id
- account_id nullable
- booked_at
- merchant
- category
- amount_cad
- direction
- created_at

### preference_profiles
- id
- user_id
- risk_profile
- tax_aware_placement
- cash_buffer_target_cad
- transition_preference
- recommendation_strategy
- rebalancing_tolerance_pct
- watchlist_symbols
- created_at
- updated_at

### allocation_targets
- id
- preference_profile_id
- asset_class
- target_pct

### import_jobs
- id
- user_id
- source_type
- file_name
- status
- created_at
- updated_at

### import_mapping_presets
- id
- user_id
- name
- source_type
- mapping
- created_at
- updated_at

### recommendation_runs
- id
- user_id
- contribution_amount_cad
- engine_version nullable
- objective nullable
- confidence_score nullable
- assumptions
- notes nullable
- created_at

### recommendation_items
- id
- recommendation_run_id
- asset_class
- amount_cad
- target_account_type
- security_symbol nullable
- security_name nullable
- security_score nullable
- allocation_gap_before_pct nullable
- allocation_gap_after_pct nullable
- account_fit_score nullable
- tax_fit_score nullable
- fx_friction_penalty_bps nullable
- ticker_options
- explanation
- rationale nullable
- created_at

## Notes
- `preference_profiles` are currently mutable per user and not yet versioned.
- `recommendation_runs` should be immutable snapshots.
- recommendation v2 now persists structured placement and scoring metadata so the UI can explain why a sleeve, account, and security were chosen.
- spending summaries should be derived from `transactions`, not stored separately at first.
- portfolio dashboard metrics should be computed from accounts, holdings, transactions, and preferences.
- import mapping presets are now durable user-level resources stored in the database.
- current dashboard and portfolio trend charts still rely on synthetic series, not replayed historical portfolio values.

## Planned additions for portfolio workspace

### Phase 1: account-centric portfolio foundation

No hard schema expansion is strictly required for the first UI phase, but the following model rules must be applied consistently:

- account display naming must distinguish:
  - account category (`TFSA`, `RRSP`, `FHSA`, `Taxable`)
  - account instance (`Wealthsimple TFSA`, `Questrade TFSA`, `TFSA · USD`, etc.)
- repeated account types must remain distinguishable in charts and cards
- portfolio view models must support:
  - account-category aggregation
  - account-instance breakdown

### Phase 2: account and holding detail surfaces

Likely additions:

#### security_master
- symbol
- name
- exchange
- currency
- sector
- asset_class
- icon_url nullable
- provider_source nullable
- updated_at

Purpose:
- support richer holding detail pages
- support icon/logo rendering
- centralize security display metadata

### Phase 3: edit and repair workflows

Likely additions:

#### account_merge_logs
- id
- user_id
- source_account_id
- target_account_id
- merged_at
- summary_json

Purpose:
- preserve auditability for account merge flows

#### holding_edit_logs
- id
- user_id
- holding_id
- changed_fields_json
- created_at

Purpose:
- preserve auditability for holding edits and account reassignment

### Phase 4: real historical performance

Required additions:

#### portfolio_events
- id
- user_id
- account_id
- symbol nullable
- event_type
- quantity nullable
- price_amount nullable
- currency nullable
- booked_at
- effective_at
- source
- created_at

Purpose:
- create a replayable source of truth for historical position changes

#### security_price_history
- symbol
- date
- close
- adjusted_close nullable
- currency
- source

Purpose:
- provide daily historical prices for replayed valuation

#### portfolio_snapshots
- id
- user_id
- snapshot_date
- total_value_cad
- account_breakdown_json
- holding_breakdown_json
- source_version
- created_at

Purpose:
- persist replayed daily portfolio values for dashboard and portfolio charts
