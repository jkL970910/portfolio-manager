import {
  boolean,
  date,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 320 }).notNull(),
  passwordHash: text("password_hash").notNull(),
  displayName: varchar("display_name", { length: 160 }).notNull(),
  baseCurrency: varchar("base_currency", { length: 3 }).notNull().default("CAD"),
  displayLanguage: varchar("display_language", { length: 8 }).notNull().default("zh"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => ({
  emailIdx: uniqueIndex("users_email_idx").on(table.email)
}));

export const citizenProfiles = pgTable("citizen_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id),
  citizenName: varchar("citizen_name", { length: 160 }).notNull(),
  gender: varchar("gender", { length: 16 }),
  birthDate: date("birth_date"),
  avatarType: varchar("avatar_type", { length: 24 }).notNull().default("default"),
  derivedRank: varchar("derived_rank", { length: 32 }).notNull(),
  derivedAddressTier: varchar("derived_address_tier", { length: 32 }).notNull(),
  derivedIdCode: varchar("derived_id_code", { length: 32 }).notNull(),
  overrideRank: varchar("override_rank", { length: 32 }),
  overrideAddressTier: varchar("override_address_tier", { length: 32 }),
  overrideIdCode: varchar("override_id_code", { length: 32 }),
  wealthScoreSnapshotCad: numeric("wealth_score_snapshot_cad", { precision: 14, scale: 2 }).notNull().default("0"),
  issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => ({
  userUniqueIdx: uniqueIndex("citizen_profiles_user_id_idx").on(table.userId)
}));

