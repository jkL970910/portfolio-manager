TRUNCATE TABLE recommendation_items, recommendation_runs, allocation_targets, preference_profiles, cashflow_transactions, holding_positions, investment_accounts, import_jobs, users RESTART IDENTITY CASCADE;

INSERT INTO users (id, email, password_hash, display_name, base_currency) VALUES
('11111111-1111-4111-8111-111111111111', 'jiekun@example.com', '$2b$10$k.mfd.VhYu7dwVnvzws.N.HodQY3uUGhz1y3FO9XFRkYO/VCBXYNa', 'Jiekun Liu', 'CAD'),
('22222222-2222-4222-8222-222222222222', 'casey@example.com', '$2b$10$k.mfd.VhYu7dwVnvzws.N.HodQY3uUGhz1y3FO9XFRkYO/VCBXYNa', 'Casey Morgan', 'CAD');

INSERT INTO investment_accounts (id, user_id, institution, type, nickname, market_value_cad, contribution_room_cad) VALUES
('31111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 'Questrade', 'TFSA', 'Core Growth', 128400.00, 9100.00),
('31111111-1111-4111-8111-222222222222', '11111111-1111-4111-8111-111111111111', 'Interactive Brokers', 'RRSP', 'Retirement Core', 201200.00, 15400.00),
('31111111-1111-4111-8111-333333333333', '11111111-1111-4111-8111-111111111111', 'Wealthsimple', 'Taxable', 'Flexible Capital', 82700.00, NULL),
('32222222-2222-4222-8222-111111111111', '22222222-2222-4222-8222-222222222222', 'Wealthsimple', 'TFSA', 'Growth Sleeve', 74200.00, 11200.00),
('32222222-2222-4222-8222-222222222222', '22222222-2222-4222-8222-222222222222', 'National Bank Direct Brokerage', 'RRSP', 'Retirement Growth', 119400.00, 9600.00),
('32222222-2222-4222-8222-333333333333', '22222222-2222-4222-8222-222222222222', 'Questrade', 'FHSA', 'Home Down Payment', 32800.00, 8000.00);

INSERT INTO holding_positions (id, user_id, account_id, symbol, name, asset_class, sector, market_value_cad, weight_pct, gain_loss_pct) VALUES
('41111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', '31111111-1111-4111-8111-111111111111', 'VEQT', 'Vanguard All-Equity', 'Canadian Equity', 'Multi-sector', 75200.00, 18.20, 11.40),
('41111111-1111-4111-8111-222222222222', '11111111-1111-4111-8111-111111111111', '31111111-1111-4111-8111-222222222222', 'XAW', 'iShares Core MSCI ACWI', 'International Equity', 'Multi-sector', 48600.00, 11.80, 8.70),
('41111111-1111-4111-8111-333333333333', '11111111-1111-4111-8111-111111111111', '31111111-1111-4111-8111-333333333333', 'CASH', 'Purpose High Interest', 'Cash', 'Cash', 40800.00, 9.90, 3.40),
('41111111-1111-4111-8111-444444444444', '11111111-1111-4111-8111-111111111111', '31111111-1111-4111-8111-222222222222', 'XBB', 'iShares Core Canadian Universe Bond', 'Fixed Income', 'Fixed Income', 22300.00, 5.40, 2.10),
('42222222-2222-4222-8222-111111111111', '22222222-2222-4222-8222-222222222222', '32222222-2222-4222-8222-111111111111', 'XEQT', 'iShares All-Equity', 'US Equity', 'Multi-sector', 42100.00, 18.60, 14.80),
('42222222-2222-4222-8222-222222222222', '22222222-2222-4222-8222-222222222222', '32222222-2222-4222-8222-222222222222', 'VFV', 'Vanguard S&P 500', 'US Equity', 'Technology', 35600.00, 15.80, 16.20),
('42222222-2222-4222-8222-333333333333', '22222222-2222-4222-8222-222222222222', '32222222-2222-4222-8222-333333333333', 'XEF', 'iShares MSCI EAFE', 'International Equity', 'Multi-sector', 19800.00, 8.80, 9.60),
('42222222-2222-4222-8222-444444444444', '22222222-2222-4222-8222-222222222222', '32222222-2222-4222-8222-333333333333', 'CASH', 'Purpose High Interest', 'Cash', 'Cash', 9400.00, 4.10, 3.20);

INSERT INTO cashflow_transactions (id, user_id, booked_at, merchant, category, amount_cad, direction) VALUES
('51111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', '2026-03-14', 'Loblaws', 'Food', 142.35, 'outflow'),
('51111111-1111-4111-8111-222222222222', '11111111-1111-4111-8111-111111111111', '2026-03-12', 'Toronto Hydro', 'Housing', 96.20, 'outflow'),
('51111111-1111-4111-8111-333333333333', '11111111-1111-4111-8111-111111111111', '2026-03-01', 'Paycheque', 'Income', 9200.00, 'inflow'),
('52222222-2222-4222-8222-111111111111', '22222222-2222-4222-8222-222222222222', '2026-03-15', 'Farm Boy', 'Food', 118.44, 'outflow'),
('52222222-2222-4222-8222-222222222222', '22222222-2222-4222-8222-222222222222', '2026-03-11', 'Via Rail', 'Travel', 184.90, 'outflow'),
('52222222-2222-4222-8222-333333333333', '22222222-2222-4222-8222-222222222222', '2026-03-01', 'Paycheque', 'Income', 7100.00, 'inflow');

INSERT INTO preference_profiles (id, user_id, risk_profile, account_funding_priority, tax_aware_placement, cash_buffer_target_cad, transition_preference, recommendation_strategy, rebalancing_tolerance_pct, watchlist_symbols) VALUES
('61111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 'Balanced', '["TFSA","RRSP","Taxable"]', true, 12000.00, 'gradual', 'balanced', 4, '["XBB","VCN","XEF"]'),
('62222222-2222-4222-8222-222222222222', '22222222-2222-4222-8222-222222222222', 'Growth', '["FHSA","TFSA","RRSP"]', true, 9000.00, 'direct', 'target-first', 5, '["XEQT","VFV","XEF"]');

INSERT INTO allocation_targets (preference_profile_id, asset_class, target_pct) VALUES
('61111111-1111-4111-8111-111111111111', 'Canadian Equity', 22),
('61111111-1111-4111-8111-111111111111', 'US Equity', 32),
('61111111-1111-4111-8111-111111111111', 'International Equity', 16),
('61111111-1111-4111-8111-111111111111', 'Fixed Income', 20),
('61111111-1111-4111-8111-111111111111', 'Cash', 10),
('62222222-2222-4222-8222-222222222222', 'Canadian Equity', 16),
('62222222-2222-4222-8222-222222222222', 'US Equity', 42),
('62222222-2222-4222-8222-222222222222', 'International Equity', 22),
('62222222-2222-4222-8222-222222222222', 'Fixed Income', 10),
('62222222-2222-4222-8222-222222222222', 'Cash', 10);

INSERT INTO recommendation_runs (id, user_id, contribution_amount_cad, assumptions) VALUES
('71111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 8000.00, '["Recommendation uses configured target allocation and current drift.","Contribution ladder honors TFSA then RRSP before taxable funding."]'),
('72222222-2222-4222-8222-222222222222', '22222222-2222-4222-8222-222222222222', 5000.00, '["Recommendation prioritizes FHSA room before other accounts.","Cash reserve target remains active because of the shorter home-purchase horizon."]');

INSERT INTO recommendation_items (recommendation_run_id, asset_class, amount_cad, target_account_type, ticker_options, explanation) VALUES
('71111111-1111-4111-8111-111111111111', 'Fixed Income', 4000.00, 'RRSP', '["XBB","ZAG"]', 'Largest underweight class and strongest fit for sheltered placement.'),
('71111111-1111-4111-8111-111111111111', 'International Equity', 2500.00, 'TFSA', '["XEF","VIU"]', 'Diversification gap remains secondary after fixed income.'),
('72222222-2222-4222-8222-222222222222', 'International Equity', 2200.00, 'FHSA', '["XEF","VIU"]', 'International exposure remains the clearest diversification gap.'),
('72222222-2222-4222-8222-222222222222', 'Cash Reserve', 1400.00, 'FHSA', '["CASH"]', 'Maintains down-payment flexibility while keeping the growth plan intact.');

INSERT INTO import_jobs (id, user_id, status, source_type, file_name) VALUES
('81111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 'validated', 'csv', 'questrade-holdings-march.csv'),
('82222222-2222-4222-8222-222222222222', '22222222-2222-4222-8222-222222222222', 'mapped', 'csv', 'wealthsimple-fhsa-march.csv');
