# Backend Data Model Draft

## Tables / collections to create first

### users
- id
- display_name
- base_currency
- created_at
- updated_at

### accounts
- id
- user_id
- institution
- type
- nickname
- market_value_cad
- contribution_room_cad
- created_at
- updated_at

### holdings
- id
- account_id
- symbol
- name
- asset_class
- sector
- market_value_cad
- weight_pct
- gain_loss_pct
- created_at
- updated_at

### transactions
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
- created_at
- updated_at

### preference_targets
- id
- preference_profile_id
- asset_class
- target_pct

### preference_account_priorities
- id
- preference_profile_id
- account_type
- rank_order

### watchlist_symbols
- id
- preference_profile_id
- symbol

### import_jobs
- id
- user_id
- source_type
- file_name
- status
- created_at
- updated_at

### recommendation_runs
- id
- user_id
- contribution_amount_cad
- created_at

### recommendation_items
- id
- recommendation_run_id
- asset_class
- amount_cad
- target_account_type
- explanation

### recommendation_item_tickers
- id
- recommendation_item_id
- ticker

## Notes
- `preference_profiles` should be versionable over time.
- `recommendation_runs` should be immutable snapshots.
- spending summaries should be derived from `transactions`, not stored separately at first.
- portfolio dashboard metrics should be computed from accounts, holdings, transactions, and preferences.
