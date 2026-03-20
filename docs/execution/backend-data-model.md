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
- assumptions
- created_at

### recommendation_items
- id
- recommendation_run_id
- asset_class
- amount_cad
- target_account_type
- ticker_options
- explanation
- created_at

## Notes
- `preference_profiles` are currently mutable per user and not yet versioned.
- `recommendation_runs` should be immutable snapshots.
- spending summaries should be derived from `transactions`, not stored separately at first.
- portfolio dashboard metrics should be computed from accounts, holdings, transactions, and preferences.
- import mapping presets are now durable user-level resources stored in the database.