export const investmentAccounts = pgTable("investment_accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id),
  institution: varchar("institution", { length: 120 }).notNull(),
  type: varchar("type", { length: 24 }).notNull(),
  nickname: varchar("nickname", { length: 120 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("CAD"),
  marketValueAmount: numeric("market_value_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  marketValueCad: numeric("market_value_cad", { precision: 14, scale: 2 }).notNull(),
  contributionRoomCad: numeric("contribution_room_cad", { precision: 14, scale: 2 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const holdingPositions = pgTable("holding_positions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id),
  accountId: uuid("account_id").notNull().references(() => investmentAccounts.id),
  symbol: varchar("symbol", { length: 32 }).notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  assetClass: varchar("asset_class", { length: 64 }).notNull(),
  assetClassOverride: varchar("asset_class_override", { length: 64 }),
  sector: varchar("sector", { length: 64 }).notNull(),
  sectorOverride: varchar("sector_override", { length: 64 }),
  currency: varchar("currency", { length: 3 }).notNull().default("CAD"),
  securityTypeOverride: varchar("security_type_override", { length: 32 }),
  exchangeOverride: varchar("exchange_override", { length: 64 }),
  marketSectorOverride: varchar("market_sector_override", { length: 64 }),
  quantity: numeric("quantity", { precision: 18, scale: 6 }),
  avgCostPerShareAmount: numeric("avg_cost_per_share_amount", { precision: 14, scale: 4 }),
  costBasisAmount: numeric("cost_basis_amount", { precision: 14, scale: 2 }),
  lastPriceAmount: numeric("last_price_amount", { precision: 14, scale: 4 }),
  marketValueAmount: numeric("market_value_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  avgCostPerShareCad: numeric("avg_cost_per_share_cad", { precision: 14, scale: 4 }),
  costBasisCad: numeric("cost_basis_cad", { precision: 14, scale: 2 }),
  lastPriceCad: numeric("last_price_cad", { precision: 14, scale: 4 }),
  marketValueCad: numeric("market_value_cad", { precision: 14, scale: 2 }).notNull(),
  weightPct: numeric("weight_pct", { precision: 7, scale: 2 }).notNull(),
  gainLossPct: numeric("gain_loss_pct", { precision: 7, scale: 2 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const portfolioEditLogs = pgTable("portfolio_edit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id),
  entityType: varchar("entity_type", { length: 32 }).notNull(),
  entityId: varchar("entity_id", { length: 64 }).notNull(),
  action: varchar("action", { length: 32 }).notNull(),
  summary: text("summary").notNull(),
  payload: jsonb("payload").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const cashflowTransactions = pgTable("cashflow_transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id),
  accountId: uuid("account_id").references(() => investmentAccounts.id),
  bookedAt: date("booked_at").notNull(),
  merchant: varchar("merchant", { length: 160 }).notNull(),
  category: varchar("category", { length: 64 }).notNull(),
  amountCad: numeric("amount_cad", { precision: 14, scale: 2 }).notNull(),
  direction: varchar("direction", { length: 16 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const preferenceProfiles = pgTable("preference_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id),
  riskProfile: varchar("risk_profile", { length: 32 }).notNull(),
  accountFundingPriority: jsonb("account_funding_priority").notNull(),
  taxAwarePlacement: boolean("tax_aware_placement").notNull().default(true),
  cashBufferTargetCad: numeric("cash_buffer_target_cad", { precision: 14, scale: 2 }).notNull(),
  transitionPreference: varchar("transition_preference", { length: 32 }).notNull(),
  recommendationStrategy: varchar("recommendation_strategy", { length: 32 }).notNull(),
  source: varchar("source", { length: 16 }).notNull().default("manual"),
  rebalancingTolerancePct: integer("rebalancing_tolerance_pct").notNull(),
  watchlistSymbols: jsonb("watchlist_symbols").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => ({
  userUniqueIdx: uniqueIndex("preference_profiles_user_id_idx").on(table.userId)
}));

export const allocationTargets = pgTable("allocation_targets", {
  id: uuid("id").defaultRandom().primaryKey(),
  preferenceProfileId: uuid("preference_profile_id").notNull().references(() => preferenceProfiles.id),
  assetClass: varchar("asset_class", { length: 64 }).notNull(),
  targetPct: integer("target_pct").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const guidedAllocationDrafts = pgTable("guided_allocation_drafts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id),
  answers: jsonb("answers").notNull(),
  suggestedProfile: jsonb("suggested_profile").notNull(),
  assumptions: jsonb("assumptions").notNull(),
  rationale: jsonb("rationale").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => ({
  userUniqueIdx: uniqueIndex("guided_allocation_drafts_user_id_idx").on(table.userId)
}));

export const recommendationRuns = pgTable("recommendation_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id),
  contributionAmountCad: numeric("contribution_amount_cad", { precision: 14, scale: 2 }).notNull(),
  engineVersion: varchar("engine_version", { length: 16 }),
  objective: varchar("objective", { length: 32 }),
  confidenceScore: numeric("confidence_score", { precision: 6, scale: 2 }),
  assumptions: jsonb("assumptions").notNull(),
  notes: jsonb("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const recommendationItems = pgTable("recommendation_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  recommendationRunId: uuid("recommendation_run_id").notNull().references(() => recommendationRuns.id),
  assetClass: varchar("asset_class", { length: 64 }).notNull(),
  amountCad: numeric("amount_cad", { precision: 14, scale: 2 }).notNull(),
  targetAccountType: varchar("target_account_type", { length: 24 }).notNull(),
  securitySymbol: varchar("security_symbol", { length: 32 }),
  securityName: varchar("security_name", { length: 160 }),
  securityScore: numeric("security_score", { precision: 6, scale: 2 }),
  allocationGapBeforePct: numeric("allocation_gap_before_pct", { precision: 7, scale: 2 }),
  allocationGapAfterPct: numeric("allocation_gap_after_pct", { precision: 7, scale: 2 }),
  accountFitScore: numeric("account_fit_score", { precision: 6, scale: 2 }),
  taxFitScore: numeric("tax_fit_score", { precision: 6, scale: 2 }),
  fxFrictionPenaltyBps: integer("fx_friction_penalty_bps"),
  tickerOptions: jsonb("ticker_options").notNull(),
  explanation: text("explanation").notNull(),
  rationale: jsonb("rationale"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const portfolioEvents = pgTable("portfolio_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id),
  accountId: uuid("account_id").notNull().references(() => investmentAccounts.id),
  symbol: varchar("symbol", { length: 32 }),
  eventType: varchar("event_type", { length: 32 }).notNull(),
  quantity: numeric("quantity", { precision: 18, scale: 6 }),
  priceAmount: numeric("price_amount", { precision: 14, scale: 4 }),
  currency: varchar("currency", { length: 3 }),
  bookedAt: date("booked_at").notNull(),
  effectiveAt: timestamp("effective_at", { withTimezone: true }).notNull(),
  source: varchar("source", { length: 32 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const securityPriceHistory = pgTable("security_price_history", {
  id: uuid("id").defaultRandom().primaryKey(),
  symbol: varchar("symbol", { length: 32 }).notNull(),
  priceDate: date("price_date").notNull(),
  close: numeric("close", { precision: 14, scale: 4 }).notNull(),
  adjustedClose: numeric("adjusted_close", { precision: 14, scale: 4 }),
  currency: varchar("currency", { length: 3 }).notNull().default("CAD"),
  source: varchar("source", { length: 32 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => ({
  symbolDateIdx: uniqueIndex("security_price_history_symbol_date_idx").on(table.symbol, table.priceDate)
}));

export const portfolioSnapshots = pgTable("portfolio_snapshots", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id),
  snapshotDate: date("snapshot_date").notNull(),
  totalValueCad: numeric("total_value_cad", { precision: 14, scale: 2 }).notNull(),
  accountBreakdownJson: jsonb("account_breakdown_json").notNull(),
  holdingBreakdownJson: jsonb("holding_breakdown_json").notNull(),
  sourceVersion: varchar("source_version", { length: 32 }).notNull().default("v1"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => ({
  userSnapshotDateIdx: uniqueIndex("portfolio_snapshots_user_date_idx").on(table.userId, table.snapshotDate)
}));

export const importJobs = pgTable("import_jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id),
  workflow: varchar("workflow", { length: 32 }).notNull().default("portfolio"),
  status: varchar("status", { length: 24 }).notNull(),
  sourceType: varchar("source_type", { length: 24 }).notNull(),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const importMappingPresets = pgTable("import_mapping_presets", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id),
  name: varchar("name", { length: 120 }).notNull(),
  sourceType: varchar("source_type", { length: 24 }).notNull(),
  mapping: jsonb("mapping").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => ({
  userPresetUniqueIdx: uniqueIndex("import_mapping_presets_user_name_idx").on(table.userId, table.name)
}));
