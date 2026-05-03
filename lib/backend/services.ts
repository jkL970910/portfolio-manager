import { hash } from "bcryptjs";
import { and, desc, eq, sql } from "drizzle-orm";
import { apiSuccess } from "@/lib/backend/contracts";
import type { PortfolioHoldingDetailData } from "@/lib/contracts";
import {
  ImportFieldMapping,
  ImportValidationError,
  ParsedCsvImport,
  parseImportCsv,
} from "@/lib/backend/csv-import";
import { getRepositories } from "@/lib/backend/repositories/factory";
import {
  AllocationTarget,
  CashflowTransaction,
  CitizenAddressTier,
  CitizenGender,
  CitizenProfile,
  CitizenRank,
  CurrencyCode,
  DisplayLanguage,
  GuidedAllocationAnswers,
  GuidedAllocationDraft,
  PreferenceProfile,
  PreferenceProfileSource,
  RecommendationConstraints,
  RecommendationRun,
  RiskProfile,
  TransitionPreference,
  RecommendationStrategy,
  AccountType,
  UserProfile,
} from "@/lib/backend/models";
import {
  buildPortfolioAccountDetailData,
  buildPortfolioHoldingDetailData,
  buildPortfolioSecurityDetailData,
  buildDashboardData,
  buildImportData,
  buildPortfolioData,
  buildRecommendationsData,
  buildSettingsData,
  buildSpendingData,
} from "@/lib/backend/view-builders";
import {
  buildRecommendationV2,
  scoreCandidateSecurity,
} from "@/lib/backend/recommendation-v2";
import {
  DEFAULT_RECOMMENDATION_CONSTRAINTS,
  normalizeRecommendationConstraints,
} from "@/lib/backend/recommendation-constraints";
import {
  DEFAULT_PREFERENCE_FACTORS,
  normalizePreferenceFactors,
} from "@/lib/backend/preference-factors";
import { getDb } from "@/lib/db/client";
import {
  allocationTargets,
  cashflowTransactions,
  citizenProfiles,
  guidedAllocationDrafts,
  holdingPositions,
  importJobs,
  importMappingPresets,
  investmentAccounts,
  cashAccounts,
  cashAccountBalanceEvents,
  portfolioEditLogs,
  portfolioEvents,
  portfolioSnapshots,
  preferenceProfiles,
  recommendationItems,
  recommendationRuns,
  securityPriceHistory,
  users,
} from "@/lib/db/schema";
import type {
  HoldingPosition,
  ImportJob,
  ImportMappingPreset,
  InvestmentAccount,
  SecurityPriceHistoryPoint,
} from "@/lib/backend/models";
import {
  convertCurrencyAmount,
  getStoredOrFallbackFxContext,
} from "@/lib/market-data/fx";
import {
  getSecurityHistoricalSeries,
  getSecurityQuote,
  resolveSecurity,
} from "@/lib/market-data/service";
import { resolveCanonicalSecurityIdentity } from "@/lib/market-data/security-identity";
import { inferEconomicAssetClass } from "@/lib/backend/security-economic-exposure";
import type {
  SecurityQuote,
  SecurityResolution,
} from "@/lib/market-data/types";
import { getProviderLimitSnapshot } from "@/lib/market-data/provider-limits";
import { getAssetClassLabel } from "@/lib/i18n/finance";
import { pick } from "@/lib/i18n/ui";

type DbTransaction = Parameters<
  Parameters<ReturnType<typeof getDb>["transaction"]>[0]
>[0];

export interface PreferenceProfileInput {
  riskProfile: RiskProfile;
  targetAllocation: AllocationTarget[];
  accountFundingPriority: AccountType[];
  taxAwarePlacement: boolean;
  cashBufferTargetCad: number;
  transitionPreference: TransitionPreference;
  recommendationStrategy: RecommendationStrategy;
  source?: PreferenceProfileSource;
  rebalancingTolerancePct: number;
  watchlistSymbols: string[];
  recommendationConstraints?: RecommendationConstraints;
  preferenceFactors?: unknown;
}

export interface RegisterUserInput {
  email: string;
  password: string;
  displayName: string;
  mode?: "standard" | "loo-zh";
  gender?: CitizenGender;
  birthDate?: string;
  acceptLooTerms?: boolean;
  displayLanguage?: DisplayLanguage;
}

export interface SaveGuidedAllocationDraftInput {
  answers: GuidedAllocationAnswers;
  suggestedProfile: Omit<
    PreferenceProfile,
    | "id"
    | "userId"
    | "watchlistSymbols"
    | "recommendationConstraints"
    | "preferenceFactors"
  >;
  assumptions: string[];
  rationale: string[];
}

export interface UpdateDisplayCurrencyInput {
  currency: CurrencyCode;
}

export interface UpdateDisplayLanguageInput {
  language: DisplayLanguage;
}

export interface UpdateCitizenOverrideInput {
  rank?: CitizenRank | null;
  addressTier?: CitizenAddressTier | null;
  idCode?: string | null;
}

export interface UpdateHoldingPositionInput {
  name?: string;
  accountId?: string;
  currency?: CurrencyCode;
  quantity?: number | null;
  avgCostPerShareAmount?: number | null;
  costBasisAmount?: number | null;
  lastPriceAmount?: number | null;
  marketValueAmount?: number | null;
  assetClassOverride?: string | null;
  sectorOverride?: string | null;
  securityTypeOverride?: string | null;
  exchangeOverride?: string | null;
  marketSectorOverride?: string | null;
}

export interface CreateHoldingPositionInput {
  symbol: string;
  name?: string;
  currency?: CurrencyCode;
  quantity?: number | null;
  avgCostPerShareAmount?: number | null;
  costBasisAmount?: number | null;
  lastPriceAmount?: number | null;
  marketValueAmount?: number | null;
  assetClass: string;
  sector?: string | null;
  securityType?: string | null;
  exchange?: string | null;
  marketSector?: string | null;
}

export interface UpdateInvestmentAccountInput {
  nickname?: string;
  institution?: string;
  type?: AccountType;
  currency?: CurrencyCode;
  contributionRoomCad?: number | null;
}

export interface MergeAccountsPreviewResult {
  source: {
    id: string;
    name: string;
    type: AccountType;
    valueCad: number;
    holdingCount: number;
  };
  target: {
    id: string;
    name: string;
    type: AccountType;
    valueCad: number;
    holdingCount: number;
  };
  mergedValueCad: number;
  movedHoldingCount: number;
  warnings: string[];
}

export interface CreateImportJobInput {
  fileName: string;
  workflow: "portfolio" | "spending";
  sourceType: "csv";
  csvContent?: string;
  fieldMapping?: ImportFieldMapping;
  symbolCorrections?: Record<string, { symbol: string; name?: string }>;
  importMode: "replace" | "merge";
  dryRun: boolean;
}

export interface CreateImportJobResult {
  job: ImportJob;
  summary: {
    accountsImported: number;
    holdingsImported: number;
    transactionsImported: number;
  };
  validationErrors: ImportValidationError[];
  autoRecommendationRun: {
    id: string;
    contributionAmountCad: number;
    itemCount: number;
  } | null;
  review: {
    importMode: "replace" | "merge";
    detectedHeaders: string[];
    rowCount: number;
  };
}

export interface RefreshPortfolioQuotesResult {
  refreshedHoldingCount: number;
  missingQuoteCount: number;
  sampledSymbolCount: number;
  historyPointCount: number;
  snapshotRecorded: boolean;
  fxRateLabel: string;
  fxAsOf: string | null;
  fxSource: string;
  fxFreshness: "fresh" | "stale" | "fallback";
  refreshedAt: string;
}

export interface CreateRecommendationRunInput {
  contributionAmountCad: number;
}

export interface ScoreCandidateSecurityInput {
  symbol: string;
  name?: string;
  currency?: CurrencyCode;
  assetClass?: string;
  securityType?: string | null;
}

export interface SaveImportMappingPresetInput {
  name: string;
  sourceType: "csv";
  mapping: Record<string, string>;
}

export interface UpdateImportMappingPresetInput {
  name?: string;
  sourceType?: "csv";
  mapping?: Record<string, string>;
}

export interface CreateGuidedImportInput {
  accountMode: "new" | "existing";
  existingAccountId?: string;
  accountType: AccountType;
  method: "single-account-csv" | "manual-entry" | "continue-later";
  institution: string;
  nickname: string;
  currency: CurrencyCode;
  contributionRoomCad: number;
  initialMarketValueAmount: number;
  holdings?: Array<{
    symbol: string;
    holdingName?: string;
    exchange?: string | null;
    assetClass: string;
    sector?: string;
    currency: CurrencyCode;
    quantity?: number | null;
    avgCostPerShareAmount?: number | null;
    costBasisAmount?: number | null;
    lastPriceAmount?: number | null;
    marketValueAmount?: number | null;
  }>;
}

export interface CreateManualInvestmentAccountInput {
  accountType: AccountType;
  institution: string;
  nickname: string;
  currency: CurrencyCode;
  contributionRoomCad: number;
  initialMarketValueAmount: number;
}

export interface CreateGuidedImportResult {
  account: InvestmentAccount;
  importJob: ImportJob | null;
  createdHoldingSymbol: string | null;
  autoRecommendationRun: {
    id: string;
    contributionAmountCad: number;
    itemCount: number;
  } | null;
}

export async function createManualInvestmentAccount(
  userId: string,
  input: CreateManualInvestmentAccountInput,
): Promise<InvestmentAccount> {
  const [accountRow] = await getDb()
    .insert(investmentAccounts)
    .values({
      userId,
      institution: input.institution,
      type: input.accountType,
      nickname: input.nickname,
      currency: input.currency,
      marketValueAmount: input.initialMarketValueAmount.toFixed(2),
      marketValueCad: (
        (await toCadAmount(input.initialMarketValueAmount, input.currency)) ?? 0
      ).toFixed(2),
      contributionRoomCad: input.contributionRoomCad.toFixed(2),
    })
    .returning();

  return {
    id: accountRow.id,
    userId: accountRow.userId,
    institution: accountRow.institution,
    type: accountRow.type as AccountType,
    nickname: accountRow.nickname,
    currency: accountRow.currency as CurrencyCode,
    marketValueAmount: Number(accountRow.marketValueAmount),
    marketValueCad: Number(accountRow.marketValueCad),
    contributionRoomCad:
      accountRow.contributionRoomCad == null
        ? null
        : Number(accountRow.contributionRoomCad),
  };
}

const DEFAULT_TARGETS_BY_RISK: Record<RiskProfile, AllocationTarget[]> = {
  Conservative: [
    { assetClass: "Canadian Equity", targetPct: 18 },
    { assetClass: "US Equity", targetPct: 22 },
    { assetClass: "International Equity", targetPct: 10 },
    { assetClass: "Fixed Income", targetPct: 35 },
    { assetClass: "Cash", targetPct: 15 },
  ],
  Balanced: [
    { assetClass: "Canadian Equity", targetPct: 22 },
    { assetClass: "US Equity", targetPct: 32 },
    { assetClass: "International Equity", targetPct: 16 },
    { assetClass: "Fixed Income", targetPct: 20 },
    { assetClass: "Cash", targetPct: 10 },
  ],
  Growth: [
    { assetClass: "Canadian Equity", targetPct: 16 },
    { assetClass: "US Equity", targetPct: 42 },
    { assetClass: "International Equity", targetPct: 22 },
    { assetClass: "Fixed Income", targetPct: 10 },
    { assetClass: "Cash", targetPct: 10 },
  ],
};

function getDefaultPreferenceInput(
  riskProfile: RiskProfile = "Balanced",
): PreferenceProfileInput {
  return {
    riskProfile,
    targetAllocation: DEFAULT_TARGETS_BY_RISK[riskProfile],
    accountFundingPriority: ["TFSA", "RRSP", "Taxable"],
    taxAwarePlacement: true,
    cashBufferTargetCad: 10000,
    transitionPreference: "gradual",
    recommendationStrategy: "balanced",
    source: "manual",
    rebalancingTolerancePct: 5,
    watchlistSymbols: [],
    recommendationConstraints: DEFAULT_RECOMMENDATION_CONSTRAINTS,
    preferenceFactors: DEFAULT_PREFERENCE_FACTORS,
  };
}

async function resolveRecommendationConstraintSymbols(
  input: unknown,
): Promise<RecommendationConstraints> {
  const constraints = normalizeRecommendationConstraints(input);
  async function resolveIdentity(symbol: string) {
    const resolved = await resolveSecurity(symbol);
    if (resolved.result.symbol.trim().toUpperCase() !== symbol) {
      throw new Error(
        `Recommendation constraint symbol ${symbol} could not be resolved safely.`,
      );
    }
    return resolved.result;
  }

  const excludedSecurities = await Promise.all(
    constraints.excludedSymbols.map(async (symbol) => {
      const existing = constraints.excludedSecurities.find(
        (item) => item.symbol === symbol,
      );
      const resolved = await resolveIdentity(symbol);
      return {
        symbol,
        exchange: existing?.exchange ?? resolved.exchange ?? null,
        currency: existing?.currency ?? null,
        name: existing?.name ?? resolved.name ?? symbol,
        provider: resolved.provider,
      };
    }),
  );
  const preferredSecurities = await Promise.all(
    constraints.preferredSymbols.map(async (symbol) => {
      const existing = constraints.preferredSecurities.find(
        (item) => item.symbol === symbol,
      );
      const resolved = await resolveIdentity(symbol);
      return {
        symbol,
        exchange: existing?.exchange ?? resolved.exchange ?? null,
        currency: existing?.currency ?? null,
        name: existing?.name ?? resolved.name ?? symbol,
        provider: resolved.provider,
      };
    }),
  );

  return {
    ...constraints,
    excludedSecurities,
    preferredSecurities,
  };
}

type CitizenTier = {
  rank: CitizenRank;
  addressTier: CitizenAddressTier;
};

function getCitizenTierByWealth(totalPortfolioCad: number): CitizenTier {
  if (totalPortfolioCad < 5000) {
    return { rank: "lowly-ox", addressTier: "cowshed" };
  }
  if (totalPortfolioCad < 10000) {
    return { rank: "base-loo", addressTier: "suburbs" };
  }
  if (totalPortfolioCad < 20000) {
    return { rank: "citizen", addressTier: "city" };
  }
  return { rank: "general", addressTier: "palace-gate" };
}

function getCitizenAvatarType(gender: CitizenGender | null) {
  if (gender === "male") {
    return "male" as const;
  }
  if (gender === "female") {
    return "female" as const;
  }
  return "default" as const;
}

function buildCitizenIdCode(rank: CitizenRank) {
  const poolByRank: Record<CitizenRank, string[]> = {
    "lowly-ox": ["1042", "1827", "2314", "3471", "4128"],
    "base-loo": ["5518", "5668", "5788", "6018", "6682"],
    citizen: ["7788", "7866", "8088", "8188", "8688"],
    general: ["8866", "8886", "8998", "9666", "9888"],
    emperor: ["8888", "9999", "6666", "88888", "99999"],
  };
  const pool = poolByRank[rank];
  const suffix = pool[Math.floor(Math.random() * pool.length)] ?? "1042";
  const yearSuffix = new Date().getUTCFullYear().toString().slice(-2);
  return `LOO${yearSuffix}${suffix}`;
}

async function getTotalPortfolioValueCad(userId: string) {
  const accounts = await getRepositories().accounts.listByUserId(userId);
  return round(
    accounts.reduce((sum, account) => sum + account.marketValueCad, 0),
  );
}

function mapCitizenProfileRow(
  row: typeof citizenProfiles.$inferSelect,
): Omit<
  CitizenProfile,
  "effectiveRank" | "effectiveAddressTier" | "effectiveIdCode"
> {
  return {
    id: row.id,
    userId: row.userId,
    citizenName: row.citizenName,
    gender: (row.gender as CitizenGender | null) ?? null,
    birthDate: row.birthDate,
    avatarType: row.avatarType as CitizenProfile["avatarType"],
    derivedRank: row.derivedRank as CitizenRank,
    derivedAddressTier: row.derivedAddressTier as CitizenAddressTier,
    derivedIdCode: row.derivedIdCode,
    overrideRank: (row.overrideRank as CitizenRank | null) ?? null,
    overrideAddressTier:
      (row.overrideAddressTier as CitizenAddressTier | null) ?? null,
    overrideIdCode: row.overrideIdCode ?? null,
    wealthScoreSnapshotCad: toNumber(row.wealthScoreSnapshotCad),
    issuedAt: row.issuedAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function applyEffectiveCitizenValues(
  citizen: Omit<
    CitizenProfile,
    "effectiveRank" | "effectiveAddressTier" | "effectiveIdCode"
  >,
): CitizenProfile {
  return {
    ...citizen,
    effectiveRank: citizen.overrideRank ?? citizen.derivedRank,
    effectiveAddressTier:
      citizen.overrideAddressTier ?? citizen.derivedAddressTier,
    effectiveIdCode: citizen.overrideIdCode ?? citizen.derivedIdCode,
  };
}

async function ensureCitizenProfile(
  userId: string,
  options?: {
    citizenName?: string;
    gender?: CitizenGender | null;
    birthDate?: string | null;
  },
) {
  const db = getDb();
  const existing = await db.query.citizenProfiles.findFirst({
    where: eq(citizenProfiles.userId, userId),
  });
  const wealthScoreSnapshotCad = await getTotalPortfolioValueCad(userId);
  const tier = getCitizenTierByWealth(wealthScoreSnapshotCad);

  if (!existing) {
    const user = await getRepositories().users.getById(userId);
    const [created] = await db
      .insert(citizenProfiles)
      .values({
        userId,
        citizenName: options?.citizenName?.trim() || user.displayName,
        gender: options?.gender ?? null,
        birthDate: options?.birthDate ?? null,
        avatarType: getCitizenAvatarType(options?.gender ?? null),
        derivedRank: tier.rank,
        derivedAddressTier: tier.addressTier,
        derivedIdCode: buildCitizenIdCode(tier.rank),
        wealthScoreSnapshotCad: wealthScoreSnapshotCad.toFixed(2),
      })
      .returning();
    return applyEffectiveCitizenValues(mapCitizenProfileRow(created));
  }

  const mapped = mapCitizenProfileRow(existing);
  const nextDerivedRank = tier.rank;
  const nextDerivedAddressTier = tier.addressTier;
  const nextDerivedIdCode =
    mapped.derivedRank === nextDerivedRank && mapped.derivedIdCode
      ? mapped.derivedIdCode
      : buildCitizenIdCode(nextDerivedRank);

  const [updated] = await db
    .update(citizenProfiles)
    .set({
      citizenName: options?.citizenName?.trim() || mapped.citizenName,
      gender: options?.gender ?? mapped.gender,
      birthDate: options?.birthDate ?? mapped.birthDate,
      avatarType: getCitizenAvatarType(
        options?.gender ?? mapped.gender ?? null,
      ),
      derivedRank: nextDerivedRank,
      derivedAddressTier: nextDerivedAddressTier,
      derivedIdCode: nextDerivedIdCode,
      wealthScoreSnapshotCad: wealthScoreSnapshotCad.toFixed(2),
      updatedAt: new Date(),
    })
    .where(eq(citizenProfiles.id, existing.id))
    .returning();

  return applyEffectiveCitizenValues(mapCitizenProfileRow(updated));
}

function getAdminEmails() {
  const configured = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  if (configured.length > 0) {
    return configured;
  }

  if (process.env.NODE_ENV !== "production") {
    return ["jiekun@example.com", "casey@example.com"];
  }

  return [];
}

export async function isViewerAdmin(userId: string) {
  const user = await getRepositories().users.getById(userId);
  return getAdminEmails().includes(user.email.toLowerCase());
}

export async function getCitizenProfile(userId: string) {
  return ensureCitizenProfile(userId);
}

function createEmptyRun(userId: string): RecommendationRun {
  return {
    id: "pending-run",
    userId,
    contributionAmountCad: 0,
    createdAt: new Date().toISOString(),
    engineVersion: "v2.1",
    objective: "target-tracking",
    confidenceScore: null,
    assumptions: [
      "No recommendation run has been generated yet.",
      "Import holdings and save preferences to unlock a ranked funding plan.",
    ],
    notes: [],
    items: [],
  };
}

function getAutoRecommendationAmount(
  profile: PreferenceProfile,
  transactions: CashflowTransaction[],
) {
  const latestMonth = transactions
    .map((transaction) => transaction.bookedAt.slice(0, 7))
    .sort()
    .at(-1);

  if (!latestMonth) {
    return 5000;
  }

  const monthTransactions = transactions.filter((transaction) =>
    transaction.bookedAt.startsWith(latestMonth),
  );
  const inflows = monthTransactions
    .filter((transaction) => transaction.direction === "inflow")
    .reduce((sum, transaction) => sum + transaction.amountCad, 0);
  const outflows = monthTransactions
    .filter((transaction) => transaction.direction === "outflow")
    .reduce((sum, transaction) => sum + transaction.amountCad, 0);
  const investable = Math.max(
    0,
    inflows - outflows - profile.cashBufferTargetCad / 12,
  );
  const rounded = Math.round(investable / 500) * 500;
  return Math.max(rounded || 0, 2500);
}

function accountMatchKey(account: {
  institution: string;
  type: AccountType;
  nickname: string;
}) {
  return `${account.institution.toLowerCase()}::${account.type}::${account.nickname.toLowerCase()}`;
}

function holdingMatchKey(
  accountId: string,
  symbol: string,
  currency: CurrencyCode,
  exchange?: string | null,
) {
  return `${accountId}::${holdingIdentityKey(symbol, currency, exchange)}`;
}

function transactionMatchKey(transaction: {
  accountId: string | null;
  bookedAt: string;
  merchant: string;
  category: string;
  amountCad: number;
  direction: "inflow" | "outflow";
}) {
  return `${transaction.accountId ?? "none"}::${transaction.bookedAt}::${transaction.merchant.toLowerCase()}::${transaction.category.toLowerCase()}::${transaction.amountCad.toFixed(2)}::${transaction.direction}`;
}

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function toNumber(value: string | number | null | undefined) {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    return Number(value);
  }
  return 0;
}

function normalizeCurrencyCode(value: string): CurrencyCode {
  return value === "USD" ? "USD" : "CAD";
}

function normalizeExchangeCode(value: string | null | undefined) {
  return value?.trim().toUpperCase() || "";
}

async function resolveSecurityIdentityForHolding(holding: HoldingPosition) {
  if (holding.securityId) {
    const existing = await getRepositories().securities.getById(
      holding.securityId,
    );
    if (existing) {
      return existing;
    }
  }

  return resolveCanonicalSecurityIdentity({
    symbol: holding.symbol,
    exchange: holding.exchangeOverride ?? holding.quoteExchange ?? null,
    currency: holding.currency ?? holding.quoteCurrency ?? "CAD",
    name: holding.name,
    securityType: holding.securityTypeOverride ?? null,
    marketSector: holding.marketSectorOverride ?? null,
    provider: holding.quoteProvider ?? null,
  });
}

function parseProviderTimestamp(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getQuoteSourceMode(quote: SecurityQuote) {
  return quote.provider === "fallback" ? "fallback" : "provider";
}

function getQuoteStatus(quote: SecurityQuote) {
  return quote.provider === "fallback" ? "fallback" : "fresh";
}

function getMissingQuoteStatus(holding: typeof holdingPositions.$inferSelect) {
  const activeProviderLimit = getProviderLimitSnapshot().some(
    (item) => item.limited,
  );
  if (activeProviderLimit) {
    return {
      sourceMode: "stale-cache",
      status: "provider-limited",
      errorCode: "provider-limited",
      errorMessage:
        "Provider is temporarily limited; existing price was preserved.",
    };
  }

  if (holding.lastPriceAmount != null && Number(holding.lastPriceAmount) > 0) {
    return {
      sourceMode: "stale-cache",
      status: "stale",
      errorCode: "no-current-quote",
      errorMessage:
        "No current quote returned; previous usable price was preserved.",
    };
  }

  return {
    sourceMode: "missing",
    status: "missing",
    errorCode: "no-quote",
    errorMessage: "No usable quote was returned for this holding identity.",
  };
}

async function buildServiceDisplayContext(currency: CurrencyCode) {
  const [cadToDisplayFx, usdToCadFx] = await Promise.all([
    getStoredOrFallbackFxContext("CAD", currency),
    getStoredOrFallbackFxContext("USD", "CAD"),
  ]);

  return {
    currency,
    cadToDisplayRate: cadToDisplayFx.rate,
    usdToCadRate: usdToCadFx.rate,
    fxRateDate: usdToCadFx.rateDate,
    fxRateSource: usdToCadFx.source,
    fxRateFreshness: usdToCadFx.freshness,
  } as const;
}

function formatFxRefreshLabel(input: {
  rate: number;
  rateDate: string | null;
  source: string;
  freshness: "fresh" | "stale" | "fallback";
}) {
  const freshnessLabel =
    input.freshness === "fresh"
      ? "最新"
      : input.freshness === "stale"
        ? "可能过期"
        : "保守兜底";
  const sourceLabel =
    input.source === "fallback-static" ? "本地保守兜底" : input.source;
  return `USD/CAD ${input.rate.toFixed(4)} · ${freshnessLabel} · 日期 ${input.rateDate ?? "暂无"} · 来源 ${sourceLabel}`;
}

function holdingIdentityKey(
  symbol: string,
  currency: CurrencyCode,
  exchange?: string | null,
) {
  return `${symbol.trim().toUpperCase()}::${currency}::${exchange?.trim().toUpperCase() || ""}`;
}

async function toCadAmount(
  amount: number | null | undefined,
  currency: CurrencyCode,
) {
  if (amount == null || !Number.isFinite(amount)) {
    return null;
  }
  return currency === "CAD"
    ? round(amount)
    : round(await convertCurrencyAmount(amount, currency, "CAD"));
}

async function normalizeManualHolding(
  input: NonNullable<CreateGuidedImportInput["holdings"]>[number],
) {
  const quantity = input.quantity ?? null;
  const currency = normalizeCurrencyCode(input.currency);
  const avgCostPerShareAmount = input.avgCostPerShareAmount ?? null;
  const explicitCostBasisAmount = input.costBasisAmount ?? null;
  const lastPriceAmount = input.lastPriceAmount ?? null;
  const explicitMarketValueAmount = input.marketValueAmount ?? null;
  const costBasisAmount =
    explicitCostBasisAmount ??
    (quantity != null && avgCostPerShareAmount != null
      ? round(quantity * avgCostPerShareAmount)
      : null);
  const marketValueAmount =
    explicitMarketValueAmount ??
    (quantity != null && lastPriceAmount != null
      ? round(quantity * lastPriceAmount)
      : null);

  if (marketValueAmount == null || marketValueAmount <= 0) {
    throw new Error(
      `Holding ${input.symbol.toUpperCase()} requires market value or quantity plus current price.`,
    );
  }

  const avgCostPerShareCad = await toCadAmount(avgCostPerShareAmount, currency);
  const costBasisCad = await toCadAmount(costBasisAmount, currency);
  const lastPriceCad = await toCadAmount(lastPriceAmount, currency);
  const marketValueCad = (await toCadAmount(marketValueAmount, currency)) ?? 0;

  const gainLossPct =
    costBasisCad != null && costBasisCad > 0
      ? round(((marketValueCad - costBasisCad) / costBasisCad) * 100, 2)
      : 0;

  return {
    symbol: input.symbol.trim().toUpperCase(),
    name: input.holdingName?.trim() || input.symbol.trim().toUpperCase(),
    exchange: input.exchange?.trim() || null,
    assetClass: input.assetClass,
    sector: input.sector?.trim() || "Multi-sector",
    currency,
    quantity,
    avgCostPerShareAmount,
    costBasisAmount,
    lastPriceAmount,
    marketValueAmount,
    avgCostPerShareCad,
    costBasisCad,
    lastPriceCad,
    marketValueCad,
    gainLossPct,
  };
}

async function recalculatePortfolioState(
  tx: DbTransaction,
  userId: string,
  options: {
    refreshRunId?: string | null;
    sourceMode?: string;
    freshness?: string;
  } = {},
) {
  const refreshedHoldings = await tx
    .select()
    .from(holdingPositions)
    .where(eq(holdingPositions.userId, userId));
  const totalPortfolioCad = refreshedHoldings.reduce(
    (sum: number, holding: typeof holdingPositions.$inferSelect) =>
      sum + Number(holding.marketValueCad),
    0,
  );
  const holdingsByAccount = new Map<string, typeof refreshedHoldings>();

  for (const holding of refreshedHoldings) {
    const group = holdingsByAccount.get(holding.accountId) ?? [];
    group.push(holding);
    holdingsByAccount.set(holding.accountId, group);
  }

  const refreshedAt = new Date();

  for (const holding of refreshedHoldings) {
    const weightPct =
      totalPortfolioCad > 0
        ? round((Number(holding.marketValueCad) / totalPortfolioCad) * 100, 2)
        : 0;
    await tx
      .update(holdingPositions)
      .set({
        weightPct: weightPct.toFixed(2),
        updatedAt: refreshedAt,
      })
      .where(eq(holdingPositions.id, holding.id));
  }

  const allAccounts = await tx
    .select()
    .from(investmentAccounts)
    .where(eq(investmentAccounts.userId, userId));

  for (const account of allAccounts) {
    const accountHoldings = holdingsByAccount.get(account.id) ?? [];
    const accountTotalCad = accountHoldings.reduce(
      (sum: number, holding: typeof holdingPositions.$inferSelect) =>
        sum + Number(holding.marketValueCad),
      0,
    );
    const accountCurrency = normalizeCurrencyCode(
      (account.currency as string) || "CAD",
    );
    const accountTotalAmount =
      accountTotalCad > 0
        ? (await convertCurrencyAmount(
            accountTotalCad,
            "CAD",
            accountCurrency,
          )) || accountTotalCad
        : 0;

    await tx
      .update(investmentAccounts)
      .set({
        marketValueAmount: accountTotalAmount.toFixed(2),
        marketValueCad: accountTotalCad.toFixed(2),
        updatedAt: refreshedAt,
      })
      .where(eq(investmentAccounts.id, account.id));
  }

  await upsertCurrentPortfolioSnapshot(tx, userId, options);
}

async function createPortfolioEditLog(
  tx: DbTransaction,
  userId: string,
  entityType: "holding" | "account" | "account-merge",
  entityId: string,
  action: string,
  summary: string,
  payload: Record<string, unknown>,
) {
  await tx.insert(portfolioEditLogs).values({
    userId,
    entityType,
    entityId,
    action,
    summary,
    payload,
  });
}

async function createPortfolioEvent(
  tx: DbTransaction,
  input: {
    userId: string;
    accountId: string;
    symbol: string;
    eventType: string;
    quantity?: number | null;
    priceAmount?: number | null;
    currency?: CurrencyCode | null;
    source?: string;
    bookedAt?: string;
  },
) {
  const normalizedSymbol = input.symbol.trim().toUpperCase();
  if (!normalizedSymbol) {
    return;
  }

  await tx.insert(portfolioEvents).values({
    userId: input.userId,
    accountId: input.accountId,
    symbol: normalizedSymbol,
    eventType: input.eventType,
    quantity: input.quantity == null ? null : input.quantity.toFixed(6),
    priceAmount:
      input.priceAmount == null ? null : input.priceAmount.toFixed(4),
    currency: input.currency ?? null,
    bookedAt: input.bookedAt ?? new Date().toISOString().slice(0, 10),
    effectiveAt: new Date(),
    source: input.source ?? "user-edit",
  });
}

async function upsertCurrentPortfolioSnapshot(
  tx: DbTransaction,
  userId: string,
  options: {
    refreshRunId?: string | null;
    sourceMode?: string;
    freshness?: string;
  } = {},
) {
  const accounts = await tx.query.investmentAccounts.findMany({
    where: eq(investmentAccounts.userId, userId),
  });
  const holdings = await tx.query.holdingPositions.findMany({
    where: eq(holdingPositions.userId, userId),
  });
  const snapshotDate = new Date().toISOString().slice(0, 10);
  const totalValueCad = holdings.reduce(
    (sum, holding) => sum + Number(holding.marketValueCad),
    0,
  );
  const accountBreakdownJson = Object.fromEntries(
    accounts.map((account) => [
      account.id,
      holdings
        .filter((holding) => holding.accountId === account.id)
        .reduce((sum, holding) => sum + Number(holding.marketValueCad), 0),
    ]),
  );
  const holdingBreakdownJson = Object.fromEntries(
    holdings.map((holding) => [holding.id, Number(holding.marketValueCad)]),
  );
  const existing = await tx.query.portfolioSnapshots.findFirst({
    where: and(
      eq(portfolioSnapshots.userId, userId),
      eq(portfolioSnapshots.snapshotDate, snapshotDate),
    ),
  });

  if (existing) {
    await tx
      .update(portfolioSnapshots)
      .set({
        totalValueCad: totalValueCad.toFixed(2),
        accountBreakdownJson,
        holdingBreakdownJson,
        sourceVersion: "runtime-v1",
        sourceMode: options.sourceMode ?? "snapshot",
        freshness: options.freshness ?? "fresh",
        refreshRunId: options.refreshRunId ?? null,
        isReference: false,
        fallbackReason: null,
      })
      .where(eq(portfolioSnapshots.id, existing.id));
    return;
  }

  await tx.insert(portfolioSnapshots).values({
    userId,
    snapshotDate,
    totalValueCad: totalValueCad.toFixed(2),
    accountBreakdownJson,
    holdingBreakdownJson,
    sourceVersion: "runtime-v1",
    sourceMode: options.sourceMode ?? "snapshot",
    freshness: options.freshness ?? "fresh",
    refreshRunId: options.refreshRunId ?? null,
    isReference: false,
    fallbackReason: null,
  });
}

async function rebuildDerivedCashBalanceHistory(
  tx: DbTransaction,
  userId: string,
) {
  const derivedInstitution = "Imported cash flow";
  const derivedNickname = "Spending balance";
  const transactions = await tx.query.cashflowTransactions.findMany({
    where: eq(cashflowTransactions.userId, userId),
    orderBy: desc(cashflowTransactions.bookedAt),
  });

  const sortedTransactions = [...transactions].sort((left, right) =>
    left.bookedAt.localeCompare(right.bookedAt),
  );
  const existingCashAccount = await tx.query.cashAccounts.findFirst({
    where: and(
      eq(cashAccounts.userId, userId),
      eq(cashAccounts.institution, derivedInstitution),
      eq(cashAccounts.nickname, derivedNickname),
    ),
  });

  const [cashAccount] = existingCashAccount
    ? [existingCashAccount]
    : await tx
        .insert(cashAccounts)
        .values({
          userId,
          institution: derivedInstitution,
          nickname: derivedNickname,
          currency: "CAD",
          currentBalanceAmount: "0.00",
          currentBalanceCad: "0.00",
        })
        .returning();

  await tx
    .delete(cashAccountBalanceEvents)
    .where(
      and(
        eq(cashAccountBalanceEvents.userId, userId),
        eq(cashAccountBalanceEvents.cashAccountId, cashAccount.id),
      ),
    );

  let runningBalance = 0;
  const groupedByDate = new Map<string, number>();
  for (const transaction of sortedTransactions) {
    const delta =
      transaction.direction === "inflow"
        ? Number(transaction.amountCad)
        : -Number(transaction.amountCad);
    groupedByDate.set(
      transaction.bookedAt,
      (groupedByDate.get(transaction.bookedAt) ?? 0) + delta,
    );
  }

  const dailyBalances = [...groupedByDate.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([bookedAt, delta]) => {
      runningBalance += delta;
      return {
        userId,
        cashAccountId: cashAccount.id,
        bookedAt,
        balanceAmount: runningBalance.toFixed(2),
        balanceCad: runningBalance.toFixed(2),
        source: "derived-transaction",
      };
    });

  if (dailyBalances.length > 0) {
    await tx.insert(cashAccountBalanceEvents).values(dailyBalances);
  }

  await tx
    .update(cashAccounts)
    .set({
      currentBalanceAmount: runningBalance.toFixed(2),
      currentBalanceCad: runningBalance.toFixed(2),
      updatedAt: new Date(),
    })
    .where(eq(cashAccounts.id, cashAccount.id));
}

async function ensureDerivedCashBalanceHistory(userId: string) {
  const db = getDb();
  const [transactions, existingEvents] = await Promise.all([
    db.query.cashflowTransactions.findMany({
      where: eq(cashflowTransactions.userId, userId),
      orderBy: desc(cashflowTransactions.bookedAt),
    }),
    db.query.cashAccountBalanceEvents.findFirst({
      where: eq(cashAccountBalanceEvents.userId, userId),
    }),
  ]);

  if (transactions.length === 0 || existingEvents) {
    return;
  }

  await db.transaction(async (tx) => {
    await rebuildDerivedCashBalanceHistory(tx, userId);
  });
}

async function upsertSecurityPriceHistoryPoints(
  points: SecurityPriceHistoryPoint[],
) {
  if (points.length === 0) {
    return;
  }

  const db = getDb();
  await db
    .insert(securityPriceHistory)
    .values(
      points.map((point) => ({
        securityId: point.securityId ?? null,
        symbol: point.symbol.trim().toUpperCase(),
        exchange: normalizeExchangeCode(point.exchange),
        priceDate: point.priceDate,
        close: point.close.toFixed(4),
        adjustedClose:
          point.adjustedClose == null ? null : point.adjustedClose.toFixed(4),
        currency: point.currency,
        source: point.source,
        provider: point.provider ?? null,
        sourceMode: point.sourceMode ?? "provider",
        freshness: point.freshness ?? "fresh",
        refreshRunId: point.refreshRunId ?? null,
        isReference: point.isReference ?? false,
        fallbackReason: point.fallbackReason ?? null,
      })),
    )
    .onConflictDoUpdate({
      target: [
        securityPriceHistory.symbol,
        securityPriceHistory.exchange,
        securityPriceHistory.currency,
        securityPriceHistory.priceDate,
      ],
      set: {
        close: sql`excluded.close`,
        securityId: sql`excluded.security_id`,
        adjustedClose: sql`excluded.adjusted_close`,
        currency: sql`excluded.currency`,
        source: sql`excluded.source`,
        provider: sql`excluded.provider`,
        sourceMode: sql`excluded.source_mode`,
        freshness: sql`excluded.freshness`,
        refreshRunId: sql`excluded.refresh_run_id`,
        isReference: sql`excluded.is_reference`,
        fallbackReason: sql`excluded.fallback_reason`,
      },
    });
}

async function upsertSecurityPriceHistoryPointsInTransaction(
  tx: DbTransaction,
  points: SecurityPriceHistoryPoint[],
) {
  if (points.length === 0) {
    return;
  }

  await tx
    .insert(securityPriceHistory)
    .values(
      points.map((point) => ({
        securityId: point.securityId ?? null,
        symbol: point.symbol.trim().toUpperCase(),
        exchange: normalizeExchangeCode(point.exchange),
        priceDate: point.priceDate,
        close: point.close.toFixed(4),
        adjustedClose:
          point.adjustedClose == null ? null : point.adjustedClose.toFixed(4),
        currency: point.currency,
        source: point.source,
        provider: point.provider ?? null,
        sourceMode: point.sourceMode ?? "provider",
        freshness: point.freshness ?? "fresh",
        refreshRunId: point.refreshRunId ?? null,
        isReference: point.isReference ?? false,
        fallbackReason: point.fallbackReason ?? null,
      })),
    )
    .onConflictDoUpdate({
      target: [
        securityPriceHistory.symbol,
        securityPriceHistory.exchange,
        securityPriceHistory.currency,
        securityPriceHistory.priceDate,
      ],
      set: {
        close: sql`excluded.close`,
        securityId: sql`excluded.security_id`,
        adjustedClose: sql`excluded.adjusted_close`,
        source: sql`excluded.source`,
        provider: sql`excluded.provider`,
        sourceMode: sql`excluded.source_mode`,
        freshness: sql`excluded.freshness`,
        refreshRunId: sql`excluded.refresh_run_id`,
        isReference: sql`excluded.is_reference`,
        fallbackReason: sql`excluded.fallback_reason`,
      },
    });
}

function applySymbolCorrectionsToParsedImport(
  parsed: ParsedCsvImport,
  corrections: Record<string, { symbol: string; name?: string }> | undefined,
) {
  if (!corrections || Object.keys(corrections).length === 0) {
    return parsed;
  }

  const normalizedCorrections = new Map(
    Object.entries(corrections).map(([requestedSymbol, correction]) => [
      requestedSymbol.trim().toUpperCase(),
      {
        symbol: correction.symbol.trim().toUpperCase(),
        name: correction.name?.trim() || undefined,
      },
    ]),
  );

  return {
    ...parsed,
    holdings: parsed.holdings.map((holding) => {
      const correction = normalizedCorrections.get(
        holding.symbol.trim().toUpperCase(),
      );
      if (!correction) {
        return holding;
      }

      return {
        ...holding,
        symbol: correction.symbol,
        name: correction.name ?? holding.name,
      };
    }),
  };
}

function normalizeMappedHeader(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

function splitCsvLinePreservingQuotes(line: string) {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"') {
      if (inQuotes && nextCharacter === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += character;
  }

  values.push(current.trim());
  return values;
}

function filterCsvContentByWorkflow(
  csvContent: string,
  fieldMapping: ImportFieldMapping | undefined,
  workflow: CreateImportJobInput["workflow"],
) {
  const lines = csvContent
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim());

  if (lines.length < 2) {
    return csvContent;
  }

  const rawHeaders = splitCsvLinePreservingQuotes(lines[0]);
  const recordTypeHeader = normalizeMappedHeader(
    fieldMapping?.record_type ?? "record_type",
  );
  const recordTypeIndex = rawHeaders
    .map(normalizeMappedHeader)
    .indexOf(recordTypeHeader);

  if (recordTypeIndex === -1) {
    return csvContent;
  }

  const allowedRecordTypes =
    workflow === "spending"
      ? new Set(["transaction"])
      : new Set(["account", "holding"]);

  const keptRows = lines.slice(1).filter((line) => {
    const values = splitCsvLinePreservingQuotes(line);
    const recordType = (values[recordTypeIndex] ?? "").trim().toLowerCase();
    return allowedRecordTypes.has(recordType);
  });

  return [lines[0], ...keptRows].join("\n");
}

export async function getDashboardView(userId: string) {
  const repositories = getRepositories();
  await ensureDerivedCashBalanceHistory(userId);
  const user = await repositories.users.getById(userId);
  const [
    userAccounts,
    userHoldings,
    userTransactions,
    userCashAccounts,
    userCashBalanceEvents,
    userEvents,
    userSnapshots,
    profile,
  ] = await Promise.all([
    repositories.accounts.listByUserId(user.id),
    repositories.holdings.listByUserId(user.id),
    repositories.transactions.listByUserId(user.id),
    repositories.cashAccounts.listByUserId(user.id),
    repositories.cashAccountBalanceEvents.listByUserId(user.id),
    repositories.portfolioEvents.listByUserId(user.id),
    repositories.snapshots.listByUserId(user.id),
    repositories.preferences.getByUserId(user.id),
  ]);
  const userPriceHistory =
    await getHydratedSecurityPriceHistoryForHoldings(userHoldings);

  let latestRun: RecommendationRun | null = null;
  try {
    latestRun = await repositories.recommendations.getLatestByUserId(user.id);
  } catch {
    latestRun = null;
  }

  const display = await buildServiceDisplayContext(user.baseCurrency);

  return apiSuccess(
    {
      ...buildDashboardData({
        viewer: user,
        accounts: userAccounts,
        holdings: userHoldings,
        transactions: userTransactions,
        cashAccounts: userCashAccounts,
        cashAccountBalanceEvents: userCashBalanceEvents,
        portfolioEvents: userEvents,
        priceHistory: userPriceHistory,
        snapshots: userSnapshots,
        profile,
        latestRun,
        display,
      }),
      context: {
        userId: user.id,
        accountCount: userAccounts.length,
        holdingCount: userHoldings.length,
        viewerName: user.displayName,
      },
    },
    "database",
  );
}

export async function getPortfolioView(userId: string) {
  const repositories = getRepositories();
  const [user, userAccounts, userHoldings, userEvents, userSnapshots, profile] =
    await Promise.all([
      repositories.users.getById(userId),
      repositories.accounts.listByUserId(userId),
      repositories.holdings.listByUserId(userId),
      repositories.portfolioEvents.listByUserId(userId),
      repositories.snapshots.listByUserId(userId),
      repositories.preferences.getByUserId(userId),
    ]);
  const userPriceHistory =
    await getHydratedSecurityPriceHistoryForHoldings(userHoldings);

  const display = await buildServiceDisplayContext(user.baseCurrency);

  return apiSuccess(
    {
      ...buildPortfolioData({
        language: user.displayLanguage,
        accounts: userAccounts,
        holdings: userHoldings,
        portfolioEvents: userEvents,
        priceHistory: userPriceHistory,
        snapshots: userSnapshots,
        profile,
        display,
      }),
      context: {
        totalMarketValueCad: userAccounts.reduce(
          (sum, account) => sum + account.marketValueCad,
          0,
        ),
        topHoldingSymbol:
          [...userHoldings].sort(
            (left, right) => right.marketValueCad - left.marketValueCad,
          )[0]?.symbol ?? null,
      },
    },
    "database",
  );
}

function formatSecurityTypeLabel(value?: string | null) {
  if (!value) {
    return "Unknown";
  }

  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function getHoldingDetailMarketDataSummary(params: {
  language: DisplayLanguage;
  quote: SecurityQuote;
  resolution: SecurityResolution;
}) {
  const { language, quote, resolution } = params;
  const providerLabel =
    quote.provider === "twelve-data"
      ? "Twelve Data"
      : quote.provider === "yahoo-finance"
        ? "Yahoo Finance"
        : "fallback";

  return {
    summary: pick(
      language,
      quote.price > 0
        ? `现在这页拿到了一笔可参考价格，来自 ${providerLabel}。它更适合帮你确认这笔持仓现在值多少钱，不代表完整历史回放已经接好。`
        : "这页暂时没拿到一笔新的可参考价格，所以价格区会继续显示你上次成功拿到的缓存结果。",
      quote.price > 0
        ? `This page pulled a usable quote from ${providerLabel}. It helps you confirm what the position looks like right now, but it is not a full historical replay yet.`
        : "A fresh quote was not available for this page, so the price area continues to rely on the last usable cached value.",
    ),
    notes: [
      pick(
        language,
        quote.delayed
          ? "这里拿到的是延迟行情，适合看方向和大致位置，不适合当作精确成交价。"
          : "这里拿到的是当前可用报价，可以用来快速核对这笔持仓。",
        quote.delayed
          ? "This quote is delayed. It is useful for direction and context, but not as an execution price."
          : "This is the latest available quote and is suitable for a quick position check.",
      ),
      pick(
        language,
        resolution.provider === "openfigi"
          ? "标的名称、交易所和类型是按 OpenFIGI 解析出来的。"
          : "这支标的的名称和类型暂时还不完整，所以部分字段会先显示成未知。",
        resolution.provider === "openfigi"
          ? "Name, exchange, and security type were resolved through OpenFIGI."
          : "The security identity is still partial, so some fields remain unknown for now.",
      ),
    ],
    facts: [
      {
        label: pick(language, "现在拿到的价格", "Quote right now"),
        value:
          quote.price > 0
            ? `${quote.currency ?? "N/A"} ${quote.price.toFixed(2)}`
            : pick(language, "还没拿到新报价", "No fresh quote yet"),
        detail: pick(
          language,
          "这是页面现在能拿到的最新参考价。",
          "This is the freshest reference quote currently available to the page.",
        ),
      },
      {
        label: pick(language, "报价时间", "Quote time"),
        value: new Date(quote.timestamp).toLocaleString(
          language === "zh" ? "zh-CN" : "en-CA",
          {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          },
        ),
        detail: pick(
          language,
          "这里显示的是这次报价返回的时间。",
          "This is the timestamp returned with the current quote.",
        ),
      },
      {
        label: pick(language, "报价来源", "Quote source"),
        value: providerLabel,
        detail: pick(
          language,
          quote.delayed ? "当前按延迟行情处理。" : "当前按可用现价处理。",
          quote.delayed
            ? "Currently treated as delayed market data."
            : "Currently treated as the latest available quote.",
        ),
      },
      {
        label: pick(language, "标的识别来源", "Security identity source"),
        value:
          resolution.provider === "openfigi"
            ? "OpenFIGI"
            : pick(language, "本地回退", "Fallback"),
        detail: pick(
          language,
          "名称、交易所和类型会优先走这个来源。",
          "Name, exchange, and security type prefer this source when available.",
        ),
      },
    ],
  };
}

function applyResolvedSecurityContextToHoldingDetail(args: {
  data: PortfolioHoldingDetailData;
  language: DisplayLanguage;
  resolution: SecurityResolution;
  quote: SecurityQuote;
}) {
  const { data, language, resolution, quote } = args;
  const resolvedSecurityType = formatSecurityTypeLabel(resolution.securityType);
  const resolvedExchange =
    resolution.exchange ?? pick(language, "未知交易所", "Unknown exchange");
  const resolvedMarketSector = resolution.marketSector
    ? formatSecurityTypeLabel(resolution.marketSector)
    : pick(language, "未知市场", "Unknown market");

  data.editContext.raw.securityType = resolvedSecurityType;
  data.editContext.raw.exchange = resolvedExchange;
  data.editContext.raw.marketSector = resolvedMarketSector;
  data.holding.securityType =
    data.editContext.current.securityTypeOverride ?? resolvedSecurityType;
  data.holding.exchange =
    data.editContext.current.exchangeOverride ?? resolvedExchange;
  data.holding.marketSector =
    data.editContext.current.marketSectorOverride ?? resolvedMarketSector;
  data.facts = [
    {
      label: pick(language, "它是什么类型", "Security type"),
      value: data.holding.securityType,
      detail: pick(
        language,
        "先认清它是 ETF、股票还是别的，再判断它适不适合继续加。",
        "Identify whether this is an ETF, stock, or something else before deciding whether it still fits.",
      ),
    },
    {
      label: pick(language, "主要在哪个市场", "Primary exchange"),
      value: data.holding.exchange,
      detail: pick(
        language,
        "这能帮助你判断交易市场和后续换汇可能。",
        "This helps with market context and any future FX implications.",
      ),
    },
    {
      label: pick(language, "账户里的位置", "Position inside this account"),
      value: data.holding.accountShare,
      detail: pick(
        language,
        "这里看的分母只是当前账户，不是全部资产。",
        "This uses the current account as the denominator, not the whole portfolio.",
      ),
    },
    {
      label: pick(
        language,
        "整个组合里的位置",
        "Position inside the full portfolio",
      ),
      value: data.holding.portfolioShare,
      detail: pick(
        language,
        "这里看的分母是你全部投资资产。",
        "This uses your full invested portfolio as the denominator.",
      ),
    },
  ];
  data.marketData = getHoldingDetailMarketDataSummary({
    language,
    quote,
    resolution,
  });

  return data;
}

export async function getPortfolioAccountDetailView(
  userId: string,
  accountId: string,
) {
  const repositories = getRepositories();
  const [user, userAccounts, userHoldings, userEvents, userSnapshots, profile] =
    await Promise.all([
      repositories.users.getById(userId),
      repositories.accounts.listByUserId(userId),
      repositories.holdings.listByUserId(userId),
      repositories.portfolioEvents.listByUserId(userId),
      repositories.snapshots.listByUserId(userId),
      repositories.preferences.getByUserId(userId),
    ]);
  const userPriceHistory =
    await getHydratedSecurityPriceHistoryForHoldings(userHoldings);

  const display = await buildServiceDisplayContext(user.baseCurrency);

  const data = buildPortfolioAccountDetailData({
    language: user.displayLanguage,
    accounts: userAccounts,
    holdings: userHoldings,
    snapshots: userSnapshots,
    profile,
    display,
    accountId,
  });

  if (data) {
    const portfolioData = buildPortfolioData({
      language: user.displayLanguage,
      accounts: userAccounts,
      holdings: userHoldings,
      portfolioEvents: userEvents,
      priceHistory: userPriceHistory,
      snapshots: userSnapshots,
      profile,
      display,
    });
    const accountContext = portfolioData.accountContexts.find(
      (entry) => entry.id === accountId,
    );
    if (accountContext) {
      data.performance = accountContext.performance;
      data.chartSeries = accountContext.chartSeries;
    }
  }

  if (!data) {
    return apiSuccess({ data }, "database");
  }

  const accountHoldings = userHoldings.filter(
    (holding) => holding.accountId === accountId,
  );
  const freshestUpdatedAt = accountHoldings
    .map((holding) => holding.updatedAt)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);
  const quotedHoldingCount = accountHoldings.filter(
    (holding) => (holding.lastPriceCad ?? 0) > 0,
  ).length;
  const dominantAssetClass = [
    ...new Map(
      accountHoldings.map((holding) => [holding.assetClass, 0]),
    ).keys(),
  ]
    .map((assetClass) => ({
      assetClass,
      valueCad: accountHoldings
        .filter((holding) => holding.assetClass === assetClass)
        .reduce((sum, holding) => sum + holding.marketValueCad, 0),
    }))
    .sort((left, right) => right.valueCad - left.valueCad)[0];
  const topHolding = [...accountHoldings].sort(
    (left, right) => right.marketValueCad - left.marketValueCad,
  )[0];

  data.facts = [
    {
      label: pick(
        user.displayLanguage,
        "账户里有几笔持仓",
        "Holdings inside this account",
      ),
      value: String(accountHoldings.length),
      detail: pick(
        user.displayLanguage,
        "这里数的是这个账户里现在有多少笔单独持仓。",
        "This counts the number of separate positions currently sitting in the account.",
      ),
    },
    {
      label: pick(
        user.displayLanguage,
        "这一类资产最重",
        "Biggest sleeve inside this account",
      ),
      value: dominantAssetClass
        ? pick(
            user.displayLanguage,
            `${dominantAssetClass.assetClass} 更重`,
            `${dominantAssetClass.assetClass} is the largest sleeve`,
          )
        : pick(user.displayLanguage, "还没看出来", "Not enough data yet"),
      detail: dominantAssetClass
        ? pick(
            user.displayLanguage,
            "这能帮你快速判断这个账户是不是已经压得太偏。",
            "This gives a quick read on whether the account is leaning too heavily into one sleeve.",
          )
        : pick(
            user.displayLanguage,
            "等导入更多持仓以后，这里会更有参考价值。",
            "This becomes more useful after more holdings are imported.",
          ),
    },
    {
      label: pick(
        user.displayLanguage,
        "账户里最重的一笔",
        "Largest holding here",
      ),
      value: topHolding
        ? topHolding.symbol
        : pick(user.displayLanguage, "还没有", "None yet"),
      detail: topHolding
        ? pick(
            user.displayLanguage,
            "先看这笔仓位，再决定这个账户是不是过于集中。",
            "Start with this position when checking whether the account is getting too concentrated.",
          )
        : pick(
            user.displayLanguage,
            "这个账户里还没有可识别的主持仓。",
            "There is no identifiable lead holding in this account yet.",
          ),
    },
    {
      label: pick(
        user.displayLanguage,
        "最近一次价格更新时间",
        "Latest price refresh in this account",
      ),
      value: freshestUpdatedAt
        ? new Date(freshestUpdatedAt).toLocaleString(
            user.displayLanguage === "zh" ? "zh-CN" : "en-CA",
            {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            },
          )
        : pick(user.displayLanguage, "还没刷新过", "Not refreshed yet"),
      detail: pick(
        user.displayLanguage,
        `这个账户里有 ${quotedHoldingCount}/${accountHoldings.length} 笔持仓已经拿到可参考价格。`,
        `${quotedHoldingCount}/${accountHoldings.length} holdings in this account already have usable prices.`,
      ),
    },
  ];

  return apiSuccess({ data }, "database");
}

export async function getPortfolioHoldingDetailView(
  userId: string,
  holdingId: string,
) {
  const repositories = getRepositories();
  const [user, userAccounts, userHoldings, userEvents, userSnapshots, profile] =
    await Promise.all([
      repositories.users.getById(userId),
      repositories.accounts.listByUserId(userId),
      repositories.holdings.listByUserId(userId),
      repositories.portfolioEvents.listByUserId(userId),
      repositories.snapshots.listByUserId(userId),
      repositories.preferences.getByUserId(userId),
    ]);
  const holdingForHistory = userHoldings.find(
    (holding) => holding.id === holdingId,
  );
  const userPriceHistory = holdingForHistory
    ? await repositories.securityPriceHistory.listByIdentity({
        symbol: holdingForHistory.symbol.trim().toUpperCase(),
        exchange: holdingForHistory.exchangeOverride ?? null,
        currency: holdingForHistory.currency ?? null,
      })
    : [];

  const display = await buildServiceDisplayContext(user.baseCurrency);

  const data = buildPortfolioHoldingDetailData({
    language: user.displayLanguage,
    accounts: userAccounts,
    holdings: userHoldings,
    portfolioEvents: userEvents,
    priceHistory: userPriceHistory,
    snapshots: userSnapshots,
    profile,
    display,
    holdingId,
  });

  if (!data) {
    return apiSuccess({ data }, "database");
  }

  const [resolutionResponse, quoteResponse] = await Promise.all([
    resolveSecurity(data.holding.symbol).catch(() => ({
      result: {
        symbol: data.holding.symbol,
        name: data.holding.name,
        exchange: null,
        micCode: null,
        compositeFigi: null,
        shareClassFigi: null,
        securityType: null,
        marketSector: null,
        provider: "fallback" as const,
      },
    })),
    getSecurityQuote(data.holding.symbol, {
      exchange: data.editContext.current.exchangeOverride ?? null,
      currency: data.holding.currency,
    }).catch(() => ({
      result: {
        symbol: data.holding.symbol,
        price: 0,
        currency: data.holding.currency,
        timestamp: new Date().toISOString(),
        provider: "fallback" as const,
        delayed: true,
      },
    })),
  ]);

  const resolution = resolutionResponse.result;
  const quote = quoteResponse.result;

  return apiSuccess(
    {
      data: applyResolvedSecurityContextToHoldingDetail({
        data,
        language: user.displayLanguage,
        resolution,
        quote,
      }),
    },
    "database",
  );
}

export async function getPortfolioSecurityDetailView(
  userId: string,
  symbol: string,
  identity?: {
    securityId?: string | null;
    exchange?: string | null;
    currency?: CurrencyCode | null;
  },
) {
  const repositories = getRepositories();
  const normalizedSymbol = symbol.trim().toUpperCase();
  const [
    user,
    userAccounts,
    userHoldings,
    userEvents,
    userSnapshots,
    profile,
  ] = await Promise.all([
    repositories.users.getById(userId),
    repositories.accounts.listByUserId(userId),
    repositories.holdings.listByUserId(userId),
    repositories.portfolioEvents.listByUserId(userId),
    repositories.snapshots.listByUserId(userId),
    repositories.preferences.getByUserId(userId),
  ]);
  let hydratedPriceHistory: SecurityPriceHistoryPoint[] = [];

  const display = await buildServiceDisplayContext(user.baseCurrency);

  const normalizedIdentityExchange =
    identity?.exchange?.trim().toUpperCase() || null;
  const referenceHolding =
    userHoldings.find(
      (holding) =>
        holding.symbol.trim().toUpperCase() === normalizedSymbol &&
        (!identity?.currency || holding.currency === identity.currency) &&
        (!normalizedIdentityExchange ||
          (holding.exchangeOverride?.trim().toUpperCase() || "") ===
            normalizedIdentityExchange),
    ) ??
    userHoldings.find(
      (holding) => holding.symbol.trim().toUpperCase() === normalizedSymbol,
    );
  const requestedSecurity = identity?.securityId
    ? await repositories.securities.getById(identity.securityId)
    : null;
  const canonicalSecurity =
    requestedSecurity ??
    (referenceHolding
      ? await resolveSecurityIdentityForHolding(referenceHolding)
      : await resolveCanonicalSecurityIdentity({
          symbol: normalizedSymbol,
          exchange: identity?.exchange ?? null,
          currency: identity?.currency ?? null,
          name: normalizedSymbol,
        }));
  hydratedPriceHistory = await repositories.securityPriceHistory.listBySecurityId(
    canonicalSecurity.id,
  );
  if (
    hydratedPriceHistory.length < 2 ||
    historyNeedsHigherDensity(hydratedPriceHistory)
  ) {
    try {
      const historyResponse = await getSecurityHistoricalSeries(
        normalizedSymbol,
        {
          exchange: referenceHolding?.exchangeOverride ?? null,
          currency: referenceHolding?.currency ?? canonicalSecurity.currency,
        },
      );
      if (historyResponse.results.length > 0) {
        const mappedPoints: SecurityPriceHistoryPoint[] =
          historyResponse.results.map((point, index) => ({
            id: `fetched-${normalizedSymbol}-${point.date}-${index}`,
            securityId: canonicalSecurity.id,
            symbol: canonicalSecurity.symbol,
            exchange: canonicalSecurity.canonicalExchange,
            priceDate: point.date,
            close: point.close,
            adjustedClose: point.adjustedClose ?? null,
            currency: canonicalSecurity.currency,
            source: point.provider,
            provider: point.provider,
            sourceMode: point.provider === "fallback" ? "fallback" : "provider",
            freshness: point.provider === "fallback" ? "fallback" : "fresh",
            refreshRunId: null,
            isReference: point.provider === "fallback",
            fallbackReason:
              point.provider === "fallback"
                ? "Provider returned fallback history."
                : null,
            createdAt: new Date().toISOString(),
          }));
        hydratedPriceHistory = mappedPoints;
        try {
          await upsertSecurityPriceHistoryPoints(mappedPoints);
        } catch {
          hydratedPriceHistory = mappedPoints;
        }
      }
    } catch {
      hydratedPriceHistory = [];
    }
  }

  const data = buildPortfolioSecurityDetailData({
    language: user.displayLanguage,
    accounts: userAccounts,
    holdings: userHoldings,
    portfolioEvents: userEvents,
    priceHistory: hydratedPriceHistory,
    snapshots: userSnapshots,
    profile,
    display,
    symbol: normalizedSymbol,
    securityId: canonicalSecurity.id,
    exchange: canonicalSecurity.canonicalExchange,
    currency: canonicalSecurity.currency,
  });

  if (!data) {
    return apiSuccess({ data }, "database");
  }

  const [resolutionResponse, quoteResponse] = await Promise.all([
    resolveSecurity(data.security.symbol).catch(() => ({
      result: {
        symbol: data.security.symbol,
        name: data.security.name,
        exchange: null,
        micCode: null,
        compositeFigi: null,
        shareClassFigi: null,
        securityType: null,
        marketSector: null,
        provider: "fallback" as const,
      },
    })),
    getSecurityQuote(data.security.symbol, {
      exchange: canonicalSecurity.canonicalExchange,
      currency: canonicalSecurity.currency,
    }).catch(() => ({
      result: {
        symbol: data.security.symbol,
        price: 0,
        currency: data.security.currency,
        timestamp: new Date().toISOString(),
        provider: "fallback" as const,
        delayed: true,
      },
    })),
  ]);

  const resolution = resolutionResponse.result;
  const quote = quoteResponse.result;
  const resolvedAssetClass = inferEconomicAssetClass({
    symbol: canonicalSecurity.symbol,
    name: resolution.name ?? canonicalSecurity.name,
    assetClass: referenceHolding?.assetClass ?? null,
    securityType: resolution.securityType ?? canonicalSecurity.securityType,
    currency: canonicalSecurity.currency,
  });

  data.security.securityId = canonicalSecurity.id;
  data.security.name = resolution.name ?? data.security.name;
  data.security.currency = canonicalSecurity.currency;
  if (!referenceHolding) {
    data.security.assetClass = getAssetClassLabel(
      resolvedAssetClass,
      user.displayLanguage,
    );
    data.analysis.assetClassLabel = getAssetClassLabel(
      resolvedAssetClass,
      user.displayLanguage,
    );
    data.analysis.summary = pick(
      user.displayLanguage,
      `${normalizedSymbol} 当前不是实际持仓，系统按 ${getAssetClassLabel(resolvedAssetClass, user.displayLanguage)} 的候选标的口径展示；行业分类仍需要更完整的外部 profile 数据补齐。`,
      `${normalizedSymbol} is not currently held, so it is shown as a ${getAssetClassLabel(resolvedAssetClass, user.displayLanguage)} candidate; industry classification still needs richer external profile data.`,
    );
  }
  data.security.securityType = formatSecurityTypeLabel(resolution.securityType);
  data.security.exchange =
    resolution.exchange ??
    pick(user.displayLanguage, "未知交易所", "Unknown exchange");
  data.security.marketSector = resolution.marketSector
    ? formatSecurityTypeLabel(resolution.marketSector)
    : pick(user.displayLanguage, "未知市场", "Unknown market");
  data.security.lastPrice =
    quote.price > 0
      ? `${quote.currency ?? "N/A"} ${quote.price.toFixed(2)}`
      : data.security.lastPrice;
  data.security.quoteTimestamp = new Date(quote.timestamp).toLocaleString(
    user.displayLanguage === "zh" ? "zh-CN" : "en-CA",
    {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    },
  );
  data.security.freshnessVariant = quote.delayed ? "warning" : "success";
  data.marketData = getHoldingDetailMarketDataSummary({
    language: user.displayLanguage,
    quote,
    resolution,
  });
  if (data.heldPosition) {
    data.heldPosition.accountViews = data.heldPosition.accountViews.map(
      (detail) =>
        applyResolvedSecurityContextToHoldingDetail({
          data: detail,
          language: user.displayLanguage,
          resolution,
          quote,
        }),
    );
  }

  return apiSuccess({ data }, "database");
}

export async function updateHoldingPosition(
  userId: string,
  holdingId: string,
  input: UpdateHoldingPositionInput,
) {
  const db = getDb();

  return db.transaction(async (tx) => {
    const holding = await tx.query.holdingPositions.findFirst({
      where: and(
        eq(holdingPositions.userId, userId),
        eq(holdingPositions.id, holdingId),
      ),
    });
    if (!holding) {
      throw new Error("Holding was not found.");
    }

    const targetAccountId = input.accountId ?? holding.accountId;
    const targetAccount = await tx.query.investmentAccounts.findFirst({
      where: and(
        eq(investmentAccounts.userId, userId),
        eq(investmentAccounts.id, targetAccountId),
      ),
    });
    if (!targetAccount) {
      throw new Error("Target account was not found.");
    }

    const currency = normalizeCurrencyCode(
      input.currency ?? (holding.currency as string) ?? "CAD",
    );
    const quantity =
      input.quantity !== undefined
        ? input.quantity
        : holding.quantity == null
          ? null
          : Number(holding.quantity);
    const avgCostPerShareAmount =
      input.avgCostPerShareAmount !== undefined
        ? input.avgCostPerShareAmount
        : holding.avgCostPerShareAmount == null
          ? null
          : Number(holding.avgCostPerShareAmount);
    const lastPriceAmount =
      input.lastPriceAmount !== undefined
        ? input.lastPriceAmount
        : holding.lastPriceAmount == null
          ? null
          : Number(holding.lastPriceAmount);
    const costBasisAmount =
      input.costBasisAmount !== undefined
        ? input.costBasisAmount
        : quantity != null && avgCostPerShareAmount != null
          ? round(quantity * avgCostPerShareAmount)
          : holding.costBasisAmount == null
            ? null
            : Number(holding.costBasisAmount);
    const marketValueAmount =
      input.marketValueAmount !== undefined
        ? input.marketValueAmount
        : quantity != null && lastPriceAmount != null
          ? round(quantity * lastPriceAmount)
          : Number(holding.marketValueAmount ?? holding.marketValueCad);
    if (marketValueAmount == null || marketValueAmount < 0) {
      throw new Error("Holding market value must be present.");
    }

    const avgCostPerShareCad = await toCadAmount(
      avgCostPerShareAmount,
      currency,
    );
    const costBasisCad = await toCadAmount(costBasisAmount, currency);
    const lastPriceCad = await toCadAmount(lastPriceAmount, currency);
    const marketValueCad =
      (await toCadAmount(marketValueAmount, currency)) ?? 0;
    const gainLossPct =
      costBasisCad != null && costBasisCad > 0
        ? round(((marketValueCad - costBasisCad) / costBasisCad) * 100, 2)
        : Number(holding.gainLossPct);
    const previousQuantity =
      holding.quantity == null ? null : Number(holding.quantity);
    const nextExchange =
      input.exchangeOverride !== undefined
        ? input.exchangeOverride
        : holding.exchangeOverride;
    const nextSecurityType =
      input.securityTypeOverride !== undefined
        ? input.securityTypeOverride
        : holding.securityTypeOverride;
    const nextMarketSector =
      input.marketSectorOverride !== undefined
        ? input.marketSectorOverride
        : holding.marketSectorOverride;
    const security = await resolveCanonicalSecurityIdentity({
      symbol: holding.symbol,
      exchange: nextExchange ?? null,
      currency,
      name: input.name ?? holding.name,
      securityType: nextSecurityType ?? null,
      marketSector: nextMarketSector ?? null,
    });

    await tx
      .update(holdingPositions)
      .set({
        accountId: targetAccount.id,
        securityId: security.id,
        name: input.name ?? holding.name,
        currency,
        quantity: quantity == null ? null : quantity.toFixed(6),
        avgCostPerShareAmount:
          avgCostPerShareAmount == null
            ? null
            : avgCostPerShareAmount.toFixed(4),
        costBasisAmount:
          costBasisAmount == null ? null : costBasisAmount.toFixed(2),
        lastPriceAmount:
          lastPriceAmount == null ? null : lastPriceAmount.toFixed(4),
        marketValueAmount: marketValueAmount.toFixed(2),
        avgCostPerShareCad:
          avgCostPerShareCad == null ? null : avgCostPerShareCad.toFixed(4),
        costBasisCad: costBasisCad == null ? null : costBasisCad.toFixed(2),
        lastPriceCad: lastPriceCad == null ? null : lastPriceCad.toFixed(4),
        marketValueCad: marketValueCad.toFixed(2),
        gainLossPct: gainLossPct.toFixed(2),
        assetClassOverride:
          input.assetClassOverride !== undefined
            ? input.assetClassOverride
            : holding.assetClassOverride,
        sectorOverride:
          input.sectorOverride !== undefined
            ? input.sectorOverride
            : holding.sectorOverride,
        securityTypeOverride:
          nextSecurityType,
        exchangeOverride: nextExchange,
        marketSectorOverride: nextMarketSector,
        updatedAt: new Date(),
      })
      .where(eq(holdingPositions.id, holding.id));

    if (
      targetAccount.id !== holding.accountId &&
      previousQuantity != null &&
      previousQuantity > 0
    ) {
      await createPortfolioEvent(tx, {
        userId,
        accountId: holding.accountId,
        symbol: holding.symbol,
        eventType: "sell",
        quantity: previousQuantity,
        priceAmount:
          holding.lastPriceAmount == null
            ? null
            : Number(holding.lastPriceAmount),
        currency: normalizeCurrencyCode((holding.currency as string) ?? "CAD"),
        source: "holding-move",
      });
    }

    if (
      targetAccount.id !== holding.accountId &&
      quantity != null &&
      quantity > 0
    ) {
      await createPortfolioEvent(tx, {
        userId,
        accountId: targetAccount.id,
        symbol: holding.symbol,
        eventType: "buy",
        quantity,
        priceAmount: lastPriceAmount,
        currency,
        source: "holding-move",
      });
    } else if (targetAccount.id === holding.accountId) {
      const quantityDelta = (quantity ?? 0) - (previousQuantity ?? 0);
      if (Math.abs(quantityDelta) > 0.000001) {
        await createPortfolioEvent(tx, {
          userId,
          accountId: targetAccount.id,
          symbol: holding.symbol,
          eventType: "adjustment",
          quantity: quantityDelta,
          priceAmount: lastPriceAmount,
          currency,
          source: "holding-adjustment",
        });
      }
    }

    await recalculatePortfolioState(tx, userId);
    await createPortfolioEditLog(
      tx,
      userId,
      "holding",
      holding.id,
      "update",
      `Updated holding ${holding.symbol}`,
      {
        before: {
          accountId: holding.accountId,
          name: holding.name,
          currency: holding.currency,
          quantity: holding.quantity,
          avgCostPerShareAmount: holding.avgCostPerShareAmount,
          costBasisAmount: holding.costBasisAmount,
          lastPriceAmount: holding.lastPriceAmount,
          marketValueAmount: holding.marketValueAmount,
          assetClassOverride: holding.assetClassOverride,
          sectorOverride: holding.sectorOverride,
          securityTypeOverride: holding.securityTypeOverride,
          exchangeOverride: holding.exchangeOverride,
          marketSectorOverride: holding.marketSectorOverride,
        },
        after: input,
      },
    );

    return true;
  });
}

function historyNeedsHigherDensity(points: SecurityPriceHistoryPoint[]) {
  if (points.length < 30) {
    return true;
  }

  const sorted = [...points].sort((left, right) =>
    left.priceDate.localeCompare(right.priceDate),
  );
  const latest = sorted[sorted.length - 1];
  const previous = sorted[sorted.length - 2];
  if (!latest || !previous) {
    return true;
  }

  const dayGap =
    (new Date(latest.priceDate).getTime() -
      new Date(previous.priceDate).getTime()) /
    (1000 * 60 * 60 * 24);
  return dayGap > 7;
}

async function getHydratedSecurityPriceHistoryForHoldings(
  holdings: HoldingPosition[],
) {
  const repositories = getRepositories();
  const byIdentity = new Map<
    string,
    { securityId: string; symbol: string; exchange: string; currency: CurrencyCode; holdings: HoldingPosition[] }
  >();
  for (const holding of holdings) {
    const security = await resolveSecurityIdentityForHolding(holding);
    const key = security.id;
    const group = byIdentity.get(key) ?? {
      securityId: security.id,
      symbol: security.symbol,
      exchange: security.canonicalExchange,
      currency: security.currency,
      holdings: [],
    };
    group.holdings.push(holding);
    byIdentity.set(key, group);
  }

  const results = await Promise.all(
    [...byIdentity.values()].map(async (identity) => {
      const existing = await repositories.securityPriceHistory.listBySecurityId(
        identity.securityId,
      );
      if (!historyNeedsHigherDensity(existing)) {
        return existing;
      }

      try {
        const fetched = await getSecurityHistoricalSeries(identity.symbol, {
          exchange: identity.exchange,
          currency: identity.currency,
        });
        const mappedPoints: SecurityPriceHistoryPoint[] = fetched.results.map(
          (point, index) => ({
            id: `fetched-${identity.symbol}-${point.date}-${index}`,
            securityId: identity.securityId,
            symbol: identity.symbol,
            exchange: identity.exchange,
            priceDate: point.date,
            close: point.close,
            adjustedClose: point.adjustedClose ?? null,
            currency: identity.currency,
            source: point.provider,
            provider: point.provider,
            sourceMode: point.provider === "fallback" ? "fallback" : "provider",
            freshness: point.provider === "fallback" ? "fallback" : "fresh",
            refreshRunId: null,
            isReference: point.provider === "fallback",
            fallbackReason:
              point.provider === "fallback"
                ? "Provider returned fallback history."
                : null,
            createdAt: new Date().toISOString(),
          }),
        );
        if (mappedPoints.length > 0) {
          try {
            await upsertSecurityPriceHistoryPoints(mappedPoints);
          } catch {
            // Keep fetched history in memory for this response even if persistence fails.
          }
          return mappedPoints;
        }
      } catch {
        return existing;
      }

      return existing;
    }),
  );

  return results.flat();
}

export async function createHoldingPosition(
  userId: string,
  accountId: string,
  input: CreateHoldingPositionInput,
) {
  const db = getDb();

  return db.transaction(async (tx) => {
    const account = await tx.query.investmentAccounts.findFirst({
      where: and(
        eq(investmentAccounts.userId, userId),
        eq(investmentAccounts.id, accountId),
      ),
    });
    if (!account) {
      throw new Error("Target account was not found.");
    }

    const currency = normalizeCurrencyCode(
      input.currency ?? (account.currency as string) ?? "CAD",
    );
    const quantity = input.quantity ?? null;
    const avgCostPerShareAmount = input.avgCostPerShareAmount ?? null;
    const explicitCostBasisAmount = input.costBasisAmount ?? null;
    const lastPriceAmount = input.lastPriceAmount ?? null;
    const explicitMarketValueAmount = input.marketValueAmount ?? null;

    const costBasisAmount =
      explicitCostBasisAmount ??
      (quantity != null && avgCostPerShareAmount != null
        ? round(quantity * avgCostPerShareAmount)
        : null);
    const marketValueAmount =
      explicitMarketValueAmount ??
      (quantity != null && lastPriceAmount != null
        ? round(quantity * lastPriceAmount)
        : null);

    if (marketValueAmount == null || marketValueAmount < 0) {
      throw new Error("Holding market value must be present.");
    }

    const avgCostPerShareCad = await toCadAmount(
      avgCostPerShareAmount,
      currency,
    );
    const costBasisCad = await toCadAmount(costBasisAmount, currency);
    const lastPriceCad = await toCadAmount(lastPriceAmount, currency);
    const marketValueCad =
      (await toCadAmount(marketValueAmount, currency)) ?? 0;
    const gainLossPct =
      costBasisCad != null && costBasisCad > 0
        ? round(((marketValueCad - costBasisCad) / costBasisCad) * 100, 2)
        : 0;
    const security = await resolveCanonicalSecurityIdentity({
      symbol: input.symbol,
      exchange: input.exchange ?? null,
      currency,
      name: input.name ?? input.symbol,
      securityType: input.securityType ?? null,
      marketSector: input.marketSector ?? null,
    });

    const [created] = await tx
      .insert(holdingPositions)
      .values({
        userId,
        accountId,
        securityId: security.id,
        symbol: input.symbol.trim().toUpperCase(),
        name: input.name?.trim() || input.symbol.trim().toUpperCase(),
        assetClass: input.assetClass,
        sector: input.sector?.trim() || "Multi-sector",
        currency,
        quantity: quantity == null ? null : quantity.toFixed(6),
        avgCostPerShareAmount:
          avgCostPerShareAmount == null
            ? null
            : avgCostPerShareAmount.toFixed(4),
        costBasisAmount:
          costBasisAmount == null ? null : costBasisAmount.toFixed(2),
        lastPriceAmount:
          lastPriceAmount == null ? null : lastPriceAmount.toFixed(4),
        marketValueAmount: marketValueAmount.toFixed(2),
        avgCostPerShareCad:
          avgCostPerShareCad == null ? null : avgCostPerShareCad.toFixed(4),
        costBasisCad: costBasisCad == null ? null : costBasisCad.toFixed(2),
        lastPriceCad: lastPriceCad == null ? null : lastPriceCad.toFixed(4),
        marketValueCad: marketValueCad.toFixed(2),
        gainLossPct: gainLossPct.toFixed(2),
        weightPct: "0.00",
        assetClassOverride: null,
        sectorOverride: null,
        securityTypeOverride: input.securityType ?? null,
        exchangeOverride: input.exchange ?? null,
        marketSectorOverride: input.marketSector?.trim() || null,
      })
      .returning();

    if (quantity != null && quantity > 0) {
      await createPortfolioEvent(tx, {
        userId,
        accountId,
        symbol: created.symbol,
        eventType: "buy",
        quantity,
        priceAmount: lastPriceAmount,
        currency,
        source: "holding-create",
      });
    }

    await recalculatePortfolioState(tx, userId);
    await createPortfolioEditLog(
      tx,
      userId,
      "holding",
      created.id,
      "create",
      `Created holding ${created.symbol}`,
      {
        accountId,
        input,
      },
    );

    return created.id;
  });
}

export async function deleteHoldingPosition(userId: string, holdingId: string) {
  const db = getDb();

  return db.transaction(async (tx) => {
    const holding = await tx.query.holdingPositions.findFirst({
      where: and(
        eq(holdingPositions.userId, userId),
        eq(holdingPositions.id, holdingId),
      ),
    });
    if (!holding) {
      throw new Error("Holding was not found.");
    }

    const existingQuantity =
      holding.quantity == null ? null : Number(holding.quantity);
    if (existingQuantity != null && existingQuantity > 0) {
      await createPortfolioEvent(tx, {
        userId,
        accountId: holding.accountId,
        symbol: holding.symbol,
        eventType: "sell",
        quantity: existingQuantity,
        priceAmount:
          holding.lastPriceAmount == null
            ? null
            : Number(holding.lastPriceAmount),
        currency: normalizeCurrencyCode((holding.currency as string) ?? "CAD"),
        source: "holding-delete",
      });
    }

    await tx
      .delete(holdingPositions)
      .where(eq(holdingPositions.id, holding.id));
    await recalculatePortfolioState(tx, userId);
    await createPortfolioEditLog(
      tx,
      userId,
      "holding",
      holding.id,
      "delete",
      `Deleted holding ${holding.symbol}`,
      {
        deleted: {
          symbol: holding.symbol,
          accountId: holding.accountId,
          marketValueCad: holding.marketValueCad,
        },
      },
    );

    return true;
  });
}

export async function updateInvestmentAccount(
  userId: string,
  accountId: string,
  input: UpdateInvestmentAccountInput,
) {
  const db = getDb();
  return db.transaction(async (tx) => {
    const account = await tx.query.investmentAccounts.findFirst({
      where: and(
        eq(investmentAccounts.userId, userId),
        eq(investmentAccounts.id, accountId),
      ),
    });
    if (!account) {
      throw new Error("Account was not found.");
    }

    const currency =
      input.currency ??
      normalizeCurrencyCode((account.currency as string) || "CAD");
    const marketValueCad = Number(account.marketValueCad);
    const marketValueAmount =
      (await convertCurrencyAmount(marketValueCad, "CAD", currency)) ||
      marketValueCad;

    await tx
      .update(investmentAccounts)
      .set({
        nickname: input.nickname ?? account.nickname,
        institution: input.institution ?? account.institution,
        type: input.type ?? (account.type as AccountType),
        currency,
        contributionRoomCad:
          input.contributionRoomCad === undefined
            ? account.contributionRoomCad
            : input.contributionRoomCad == null
              ? null
              : input.contributionRoomCad.toFixed(2),
        marketValueAmount: marketValueAmount.toFixed(2),
        updatedAt: new Date(),
      })
      .where(eq(investmentAccounts.id, account.id));

    await createPortfolioEditLog(
      tx,
      userId,
      "account",
      account.id,
      "update",
      `Updated account ${account.nickname}`,
      {
        before: {
          nickname: account.nickname,
          institution: account.institution,
          type: account.type,
          currency: account.currency,
          contributionRoomCad: account.contributionRoomCad,
        },
        after: input,
      },
    );

    return true;
  });
}

export async function deleteInvestmentAccount(
  userId: string,
  accountId: string,
) {
  const db = getDb();
  return db.transaction(async (tx) => {
    const account = await tx.query.investmentAccounts.findFirst({
      where: and(
        eq(investmentAccounts.userId, userId),
        eq(investmentAccounts.id, accountId),
      ),
    });
    if (!account) {
      throw new Error("Account was not found.");
    }

    const remainingHoldings = await tx
      .select({ id: holdingPositions.id })
      .from(holdingPositions)
      .where(
        and(
          eq(holdingPositions.userId, userId),
          eq(holdingPositions.accountId, accountId),
        ),
      );
    if (remainingHoldings.length > 0) {
      throw new Error(
        "Please move, delete, or merge the holdings in this account before deleting the account.",
      );
    }

    await tx
      .delete(investmentAccounts)
      .where(eq(investmentAccounts.id, account.id));
    await createPortfolioEditLog(
      tx,
      userId,
      "account",
      account.id,
      "delete",
      `Deleted account ${account.nickname}`,
      {
        deleted: {
          nickname: account.nickname,
          institution: account.institution,
          type: account.type,
        },
      },
    );

    return true;
  });
}

export async function previewAccountMerge(
  userId: string,
  sourceAccountId: string,
  targetAccountId: string,
): Promise<MergeAccountsPreviewResult> {
  const repositories = getRepositories();
  const [accounts, holdings] = await Promise.all([
    repositories.accounts.listByUserId(userId),
    repositories.holdings.listByUserId(userId),
  ]);
  const source = accounts.find((account) => account.id === sourceAccountId);
  const target = accounts.find((account) => account.id === targetAccountId);
  if (!source || !target) {
    throw new Error("Source or target account was not found.");
  }

  const sourceHoldingCount = holdings.filter(
    (holding) => holding.accountId === source.id,
  ).length;
  const targetHoldingCount = holdings.filter(
    (holding) => holding.accountId === target.id,
  ).length;
  const warnings: string[] = [];
  if (source.type !== target.type) {
    warnings.push(
      "These two accounts do not have the same account type, so merge is blocked for now.",
    );
  }
  if (
    (source.contributionRoomCad ?? null) != null ||
    (target.contributionRoomCad ?? null) != null
  ) {
    warnings.push(
      "Contribution room is not additive during merge. The target account room value will be kept.",
    );
  }

  return {
    source: {
      id: source.id,
      name: `${source.institution} ${source.nickname}`,
      type: source.type,
      valueCad: source.marketValueCad,
      holdingCount: sourceHoldingCount,
    },
    target: {
      id: target.id,
      name: `${target.institution} ${target.nickname}`,
      type: target.type,
      valueCad: target.marketValueCad,
      holdingCount: targetHoldingCount,
    },
    mergedValueCad: round(source.marketValueCad + target.marketValueCad, 2),
    movedHoldingCount: sourceHoldingCount,
    warnings,
  };
}

export async function mergeAccounts(
  userId: string,
  sourceAccountId: string,
  targetAccountId: string,
) {
  const preview = await previewAccountMerge(
    userId,
    sourceAccountId,
    targetAccountId,
  );
  if (preview.source.type !== preview.target.type) {
    throw new Error(
      "Only accounts with the same type can be merged right now.",
    );
  }

  const db = getDb();
  return db.transaction(async (tx) => {
    const sourceHoldings = await tx
      .select()
      .from(holdingPositions)
      .where(
        and(
          eq(holdingPositions.userId, userId),
          eq(holdingPositions.accountId, sourceAccountId),
        ),
      );
    const targetHoldings = await tx
      .select()
      .from(holdingPositions)
      .where(
        and(
          eq(holdingPositions.userId, userId),
          eq(holdingPositions.accountId, targetAccountId),
        ),
      );
    const targetBySymbol = new Map(
      targetHoldings.map((holding) => [
        holding.symbol.trim().toUpperCase(),
        holding,
      ]),
    );

    for (const sourceHolding of sourceHoldings) {
      const matched = targetBySymbol.get(
        sourceHolding.symbol.trim().toUpperCase(),
      );
      if (!matched) {
        await tx
          .update(holdingPositions)
          .set({ accountId: targetAccountId, updatedAt: new Date() })
          .where(eq(holdingPositions.id, sourceHolding.id));
        continue;
      }

      const quantity =
        (sourceHolding.quantity == null ? 0 : Number(sourceHolding.quantity)) +
        (matched.quantity == null ? 0 : Number(matched.quantity));
      const costBasisAmount =
        (sourceHolding.costBasisAmount == null
          ? 0
          : Number(sourceHolding.costBasisAmount)) +
        (matched.costBasisAmount == null ? 0 : Number(matched.costBasisAmount));
      const costBasisCad =
        (sourceHolding.costBasisCad == null
          ? 0
          : Number(sourceHolding.costBasisCad)) +
        (matched.costBasisCad == null ? 0 : Number(matched.costBasisCad));
      const marketValueAmount =
        Number(
          sourceHolding.marketValueAmount ?? sourceHolding.marketValueCad,
        ) + Number(matched.marketValueAmount ?? matched.marketValueCad);
      const marketValueCad =
        Number(sourceHolding.marketValueCad) + Number(matched.marketValueCad);
      const avgCostPerShareAmount =
        quantity > 0 && costBasisAmount > 0
          ? round(costBasisAmount / quantity, 4)
          : null;
      const avgCostPerShareCad =
        quantity > 0 && costBasisCad > 0
          ? round(costBasisCad / quantity, 4)
          : null;
      const lastPriceAmount =
        matched.lastPriceAmount == null
          ? sourceHolding.lastPriceAmount
          : matched.lastPriceAmount;
      const lastPriceCad =
        matched.lastPriceCad == null
          ? sourceHolding.lastPriceCad
          : matched.lastPriceCad;
      const gainLossPct =
        costBasisCad > 0
          ? round(((marketValueCad - costBasisCad) / costBasisCad) * 100, 2)
          : Number(matched.gainLossPct);

      await tx
        .update(holdingPositions)
        .set({
          quantity: quantity > 0 ? quantity.toFixed(6) : null,
          costBasisAmount:
            costBasisAmount > 0 ? costBasisAmount.toFixed(2) : null,
          costBasisCad: costBasisCad > 0 ? costBasisCad.toFixed(2) : null,
          marketValueAmount: marketValueAmount.toFixed(2),
          marketValueCad: marketValueCad.toFixed(2),
          avgCostPerShareAmount:
            avgCostPerShareAmount == null
              ? null
              : avgCostPerShareAmount.toFixed(4),
          avgCostPerShareCad:
            avgCostPerShareCad == null ? null : avgCostPerShareCad.toFixed(4),
          lastPriceAmount: lastPriceAmount,
          lastPriceCad: lastPriceCad,
          gainLossPct: gainLossPct.toFixed(2),
          assetClassOverride:
            matched.assetClassOverride ?? sourceHolding.assetClassOverride,
          sectorOverride:
            matched.sectorOverride ?? sourceHolding.sectorOverride,
          securityTypeOverride:
            matched.securityTypeOverride ?? sourceHolding.securityTypeOverride,
          exchangeOverride:
            matched.exchangeOverride ?? sourceHolding.exchangeOverride,
          marketSectorOverride:
            matched.marketSectorOverride ?? sourceHolding.marketSectorOverride,
          updatedAt: new Date(),
        })
        .where(eq(holdingPositions.id, matched.id));

      await tx
        .delete(holdingPositions)
        .where(eq(holdingPositions.id, sourceHolding.id));
    }

    await tx
      .delete(investmentAccounts)
      .where(
        and(
          eq(investmentAccounts.userId, userId),
          eq(investmentAccounts.id, sourceAccountId),
        ),
      );
    await recalculatePortfolioState(tx, userId);
    await createPortfolioEditLog(
      tx,
      userId,
      "account-merge",
      sourceAccountId,
      "merge",
      `Merged account ${sourceAccountId} into ${targetAccountId}`,
      {
        sourceAccountId,
        targetAccountId,
        preview,
      },
    );

    return true;
  });
}

export async function getRecommendationView(userId: string) {
  const repositories = getRepositories();
  const [user, profile, accounts, holdings] = await Promise.all([
    repositories.users.getById(userId),
    repositories.preferences.getByUserId(userId),
    repositories.accounts.listByUserId(userId),
    repositories.holdings.listByUserId(userId),
  ]);
  let latestRun: RecommendationRun | null = null;
  try {
    latestRun = await repositories.recommendations.getLatestByUserId(userId);
  } catch {
    latestRun = null;
  }

  const scenarioAmounts =
    latestRun && latestRun.contributionAmountCad > 0
      ? [
          ...new Set([
            Math.max(
              500,
              Math.round((latestRun.contributionAmountCad * 0.5) / 500) * 500,
            ),
            latestRun.contributionAmountCad,
            Math.max(
              1000,
              Math.round((latestRun.contributionAmountCad * 2) / 500) * 500,
            ),
          ]),
        ]
      : [];

  const scenarioRuns =
    latestRun && accounts.length > 0 && holdings.length > 0
      ? scenarioAmounts.map((amountCad, index) => {
          const scenarioRecommendation = buildRecommendationV2({
            accounts,
            holdings,
            profile,
            contributionAmountCad: amountCad,
            language: user.displayLanguage,
          });

          return {
            id: `scenario-${amountCad}-${index}`,
            userId,
            contributionAmountCad: amountCad,
            createdAt: latestRun.createdAt,
            engineVersion: scenarioRecommendation.engineVersion,
            objective: scenarioRecommendation.objective,
            confidenceScore: scenarioRecommendation.confidenceScore,
            assumptions: scenarioRecommendation.assumptions,
            notes: scenarioRecommendation.notes,
            items: scenarioRecommendation.items,
          } satisfies RecommendationRun;
        })
      : [];

  const display = await buildServiceDisplayContext(user.baseCurrency);

  return apiSuccess(
    {
      ...buildRecommendationsData({
        language: user.displayLanguage,
        profile,
        accounts,
        latestRun,
        scenarioRuns,
        display,
      }),
      run: latestRun ?? createEmptyRun(userId),
    },
    "database",
  );
}

export async function getSpendingView(userId: string) {
  const repositories = getRepositories();
  const [user, userTransactions, profile] = await Promise.all([
    repositories.users.getById(userId),
    repositories.transactions.listByUserId(userId),
    repositories.preferences.getByUserId(userId),
  ]);

  const display = await buildServiceDisplayContext(user.baseCurrency);

  return apiSuccess(
    {
      ...buildSpendingData({
        language: user.displayLanguage,
        transactions: userTransactions,
        profile,
        display,
      }),
      context: {
        transactionCount: userTransactions.length,
        latestBookedAt:
          [...userTransactions].sort((left, right) =>
            right.bookedAt.localeCompare(left.bookedAt),
          )[0]?.bookedAt ?? null,
      },
    },
    "database",
  );
}

export async function updateDisplayCurrency(
  userId: string,
  input: UpdateDisplayCurrencyInput,
): Promise<UserProfile> {
  return getRepositories().users.updateBaseCurrency(userId, input.currency);
}

export async function updateDisplayLanguage(
  userId: string,
  input: UpdateDisplayLanguageInput,
): Promise<UserProfile> {
  return getRepositories().users.updateDisplayLanguage(userId, input.language);
}

export async function getImportView(userId: string) {
  const repositories = getRepositories();
  const [user, userAccounts] = await Promise.all([
    repositories.users.getById(userId),
    repositories.accounts.listByUserId(userId),
  ]);
  const db = getDb();
  const [latestPortfolioRow, latestSpendingRow] = await Promise.all([
    db.query.importJobs.findFirst({
      where: and(
        eq(importJobs.userId, userId),
        eq(importJobs.workflow, "portfolio"),
      ),
      orderBy: desc(importJobs.createdAt),
    }),
    db.query.importJobs.findFirst({
      where: and(
        eq(importJobs.userId, userId),
        eq(importJobs.workflow, "spending"),
      ),
      orderBy: desc(importJobs.createdAt),
    }),
  ]);

  const latestPortfolioJob = latestPortfolioRow
    ? {
        id: latestPortfolioRow.id,
        userId: latestPortfolioRow.userId,
        workflow: latestPortfolioRow.workflow as ImportJob["workflow"],
        status: latestPortfolioRow.status as ImportJob["status"],
        sourceType: latestPortfolioRow.sourceType as "csv",
        fileName: latestPortfolioRow.fileName,
        createdAt: latestPortfolioRow.createdAt.toISOString(),
      }
    : null;

  const latestSpendingJob = latestSpendingRow
    ? {
        id: latestSpendingRow.id,
        userId: latestSpendingRow.userId,
        workflow: latestSpendingRow.workflow as ImportJob["workflow"],
        status: latestSpendingRow.status as ImportJob["status"],
        sourceType: latestSpendingRow.sourceType as "csv",
        fileName: latestSpendingRow.fileName,
        createdAt: latestSpendingRow.createdAt.toISOString(),
      }
    : null;

  return apiSuccess(
    {
      ...buildImportData({
        latestPortfolioJob,
        latestSpendingJob,
        accounts: userAccounts,
        language: user.displayLanguage,
      }),
      latestPortfolioJob,
      latestSpendingJob,
    },
    "database",
  );
}

export async function getPreferenceView(userId: string) {
  const repositories = getRepositories();
  const [user, profile] = await Promise.all([
    repositories.users.getById(userId),
    repositories.preferences.getByUserId(userId),
  ]);
  const db = getDb();
  const guidedDraftRow = await db.query.guidedAllocationDrafts.findFirst({
    where: eq(guidedAllocationDrafts.userId, userId),
  });

  const guidedDraft = guidedDraftRow
    ? ({
        id: guidedDraftRow.id,
        userId: guidedDraftRow.userId,
        answers: guidedDraftRow.answers as GuidedAllocationAnswers,
        suggestedProfile: guidedDraftRow.suggestedProfile as Omit<
          PreferenceProfile,
          | "id"
          | "userId"
          | "watchlistSymbols"
          | "recommendationConstraints"
          | "preferenceFactors"
        >,
        assumptions: guidedDraftRow.assumptions as string[],
        rationale: guidedDraftRow.rationale as string[],
        createdAt: guidedDraftRow.createdAt.toISOString(),
        updatedAt: guidedDraftRow.updatedAt.toISOString(),
      } satisfies GuidedAllocationDraft)
    : null;

  return apiSuccess(
    {
      ...buildSettingsData(profile, user.displayLanguage),
      profile,
      guidedDraft,
    },
    "database",
  );
}

export async function getCitizenProfileView(userId: string) {
  const [viewer, citizen] = await Promise.all([
    getRepositories().users.getById(userId),
    getCitizenProfile(userId),
  ]);

  return apiSuccess(
    {
      viewer,
      citizen,
      isAdmin: getAdminEmails().includes(viewer.email.toLowerCase()),
    },
    "database",
  );
}

export async function updateCitizenProfileOverrides(
  viewerId: string,
  targetUserId: string,
  input: UpdateCitizenOverrideInput,
) {
  const viewer = await getRepositories().users.getById(viewerId);
  if (!getAdminEmails().includes(viewer.email.toLowerCase())) {
    throw new Error(
      "Admin privileges are required to override citizen profile values.",
    );
  }

  const db = getDb();
  const existing = await db.query.citizenProfiles.findFirst({
    where: eq(citizenProfiles.userId, targetUserId),
  });

  if (!existing) {
    throw new Error("Citizen profile not found.");
  }

  const [updated] = await db
    .update(citizenProfiles)
    .set({
      overrideRank:
        input.rank === undefined ? existing.overrideRank : input.rank,
      overrideAddressTier:
        input.addressTier === undefined
          ? existing.overrideAddressTier
          : input.addressTier,
      overrideIdCode:
        input.idCode === undefined ? existing.overrideIdCode : input.idCode,
      updatedAt: new Date(),
    })
    .where(eq(citizenProfiles.id, existing.id))
    .returning();

  return applyEffectiveCitizenValues(mapCitizenProfileRow(updated));
}

export async function saveGuidedAllocationDraft(
  userId: string,
  input: SaveGuidedAllocationDraftInput,
): Promise<GuidedAllocationDraft> {
  const db = getDb();
  const existing = await db.query.guidedAllocationDrafts.findFirst({
    where: eq(guidedAllocationDrafts.userId, userId),
  });

  if (existing) {
    const [updated] = await db
      .update(guidedAllocationDrafts)
      .set({
        answers: input.answers,
        suggestedProfile: input.suggestedProfile,
        assumptions: input.assumptions,
        rationale: input.rationale,
        updatedAt: new Date(),
      })
      .where(eq(guidedAllocationDrafts.id, existing.id))
      .returning();

    return {
      id: updated.id,
      userId: updated.userId,
      answers: updated.answers as GuidedAllocationAnswers,
      suggestedProfile: updated.suggestedProfile as Omit<
        PreferenceProfile,
        | "id"
        | "userId"
        | "watchlistSymbols"
        | "recommendationConstraints"
        | "preferenceFactors"
      >,
      assumptions: updated.assumptions as string[],
      rationale: updated.rationale as string[],
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  const [created] = await db
    .insert(guidedAllocationDrafts)
    .values({
      userId,
      answers: input.answers,
      suggestedProfile: input.suggestedProfile,
      assumptions: input.assumptions,
      rationale: input.rationale,
    })
    .returning();

  return {
    id: created.id,
    userId: created.userId,
    answers: created.answers as GuidedAllocationAnswers,
    suggestedProfile: created.suggestedProfile as Omit<
      PreferenceProfile,
      | "id"
      | "userId"
      | "watchlistSymbols"
      | "recommendationConstraints"
      | "preferenceFactors"
    >,
    assumptions: created.assumptions as string[],
    rationale: created.rationale as string[],
    createdAt: created.createdAt.toISOString(),
    updatedAt: created.updatedAt.toISOString(),
  };
}

export async function listImportMappingPresets(
  userId: string,
): Promise<ImportMappingPreset[]> {
  const db = getDb();
  const rows = await db.query.importMappingPresets.findMany({
    where: eq(importMappingPresets.userId, userId),
  });

  return rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    name: row.name,
    sourceType: row.sourceType as "csv",
    mapping: row.mapping as Record<string, string>,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function saveImportMappingPreset(
  userId: string,
  input: SaveImportMappingPresetInput,
): Promise<ImportMappingPreset> {
  const db = getDb();
  const existing = await db.query.importMappingPresets.findFirst({
    where: and(
      eq(importMappingPresets.userId, userId),
      eq(importMappingPresets.name, input.name),
    ),
  });

  if (existing) {
    const [updated] = await db
      .update(importMappingPresets)
      .set({
        sourceType: input.sourceType,
        mapping: input.mapping,
        updatedAt: new Date(),
      })
      .where(eq(importMappingPresets.id, existing.id))
      .returning();

    return {
      id: updated.id,
      userId: updated.userId,
      name: updated.name,
      sourceType: updated.sourceType as "csv",
      mapping: updated.mapping as Record<string, string>,
      createdAt: updated.createdAt.toISOString(),
    };
  }

  const [created] = await db
    .insert(importMappingPresets)
    .values({
      userId,
      name: input.name,
      sourceType: input.sourceType,
      mapping: input.mapping,
    })
    .returning();

  return {
    id: created.id,
    userId: created.userId,
    name: created.name,
    sourceType: created.sourceType as "csv",
    mapping: created.mapping as Record<string, string>,
    createdAt: created.createdAt.toISOString(),
  };
}

export async function updateImportMappingPreset(
  userId: string,
  presetId: string,
  input: UpdateImportMappingPresetInput,
): Promise<ImportMappingPreset> {
  const db = getDb();
  const existing = await db.query.importMappingPresets.findFirst({
    where: and(
      eq(importMappingPresets.userId, userId),
      eq(importMappingPresets.id, presetId),
    ),
  });

  if (!existing) {
    throw new Error("Import mapping preset not found.");
  }

  const nextName = input.name?.trim() || existing.name;
  if (nextName !== existing.name) {
    const conflicting = await db.query.importMappingPresets.findFirst({
      where: and(
        eq(importMappingPresets.userId, userId),
        eq(importMappingPresets.name, nextName),
      ),
    });
    if (conflicting && conflicting.id !== presetId) {
      throw new Error("A preset with this name already exists.");
    }
  }

  const [updated] = await db
    .update(importMappingPresets)
    .set({
      name: nextName,
      sourceType: input.sourceType ?? (existing.sourceType as "csv"),
      mapping: input.mapping ?? (existing.mapping as Record<string, string>),
      updatedAt: new Date(),
    })
    .where(eq(importMappingPresets.id, presetId))
    .returning();

  return {
    id: updated.id,
    userId: updated.userId,
    name: updated.name,
    sourceType: updated.sourceType as "csv",
    mapping: updated.mapping as Record<string, string>,
    createdAt: updated.createdAt.toISOString(),
  };
}

export async function deleteImportMappingPreset(
  userId: string,
  presetId: string,
): Promise<void> {
  const db = getDb();
  const existing = await db.query.importMappingPresets.findFirst({
    where: and(
      eq(importMappingPresets.userId, userId),
      eq(importMappingPresets.id, presetId),
    ),
  });

  if (!existing) {
    throw new Error("Import mapping preset not found.");
  }

  await db
    .delete(importMappingPresets)
    .where(eq(importMappingPresets.id, presetId));
}

export async function updatePreferenceProfile(
  userId: string,
  input: PreferenceProfileInput,
): Promise<PreferenceProfile> {
  const db = getDb();
  const profileRow = await db.query.preferenceProfiles.findFirst({
    where: eq(preferenceProfiles.userId, userId),
  });
  if (!profileRow) {
    throw new Error(`Preference profile not found for user ${userId}.`);
  }
  const recommendationConstraints =
    input.recommendationConstraints === undefined
      ? normalizeRecommendationConstraints(profileRow.recommendationConstraints)
      : await resolveRecommendationConstraintSymbols(
          input.recommendationConstraints,
        );
  const preferenceFactors =
    input.preferenceFactors === undefined
      ? normalizePreferenceFactors(profileRow.preferenceFactors)
      : normalizePreferenceFactors(input.preferenceFactors);

  return db.transaction(async (tx) => {
    await tx
      .update(preferenceProfiles)
      .set({
        riskProfile: input.riskProfile,
        accountFundingPriority: input.accountFundingPriority,
        taxAwarePlacement: input.taxAwarePlacement,
        cashBufferTargetCad: input.cashBufferTargetCad.toFixed(2),
        transitionPreference: input.transitionPreference,
        recommendationStrategy: input.recommendationStrategy,
        source: input.source ?? "manual",
        rebalancingTolerancePct: input.rebalancingTolerancePct,
        watchlistSymbols: input.watchlistSymbols,
        recommendationConstraints,
        preferenceFactors,
        updatedAt: new Date(),
      })
      .where(eq(preferenceProfiles.id, profileRow.id));

    await tx
      .delete(allocationTargets)
      .where(eq(allocationTargets.preferenceProfileId, profileRow.id));

    if (input.targetAllocation.length > 0) {
      await tx.insert(allocationTargets).values(
        input.targetAllocation.map((target) => ({
          preferenceProfileId: profileRow.id,
          assetClass: target.assetClass,
          targetPct: target.targetPct,
        })),
      );
    }

    return {
      id: profileRow.id,
      userId,
      riskProfile: input.riskProfile,
      targetAllocation: input.targetAllocation,
      accountFundingPriority: input.accountFundingPriority,
      taxAwarePlacement: input.taxAwarePlacement,
      cashBufferTargetCad: input.cashBufferTargetCad,
      transitionPreference: input.transitionPreference,
      recommendationStrategy: input.recommendationStrategy,
      source: input.source ?? "manual",
      rebalancingTolerancePct: input.rebalancingTolerancePct,
      watchlistSymbols: input.watchlistSymbols,
      recommendationConstraints,
      preferenceFactors,
      updatedAt: new Date().toISOString(),
    };
  });
}

export async function addWatchlistSymbol(
  userId: string,
  symbol: string,
): Promise<PreferenceProfile> {
  const normalizedSymbol = symbol.trim().toUpperCase();
  if (!normalizedSymbol) {
    throw new Error("Watchlist symbol is required.");
  }

  const repositories = getRepositories();
  const profile = await repositories.preferences.getByUserId(userId);
  if (profile.watchlistSymbols.includes(normalizedSymbol)) {
    return profile;
  }

  return updatePreferenceProfile(userId, {
    riskProfile: profile.riskProfile,
    targetAllocation: profile.targetAllocation,
    accountFundingPriority: profile.accountFundingPriority,
    taxAwarePlacement: profile.taxAwarePlacement,
    cashBufferTargetCad: profile.cashBufferTargetCad,
    transitionPreference: profile.transitionPreference,
    recommendationStrategy: profile.recommendationStrategy,
    source: profile.source ?? "manual",
    rebalancingTolerancePct: profile.rebalancingTolerancePct,
    watchlistSymbols: [...profile.watchlistSymbols, normalizedSymbol].slice(
      0,
      20,
    ),
    recommendationConstraints: profile.recommendationConstraints,
  });
}

export async function removeWatchlistSymbol(
  userId: string,
  symbol: string,
): Promise<PreferenceProfile> {
  const normalizedSymbol = symbol.trim().toUpperCase();
  if (!normalizedSymbol) {
    throw new Error("Watchlist symbol is required.");
  }

  const repositories = getRepositories();
  const profile = await repositories.preferences.getByUserId(userId);
  if (!profile.watchlistSymbols.includes(normalizedSymbol)) {
    return profile;
  }

  return updatePreferenceProfile(userId, {
    riskProfile: profile.riskProfile,
    targetAllocation: profile.targetAllocation,
    accountFundingPriority: profile.accountFundingPriority,
    taxAwarePlacement: profile.taxAwarePlacement,
    cashBufferTargetCad: profile.cashBufferTargetCad,
    transitionPreference: profile.transitionPreference,
    recommendationStrategy: profile.recommendationStrategy,
    source: profile.source ?? "manual",
    rebalancingTolerancePct: profile.rebalancingTolerancePct,
    watchlistSymbols: profile.watchlistSymbols.filter(
      (entry) => entry !== normalizedSymbol,
    ),
    recommendationConstraints: profile.recommendationConstraints,
  });
}

export async function registerUserWithCitizenProfile(
  input: RegisterUserInput,
): Promise<{
  user: UserProfile;
  citizenProfile: CitizenProfile;
}> {
  const db = getDb();
  const email = input.email.trim().toLowerCase();
  const displayName = input.displayName.trim();

  const existing = await db.query.users.findFirst({
    where: eq(users.email, email),
  });
  if (existing) {
    throw new Error("An account with this email already exists.");
  }

  const passwordHash = await hash(input.password, 10);
  const defaultPreferences = getDefaultPreferenceInput();
  const displayLanguage =
    input.displayLanguage ?? (input.mode === "loo-zh" ? "zh" : "en");

  const user = await db.transaction(async (tx) => {
    const [userRow] = await tx
      .insert(users)
      .values({
        email,
        passwordHash,
        displayName,
        baseCurrency: "CAD",
        displayLanguage,
      })
      .returning();

    const [profileRow] = await tx
      .insert(preferenceProfiles)
      .values({
        userId: userRow.id,
        riskProfile: defaultPreferences.riskProfile,
        accountFundingPriority: defaultPreferences.accountFundingPriority,
        taxAwarePlacement: defaultPreferences.taxAwarePlacement,
        cashBufferTargetCad: defaultPreferences.cashBufferTargetCad.toFixed(2),
        transitionPreference: defaultPreferences.transitionPreference,
        recommendationStrategy: defaultPreferences.recommendationStrategy,
        source: defaultPreferences.source ?? "manual",
        rebalancingTolerancePct: defaultPreferences.rebalancingTolerancePct,
        watchlistSymbols: defaultPreferences.watchlistSymbols,
        recommendationConstraints: defaultPreferences.recommendationConstraints,
        preferenceFactors: defaultPreferences.preferenceFactors,
      })
      .returning();

    await tx.insert(allocationTargets).values(
      defaultPreferences.targetAllocation.map((target) => ({
        preferenceProfileId: profileRow.id,
        assetClass: target.assetClass,
        targetPct: target.targetPct,
      })),
    );

    await tx.insert(importJobs).values({
      userId: userRow.id,
      workflow: "portfolio",
      status: "draft",
      sourceType: "csv",
      fileName: "awaiting-first-import.csv",
    });

    return {
      id: userRow.id,
      email: userRow.email,
      displayName: userRow.displayName,
      baseCurrency: userRow.baseCurrency as CurrencyCode,
      displayLanguage: (userRow.displayLanguage as DisplayLanguage) ?? "zh",
    };
  });

  const citizenProfile = await ensureCitizenProfile(user.id, {
    citizenName: displayName,
    gender: input.gender ?? null,
    birthDate: input.birthDate ?? null,
  });

  return {
    user,
    citizenProfile,
  };
}

export async function scoreCandidateSecurityForUser(
  userId: string,
  input: ScoreCandidateSecurityInput,
) {
  const repositories = getRepositories();
  const [user, accounts, holdings, profile] = await Promise.all([
    repositories.users.getById(userId),
    repositories.accounts.listByUserId(userId),
    repositories.holdings.listByUserId(userId),
    repositories.preferences.getByUserId(userId),
  ]);

  return apiSuccess(
    {
      scorecard: scoreCandidateSecurity({
        accounts,
        holdings,
        profile,
        language: user.displayLanguage,
        candidate: input,
      }),
    },
    "database",
  );
}

export async function scoreCandidateSecuritiesForUser(
  userId: string,
  symbols: string[],
) {
  const repositories = getRepositories();
  const [user, accounts, holdings, profile] = await Promise.all([
    repositories.users.getById(userId),
    repositories.accounts.listByUserId(userId),
    repositories.holdings.listByUserId(userId),
    repositories.preferences.getByUserId(userId),
  ]);

  const uniqueSymbols = [
    ...new Set(
      symbols.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean),
    ),
  ].slice(0, 10);

  return apiSuccess(
    {
      scorecards: uniqueSymbols.map((symbol) =>
        scoreCandidateSecurity({
          accounts,
          holdings,
          profile,
          language: user.displayLanguage,
          candidate: { symbol },
        }),
      ),
    },
    "database",
  );
}

export async function registerUserAccount(
  input: RegisterUserInput,
): Promise<UserProfile> {
  const result = await registerUserWithCitizenProfile(input);
  return result.user;
}

export async function createImportJob(
  userId: string,
  input: CreateImportJobInput,
): Promise<CreateImportJobResult> {
  const db = getDb();

  if (!input.csvContent) {
    const [jobRow] = await db
      .insert(importJobs)
      .values({
        userId,
        workflow: input.workflow,
        status: "draft",
        sourceType: input.sourceType,
        fileName: input.fileName,
      })
      .returning();

    return {
      job: {
        id: jobRow.id,
        userId: jobRow.userId,
        workflow: jobRow.workflow as ImportJob["workflow"],
        status: jobRow.status as ImportJob["status"],
        sourceType: jobRow.sourceType as "csv",
        fileName: jobRow.fileName,
        createdAt: jobRow.createdAt.toISOString(),
      },
      summary: {
        accountsImported: 0,
        holdingsImported: 0,
        transactionsImported: 0,
      },
      validationErrors: [],
      autoRecommendationRun: null,
      review: {
        importMode: input.importMode,
        detectedHeaders: [],
        rowCount: 0,
      },
    };
  }

  const parsed = applySymbolCorrectionsToParsedImport(
    await parseImportCsv(
      filterCsvContentByWorkflow(
        input.csvContent,
        input.fieldMapping,
        input.workflow,
      ),
      input.fieldMapping ?? {},
    ),
    input.symbolCorrections,
  );
  const workflowScopedParsed =
    input.workflow === "spending"
      ? { ...parsed, accounts: [], holdings: [] }
      : { ...parsed, transactions: [] };

  if (
    input.workflow === "portfolio" &&
    workflowScopedParsed.accounts.length === 0 &&
    workflowScopedParsed.holdings.length === 0
  ) {
    throw new Error(
      "Portfolio import requires at least one account or holding row.",
    );
  }

  if (
    input.workflow === "spending" &&
    workflowScopedParsed.transactions.length === 0
  ) {
    throw new Error("Spending import requires at least one transaction row.");
  }

  const review = {
    importMode: input.importMode,
    detectedHeaders: workflowScopedParsed.detectedHeaders,
    rowCount:
      workflowScopedParsed.accounts.length +
      workflowScopedParsed.holdings.length +
      workflowScopedParsed.transactions.length,
  };

  if (input.dryRun) {
    return {
      job: {
        id: "dry-run",
        userId,
        workflow: input.workflow,
        status: parsed.validationErrors.length > 0 ? "draft" : "validated",
        sourceType: input.sourceType,
        fileName: input.fileName,
        createdAt: new Date().toISOString(),
      },
      summary: {
        accountsImported: workflowScopedParsed.accounts.length,
        holdingsImported: workflowScopedParsed.holdings.length,
        transactionsImported: workflowScopedParsed.transactions.length,
      },
      validationErrors: parsed.validationErrors,
      autoRecommendationRun: null,
      review,
    };
  }

  if (parsed.validationErrors.length > 0) {
    const [jobRow] = await db
      .insert(importJobs)
      .values({
        userId,
        workflow: input.workflow,
        status: "draft",
        sourceType: input.sourceType,
        fileName: input.fileName,
      })
      .returning();

    return {
      job: {
        id: jobRow.id,
        userId: jobRow.userId,
        workflow: jobRow.workflow as ImportJob["workflow"],
        status: jobRow.status as ImportJob["status"],
        sourceType: jobRow.sourceType as "csv",
        fileName: jobRow.fileName,
        createdAt: jobRow.createdAt.toISOString(),
      },
      summary: {
        accountsImported: 0,
        holdingsImported: 0,
        transactionsImported: 0,
      },
      validationErrors: parsed.validationErrors,
      autoRecommendationRun: null,
      review,
    };
  }

  const result = await db.transaction(async (tx) => {
    const isReplaceMode = input.importMode === "replace";
    const [jobRow] = await tx
      .insert(importJobs)
      .values({
        userId,
        workflow: input.workflow,
        status: "completed",
        sourceType: input.sourceType,
        fileName: input.fileName,
      })
      .returning();

    if (isReplaceMode) {
      if (input.workflow === "portfolio") {
        await tx
          .delete(holdingPositions)
          .where(eq(holdingPositions.userId, userId));
        await tx
          .delete(investmentAccounts)
          .where(eq(investmentAccounts.userId, userId));
        await tx
          .delete(portfolioEvents)
          .where(eq(portfolioEvents.userId, userId));
        await tx
          .delete(portfolioSnapshots)
          .where(eq(portfolioSnapshots.userId, userId));
      } else {
        await tx
          .delete(cashflowTransactions)
          .where(eq(cashflowTransactions.userId, userId));
      }
    }

    const existingAccounts = isReplaceMode
      ? []
      : await tx
          .select()
          .from(investmentAccounts)
          .where(eq(investmentAccounts.userId, userId));
    const existingHoldings = isReplaceMode
      ? []
      : await tx
          .select()
          .from(holdingPositions)
          .where(eq(holdingPositions.userId, userId));
    const existingTransactions = isReplaceMode
      ? []
      : await tx
          .select()
          .from(cashflowTransactions)
          .where(eq(cashflowTransactions.userId, userId));

    const existingAccountByKey = new Map(
      existingAccounts.map((account) => [
        accountMatchKey({
          institution: account.institution,
          type: account.type as AccountType,
          nickname: account.nickname,
        }),
        account,
      ]),
    );

    const accountIdByKey = new Map<string, string>();
    const accountsToInsert = workflowScopedParsed.accounts.filter((account) => {
      const matched = existingAccountByKey.get(accountMatchKey(account));
      if (matched) {
        accountIdByKey.set(account.accountKey, matched.id);
        return false;
      }
      return true;
    });

    const insertedAccounts =
      accountsToInsert.length > 0
        ? await tx
            .insert(investmentAccounts)
            .values(
              accountsToInsert.map((account) => ({
                userId,
                institution: account.institution,
                type: account.type,
                nickname: account.nickname,
                currency: account.currency,
                marketValueAmount: (
                  account.marketValueAmount ??
                  account.marketValueCad ??
                  0
                ).toFixed(2),
                marketValueCad: (account.marketValueCad ?? 0).toFixed(2),
                contributionRoomCad:
                  account.contributionRoomCad?.toFixed(2) ?? null,
              })),
            )
            .returning()
        : [];

    accountsToInsert.forEach((account, index) => {
      const inserted = insertedAccounts[index];
      if (inserted) {
        accountIdByKey.set(account.accountKey, inserted.id);
      }
    });

    if (!isReplaceMode) {
      for (const account of workflowScopedParsed.accounts) {
        const matched = existingAccountByKey.get(accountMatchKey(account));
        if (matched) {
          await tx
            .update(investmentAccounts)
            .set({
              currency: account.currency,
              marketValueAmount: (
                account.marketValueAmount ??
                account.marketValueCad ??
                0
              ).toFixed(2),
              marketValueCad: (account.marketValueCad ?? 0).toFixed(2),
              contributionRoomCad:
                account.contributionRoomCad?.toFixed(2) ?? null,
              updatedAt: new Date(),
            })
            .where(eq(investmentAccounts.id, matched.id));
        }
      }
    }

    const existingHoldingByKey = new Map(
      existingHoldings.map((holding) => [
        holdingMatchKey(
          holding.accountId,
          holding.symbol,
          normalizeCurrencyCode((holding.currency as string) || "CAD"),
          holding.exchangeOverride,
        ),
        holding,
      ]),
    );
    const holdingsToInsert: Array<{
      userId: string;
      accountId: string;
      symbol: string;
      name: string;
      assetClass: string;
      sector: string;
      currency: CurrencyCode;
      quantity: string | null;
      avgCostPerShareAmount: string | null;
      costBasisAmount: string | null;
      lastPriceAmount: string | null;
      marketValueAmount: string;
      avgCostPerShareCad: string | null;
      costBasisCad: string | null;
      lastPriceCad: string | null;
      marketValueCad: string;
      weightPct: string;
      gainLossPct: string;
      exchangeOverride: string | null;
    }> = [];

    for (const holding of workflowScopedParsed.holdings) {
      const accountId = accountIdByKey.get(holding.accountKey);
      if (!accountId) {
        throw new Error(
          `Holding ${holding.symbol} references unknown account_key ${holding.accountKey}.`,
        );
      }

      const payload = {
        userId,
        accountId,
        symbol: holding.symbol,
        name: holding.name,
        exchangeOverride: holding.exchange?.trim() || null,
        assetClass: holding.assetClass,
        sector: holding.sector,
        currency: holding.currency,
        quantity: holding.quantity?.toFixed(6) ?? null,
        avgCostPerShareAmount:
          holding.avgCostPerShareAmount?.toFixed(4) ?? null,
        costBasisAmount: holding.costBasisAmount?.toFixed(2) ?? null,
        lastPriceAmount: holding.lastPriceAmount?.toFixed(4) ?? null,
        marketValueAmount: holding.marketValueAmount.toFixed(2),
        avgCostPerShareCad: holding.avgCostPerShareCad?.toFixed(4) ?? null,
        costBasisCad: holding.costBasisCad?.toFixed(2) ?? null,
        lastPriceCad: holding.lastPriceCad?.toFixed(4) ?? null,
        marketValueCad: holding.marketValueCad.toFixed(2),
        weightPct: (holding.weightPct ?? 0).toFixed(2),
        gainLossPct: holding.gainLossPct.toFixed(2),
      };
      const matchedHolding = existingHoldingByKey.get(
        holdingMatchKey(
          accountId,
          holding.symbol,
          holding.currency,
          holding.exchange,
        ),
      );

      if (matchedHolding) {
        const previousQuantity =
          matchedHolding.quantity == null ? 0 : Number(matchedHolding.quantity);
        const nextQuantity = holding.quantity ?? 0;
        await tx
          .update(holdingPositions)
          .set({
            name: payload.name,
            exchangeOverride: payload.exchangeOverride,
            assetClass: payload.assetClass,
            sector: payload.sector,
            currency: payload.currency,
            quantity: payload.quantity,
            avgCostPerShareAmount: payload.avgCostPerShareAmount,
            costBasisAmount: payload.costBasisAmount,
            lastPriceAmount: payload.lastPriceAmount,
            marketValueAmount: payload.marketValueAmount,
            avgCostPerShareCad: payload.avgCostPerShareCad,
            costBasisCad: payload.costBasisCad,
            lastPriceCad: payload.lastPriceCad,
            marketValueCad: payload.marketValueCad,
            weightPct: payload.weightPct,
            gainLossPct: payload.gainLossPct,
            updatedAt: new Date(),
          })
          .where(eq(holdingPositions.id, matchedHolding.id));

        const quantityDelta = nextQuantity - previousQuantity;
        if (Math.abs(quantityDelta) > 0.000001) {
          await createPortfolioEvent(tx, {
            userId,
            accountId,
            symbol: holding.symbol,
            eventType: "adjustment",
            quantity: quantityDelta,
            priceAmount: holding.lastPriceAmount ?? null,
            currency: holding.currency,
            source: "portfolio-import",
          });
        }
      } else {
        holdingsToInsert.push(payload);
      }
    }

    if (holdingsToInsert.length > 0) {
      await tx.insert(holdingPositions).values(holdingsToInsert);
      const insertedHoldingInputs = workflowScopedParsed.holdings.filter(
        (holding) => {
          const accountId = accountIdByKey.get(holding.accountKey);
          if (!accountId) {
            return false;
          }
          return !existingHoldingByKey.has(
            holdingMatchKey(
              accountId,
              holding.symbol,
              holding.currency,
              holding.exchange,
            ),
          );
        },
      );
      for (const holding of insertedHoldingInputs) {
        const accountId = accountIdByKey.get(holding.accountKey);
        if (!accountId || holding.quantity == null || holding.quantity <= 0) {
          continue;
        }
        await createPortfolioEvent(tx, {
          userId,
          accountId,
          symbol: holding.symbol,
          eventType: "buy",
          quantity: holding.quantity,
          priceAmount: holding.lastPriceAmount ?? null,
          currency: holding.currency,
          source: "portfolio-import",
        });
      }
    }

    const existingTransactionByKey = new Map(
      existingTransactions.map((transaction) => [
        transactionMatchKey({
          accountId: transaction.accountId,
          bookedAt: transaction.bookedAt,
          merchant: transaction.merchant,
          category: transaction.category,
          amountCad: Number(transaction.amountCad),
          direction: transaction.direction as "inflow" | "outflow",
        }),
        transaction,
      ]),
    );

    const transactionsToInsert: Array<{
      userId: string;
      accountId: string | null;
      bookedAt: string;
      merchant: string;
      category: string;
      amountCad: string;
      direction: "inflow" | "outflow";
    }> = [];

    for (const transaction of workflowScopedParsed.transactions) {
      const accountId = transaction.accountKey
        ? (accountIdByKey.get(transaction.accountKey) ?? null)
        : null;
      if (
        input.workflow !== "spending" &&
        transaction.accountKey &&
        !accountId
      ) {
        throw new Error(
          `Transaction ${transaction.merchant} references unknown account_key ${transaction.accountKey}.`,
        );
      }

      const payload = {
        userId,
        accountId,
        bookedAt: transaction.bookedAt,
        merchant: transaction.merchant,
        category: transaction.category,
        amountCad: transaction.amountCad.toFixed(2),
        direction: transaction.direction,
      };

      if (
        !existingTransactionByKey.has(
          transactionMatchKey({
            accountId,
            bookedAt: transaction.bookedAt,
            merchant: transaction.merchant,
            category: transaction.category,
            amountCad: transaction.amountCad,
            direction: transaction.direction,
          }),
        )
      ) {
        transactionsToInsert.push(payload);
      }
    }

    if (transactionsToInsert.length > 0) {
      await tx.insert(cashflowTransactions).values(transactionsToInsert);
    }

    if (input.workflow === "spending") {
      await rebuildDerivedCashBalanceHistory(tx, userId);
    }

    return {
      job: {
        id: jobRow.id,
        userId: jobRow.userId,
        workflow: jobRow.workflow as ImportJob["workflow"],
        status: jobRow.status as ImportJob["status"],
        sourceType: jobRow.sourceType as "csv",
        fileName: jobRow.fileName,
        createdAt: jobRow.createdAt.toISOString(),
      },
      summary: {
        accountsImported: isReplaceMode
          ? workflowScopedParsed.accounts.length
          : accountsToInsert.length,
        holdingsImported: isReplaceMode
          ? workflowScopedParsed.holdings.length
          : holdingsToInsert.length,
        transactionsImported: isReplaceMode
          ? workflowScopedParsed.transactions.length
          : transactionsToInsert.length,
      },
      validationErrors: [],
      autoRecommendationRun: null,
      review,
    };
  });

  let autoRecommendationRun: CreateImportJobResult["autoRecommendationRun"] =
    null;
  if (
    input.workflow === "portfolio" &&
    result.summary.accountsImported > 0 &&
    result.summary.holdingsImported > 0
  ) {
    try {
      const repositories = getRepositories();
      const [profile, transactions] = await Promise.all([
        repositories.preferences.getByUserId(userId),
        repositories.transactions.listByUserId(userId),
      ]);
      const contributionAmountCad = getAutoRecommendationAmount(
        profile,
        transactions,
      );
      const run = await createRecommendationRun(userId, {
        contributionAmountCad,
      });
      autoRecommendationRun = {
        id: run.id,
        contributionAmountCad: run.contributionAmountCad,
        itemCount: run.items.length,
      };
    } catch {
      autoRecommendationRun = null;
    }
  }

  return {
    ...result,
    autoRecommendationRun,
  };
}

export async function createGuidedImportAccount(
  userId: string,
  input: CreateGuidedImportInput,
): Promise<CreateGuidedImportResult> {
  const db = getDb();

  const result = await db.transaction(async (tx) => {
    let accountRow: typeof investmentAccounts.$inferSelect;
    if (input.accountMode === "existing" && input.existingAccountId) {
      const existing = await tx.query.investmentAccounts.findFirst({
        where: and(
          eq(investmentAccounts.userId, userId),
          eq(investmentAccounts.id, input.existingAccountId),
        ),
      });
      if (!existing) {
        throw new Error("Selected account was not found.");
      }
      const [updatedAccount] = await tx
        .update(investmentAccounts)
        .set({
          institution: input.institution,
          nickname: input.nickname,
          currency: input.currency,
          contributionRoomCad: input.contributionRoomCad.toFixed(2),
          updatedAt: new Date(),
        })
        .where(eq(investmentAccounts.id, existing.id))
        .returning();
      accountRow = updatedAccount;
    } else {
      [accountRow] = await tx
        .insert(investmentAccounts)
        .values({
          userId,
          institution: input.institution,
          type: input.accountType,
          nickname: input.nickname,
          currency: input.currency,
          marketValueAmount: input.initialMarketValueAmount.toFixed(2),
          marketValueCad: (
            (await toCadAmount(
              input.initialMarketValueAmount,
              input.currency,
            )) ?? 0
          ).toFixed(2),
          contributionRoomCad: input.contributionRoomCad.toFixed(2),
        })
        .returning();
    }

    let createdHoldingSymbol: string | null = null;
    if (
      input.method === "manual-entry" &&
      input.holdings &&
      input.holdings.length > 0
    ) {
      const existingHoldings = await tx
        .select()
        .from(holdingPositions)
        .where(
          and(
            eq(holdingPositions.userId, userId),
            eq(holdingPositions.accountId, accountRow.id),
          ),
        );
      const existingHoldingByIdentity = new Map(
        existingHoldings.map((holding) => [
          holdingIdentityKey(
            holding.symbol,
            normalizeCurrencyCode(holding.currency),
            holding.exchangeOverride,
          ),
          holding,
        ]),
      );
      const normalizedHoldings = await Promise.all(
        input.holdings.map(normalizeManualHolding),
      );

      for (const holding of normalizedHoldings) {
        const matched = existingHoldingByIdentity.get(
          holdingIdentityKey(
            holding.symbol,
            holding.currency,
            holding.exchange,
          ),
        );
        if (matched) {
          await tx
            .update(holdingPositions)
            .set({
              name: holding.name,
              exchangeOverride: holding.exchange,
              assetClass: holding.assetClass,
              sector: holding.sector,
              currency: holding.currency,
              quantity: holding.quantity?.toFixed(6) ?? null,
              avgCostPerShareAmount:
                holding.avgCostPerShareAmount?.toFixed(4) ?? null,
              costBasisAmount: holding.costBasisAmount?.toFixed(2) ?? null,
              lastPriceAmount: holding.lastPriceAmount?.toFixed(4) ?? null,
              marketValueAmount: holding.marketValueAmount.toFixed(2),
              avgCostPerShareCad:
                holding.avgCostPerShareCad?.toFixed(4) ?? null,
              costBasisCad: holding.costBasisCad?.toFixed(2) ?? null,
              lastPriceCad: holding.lastPriceCad?.toFixed(4) ?? null,
              marketValueCad: holding.marketValueCad.toFixed(2),
              gainLossPct: holding.gainLossPct.toFixed(2),
              updatedAt: new Date(),
            })
            .where(eq(holdingPositions.id, matched.id));
        } else {
          await tx.insert(holdingPositions).values({
            userId,
            accountId: accountRow.id,
            symbol: holding.symbol,
            name: holding.name,
            exchangeOverride: holding.exchange,
            assetClass: holding.assetClass,
            sector: holding.sector,
            currency: holding.currency,
            quantity: holding.quantity?.toFixed(6) ?? null,
            avgCostPerShareAmount:
              holding.avgCostPerShareAmount?.toFixed(4) ?? null,
            costBasisAmount: holding.costBasisAmount?.toFixed(2) ?? null,
            lastPriceAmount: holding.lastPriceAmount?.toFixed(4) ?? null,
            marketValueAmount: holding.marketValueAmount.toFixed(2),
            avgCostPerShareCad: holding.avgCostPerShareCad?.toFixed(4) ?? null,
            costBasisCad: holding.costBasisCad?.toFixed(2) ?? null,
            lastPriceCad: holding.lastPriceCad?.toFixed(4) ?? null,
            marketValueCad: holding.marketValueCad.toFixed(2),
            weightPct: "0.00",
            gainLossPct: holding.gainLossPct.toFixed(2),
          });
        }
      }

      await recalculatePortfolioState(tx, userId);
      const [updatedAccount] = await tx
        .select()
        .from(investmentAccounts)
        .where(eq(investmentAccounts.id, accountRow.id))
        .limit(1);
      accountRow = updatedAccount;
      createdHoldingSymbol = normalizedHoldings
        .map((holding) => holding.symbol)
        .join(", ");
    }

    let importJob: ImportJob | null = null;
    if (input.method !== "manual-entry") {
      const [jobRow] = await tx
        .insert(importJobs)
        .values({
          userId,
          workflow: "portfolio",
          status: "draft",
          sourceType: "csv",
          fileName: `guided-${input.accountType.toLowerCase()}-${input.nickname.replace(/\s+/g, "-").toLowerCase()}.csv`,
        })
        .returning();

      importJob = {
        id: jobRow.id,
        userId: jobRow.userId,
        workflow: jobRow.workflow as ImportJob["workflow"],
        status: jobRow.status as ImportJob["status"],
        sourceType: jobRow.sourceType as "csv",
        fileName: jobRow.fileName,
        createdAt: jobRow.createdAt.toISOString(),
      };
    }

    return {
      account: {
        id: accountRow.id,
        userId: accountRow.userId,
        institution: accountRow.institution,
        type: accountRow.type as AccountType,
        nickname: accountRow.nickname,
        currency: accountRow.currency as CurrencyCode,
        marketValueAmount: Number(accountRow.marketValueAmount),
        marketValueCad: Number(accountRow.marketValueCad),
        contributionRoomCad:
          accountRow.contributionRoomCad == null
            ? null
            : Number(accountRow.contributionRoomCad),
      },
      importJob,
      createdHoldingSymbol,
    };
  });

  let autoRecommendationRun: CreateGuidedImportResult["autoRecommendationRun"] =
    null;
  try {
    const repositories = getRepositories();
    const [holdings, profile, transactions] = await Promise.all([
      repositories.holdings.listByUserId(userId),
      repositories.preferences.getByUserId(userId),
      repositories.transactions.listByUserId(userId),
    ]);

    if (holdings.length > 0) {
      const run = await createRecommendationRun(userId, {
        contributionAmountCad: getAutoRecommendationAmount(
          profile,
          transactions,
        ),
      });
      autoRecommendationRun = {
        id: run.id,
        contributionAmountCad: run.contributionAmountCad,
        itemCount: run.items.length,
      };
    }
  } catch {
    autoRecommendationRun = null;
  }

  return {
    ...result,
    autoRecommendationRun,
  };
}

export async function refreshPortfolioQuotes(
  userId: string,
  options: { refreshRunId?: string | null } = {},
): Promise<RefreshPortfolioQuotesResult> {
  const db = getDb();
  const repositories = getRepositories();
  const holdings = await repositories.holdings.listByUserId(userId);
  const resolvedHoldings = await Promise.all(
    holdings.map(async (holding) => ({
      holding,
      security: await resolveSecurityIdentityForHolding(holding),
    })),
  );
  const resolvedHoldingById = new Map(
    resolvedHoldings.map((entry) => [entry.holding.id, entry.security]),
  );
  const uniqueSymbols = [
    ...new Map(
      resolvedHoldings
        .map(({ security }) => ({
          securityId: security.id,
          symbol: security.symbol,
          exchange: security.canonicalExchange,
          currency: security.currency,
        }))
        .filter((holding) => holding.symbol)
        .map((holding) => [
          holding.securityId,
          holding,
        ]),
    ).values(),
  ];
  const usdToCadFx = await getStoredOrFallbackFxContext("USD", "CAD");

  if (uniqueSymbols.length === 0) {
    return {
      refreshedHoldingCount: 0,
      missingQuoteCount: 0,
      sampledSymbolCount: 0,
      historyPointCount: 0,
      snapshotRecorded: false,
      fxRateLabel: formatFxRefreshLabel(usdToCadFx),
      fxAsOf: usdToCadFx.rateDate,
      fxSource: usdToCadFx.source,
      fxFreshness: usdToCadFx.freshness,
      refreshedAt: new Date().toISOString(),
    };
  }

  const { getBatchSecurityQuotes } = await import("@/lib/market-data/service");
  const quoteResults = await getBatchSecurityQuotes(uniqueSymbols);
  const quoteMap = new Map<string, (typeof quoteResults.results)[number]>();
  quoteResults.results.forEach((quote, index) => {
    const request = uniqueSymbols[index];
    if (request && Number.isFinite(quote.price) && quote.price > 0) {
      quoteMap.set(request.securityId, quote);
    }
  });

  const refreshedAt = new Date();
  const refreshedDate = refreshedAt.toISOString().slice(0, 10);
  let refreshedHoldingCount = 0;
  const missingQuoteKeys = new Set<string>();
  const historyPointMap = new Map<string, SecurityPriceHistoryPoint>();
  uniqueSymbols.forEach((request, index) => {
    const quote = quoteResults.results[index];
    if (!quote || !Number.isFinite(quote.price) || quote.price <= 0) {
      return;
    }
    const point: SecurityPriceHistoryPoint = {
      id: `quote-refresh-${request.securityId}-${refreshedDate}`,
      securityId: request.securityId,
      symbol: request.symbol,
      exchange: normalizeExchangeCode(request.exchange),
      priceDate: refreshedDate,
      close: quote.price,
      adjustedClose: null,
      currency: request.currency,
      source: `quote-refresh-${quote.provider}`,
      provider: quote.provider,
      sourceMode: getQuoteSourceMode(quote),
      freshness: getQuoteStatus(quote),
      refreshRunId: options.refreshRunId ?? null,
      isReference: false,
      fallbackReason: null,
      createdAt: refreshedAt.toISOString(),
    };
    historyPointMap.set(
      `${point.securityId ?? point.symbol}::${point.priceDate}`,
      point,
    );
  });
  const historyPoints = [...historyPointMap.values()];

  await db.transaction(async (tx) => {
    await upsertSecurityPriceHistoryPointsInTransaction(tx, historyPoints);

    const currentHoldings = await tx
      .select()
      .from(holdingPositions)
      .where(eq(holdingPositions.userId, userId));

    for (const holding of currentHoldings) {
      const requestedCurrency = normalizeCurrencyCode(
        (holding.currency as string) || "CAD",
      );
      const security = resolvedHoldingById.get(holding.id);
      const quoteKey = security?.id ?? "";
      const quote = quoteMap.get(quoteKey);
      if (!quote) {
        missingQuoteKeys.add(quoteKey || holding.id);
        const missingStatus = getMissingQuoteStatus(holding);
        await tx
          .update(holdingPositions)
          .set({
            quoteSourceMode: missingStatus.sourceMode,
            quoteStatus: missingStatus.status,
            quoteCurrency: requestedCurrency,
            securityId: security?.id ?? null,
            quoteExchange:
              security?.canonicalExchange ??
              normalizeExchangeCode(holding.exchangeOverride),
            lastQuoteAttemptedAt: refreshedAt,
            lastQuoteErrorCode: missingStatus.errorCode,
            lastQuoteErrorMessage: missingStatus.errorMessage,
            marketDataRefreshRunId: options.refreshRunId ?? null,
          })
          .where(eq(holdingPositions.id, holding.id));
        continue;
      }
      const priceInCad =
        requestedCurrency === "CAD"
          ? quote.price
          : quote.price * usdToCadFx.rate;

      const quantity =
        holding.quantity == null ? null : Number(holding.quantity);
      const currentMarketValue =
        quantity != null && quantity > 0
          ? round(quantity * quote.price)
          : Number(holding.marketValueAmount ?? holding.marketValueCad);
      const currentMarketValueCad =
        quantity != null && quantity > 0
          ? round(quantity * priceInCad)
          : Number(holding.marketValueCad);
      const costBasis =
        holding.costBasisCad == null ? null : Number(holding.costBasisCad);
      const gainLossPct =
        costBasis != null && costBasis > 0
          ? round(((currentMarketValueCad - costBasis) / costBasis) * 100, 2)
          : Number(holding.gainLossPct);

      await tx
        .update(holdingPositions)
        .set({
          currency: requestedCurrency,
          securityId: security?.id ?? null,
          lastPriceAmount: quote.price.toFixed(4),
          lastPriceCad: priceInCad.toFixed(4),
          marketValueAmount: currentMarketValue.toFixed(2),
          marketValueCad: currentMarketValueCad.toFixed(2),
          quoteProvider: quote.provider,
          quoteSourceMode: getQuoteSourceMode(quote),
          quoteStatus: getQuoteStatus(quote),
          quoteCurrency: requestedCurrency,
          quoteExchange: normalizeExchangeCode(
            quote.exchange ||
              security?.canonicalExchange ||
              holding.exchangeOverride,
          ),
          quoteProviderTimestamp: parseProviderTimestamp(quote.timestamp),
          lastQuoteAttemptedAt: refreshedAt,
          lastQuoteSuccessAt: refreshedAt,
          lastQuoteErrorCode: null,
          lastQuoteErrorMessage: null,
          marketDataRefreshRunId: options.refreshRunId ?? null,
          gainLossPct: gainLossPct.toFixed(2),
          updatedAt: refreshedAt,
        })
        .where(eq(holdingPositions.id, holding.id));

      refreshedHoldingCount += 1;
    }

    await recalculatePortfolioState(tx, userId, {
      refreshRunId: options.refreshRunId ?? null,
      sourceMode: "quote-refresh",
      freshness: refreshedHoldingCount > 0 ? "fresh" : "stale",
    });
  });

  return {
    refreshedHoldingCount,
    missingQuoteCount: missingQuoteKeys.size,
    sampledSymbolCount: uniqueSymbols.length,
    historyPointCount: historyPoints.length,
    snapshotRecorded: refreshedHoldingCount > 0,
    fxRateLabel: formatFxRefreshLabel(usdToCadFx),
    fxAsOf: usdToCadFx.rateDate,
    fxSource: usdToCadFx.source,
    fxFreshness: usdToCadFx.freshness,
    refreshedAt: refreshedAt.toISOString(),
  };
}

export async function refreshPortfolioSecurityQuote(
  userId: string,
  symbol: string,
  identity?: {
    securityId?: string | null;
    exchange?: string | null;
    currency?: CurrencyCode | null;
  },
) {
  const normalizedSymbol = symbol.trim().toUpperCase();
  const requestedExchange = normalizeExchangeCode(identity?.exchange);
  const requestedSecurityId = identity?.securityId?.trim() || null;
  const requestedCurrency = identity?.currency
    ? normalizeCurrencyCode(identity.currency)
    : null;
  const db = getDb();
  const repositories = getRepositories();
  const holdings = (await repositories.holdings.listByUserId(userId)).filter(
    (holding) => {
      const sameSymbol = holding.symbol.trim().toUpperCase() === normalizedSymbol;
      const sameSecurity =
        !requestedSecurityId || holding.securityId === requestedSecurityId;
      const sameExchange =
        !requestedExchange ||
        normalizeExchangeCode(holding.exchangeOverride) === requestedExchange;
      const sameCurrency =
        !requestedCurrency ||
        normalizeCurrencyCode((holding.currency as string) || "CAD") ===
          requestedCurrency;
      return sameSecurity && sameSymbol && sameExchange && sameCurrency;
    },
  );

  const resolvedHoldings = await Promise.all(
    holdings.map(async (holding) => ({
      holding,
      security: await resolveSecurityIdentityForHolding(holding),
    })),
  );
  const resolvedHoldingById = new Map(
    resolvedHoldings.map((entry) => [entry.holding.id, entry.security]),
  );
  const matchedHoldingIds = new Set(
    resolvedHoldings.map((entry) => entry.holding.id),
  );

  const uniqueSymbols = [
    ...new Map(
      resolvedHoldings
        .map(({ security }) => ({
          securityId: security.id,
          symbol: security.symbol,
          exchange: security.canonicalExchange,
          currency: security.currency,
        }))
        .filter((holding) => holding.symbol)
        .map((holding) => [holding.securityId, holding]),
    ).values(),
  ];
  const usdToCadFx = await getStoredOrFallbackFxContext("USD", "CAD");

  if (uniqueSymbols.length === 0) {
    const quote = await getSecurityQuote(normalizedSymbol, {
      exchange: requestedExchange || null,
      currency: requestedCurrency,
    }).catch(() => null);
    const quoteFound = Boolean(quote?.result?.price && quote.result.price > 0);
    const refreshedAt = new Date();
    const refreshedDate = refreshedAt.toISOString().slice(0, 10);
    const quoteCurrency = normalizeCurrencyCode(
      quote?.result?.currency || requestedCurrency || "CAD",
    );
    const quoteExchange = normalizeExchangeCode(
      quote?.result?.exchange || requestedExchange,
    );
    const requestedSecurity = requestedSecurityId
      ? await repositories.securities.getById(requestedSecurityId)
      : null;
    const canonicalSecurity =
      requestedSecurity ??
      (await resolveCanonicalSecurityIdentity({
        symbol: normalizedSymbol,
        exchange: quoteExchange || requestedExchange || null,
        currency: quoteCurrency,
        provider: quote?.result?.provider ?? null,
      }));

    if (quoteFound) {
      await db.transaction(async (tx) => {
        await upsertSecurityPriceHistoryPointsInTransaction(tx, [
          {
            id: `quote-refresh-${canonicalSecurity.id}-${refreshedDate}`,
            securityId: canonicalSecurity.id,
            symbol: canonicalSecurity.symbol,
            exchange: canonicalSecurity.canonicalExchange,
            priceDate: refreshedDate,
            close: quote!.result.price,
            adjustedClose: null,
            currency: canonicalSecurity.currency,
            source: `quote-refresh-${quote!.result.provider}`,
            provider: quote!.result.provider,
            sourceMode: getQuoteSourceMode(quote!.result),
            freshness: getQuoteStatus(quote!.result),
            refreshRunId: null,
            isReference: false,
            fallbackReason: null,
            createdAt: refreshedAt.toISOString(),
          },
        ]);
      });
    }

    return {
      symbol: normalizedSymbol,
      matchedHoldingCount: 0,
      refreshedHoldingCount: 0,
      missingQuoteCount: quoteFound ? 0 : 1,
      sampledSymbolCount: 1,
      ambiguousHoldingCount: 0,
      quoteFound,
      quotePrice: quoteFound ? (quote?.result.price ?? null) : null,
      securityId: canonicalSecurity.id,
      quoteCurrency: quote?.result?.currency ?? canonicalSecurity.currency,
      historyPointCount: quoteFound ? 1 : 0,
      snapshotRecorded: false,
      fxRateLabel: formatFxRefreshLabel(usdToCadFx),
      fxAsOf: usdToCadFx.rateDate,
      fxSource: usdToCadFx.source,
      fxFreshness: usdToCadFx.freshness,
      refreshedAt: new Date().toISOString(),
    };
  }

  const { getBatchSecurityQuotes } = await import("@/lib/market-data/service");
  const quoteResults = await getBatchSecurityQuotes(uniqueSymbols);
  const quoteMap = new Map<string, (typeof quoteResults.results)[number]>();
  quoteResults.results.forEach((quote, index) => {
    const request = uniqueSymbols[index];
    if (request && Number.isFinite(quote.price) && quote.price > 0) {
      quoteMap.set(
        request.securityId,
        quote,
      );
    }
  });

  const refreshedAt = new Date();
  const refreshedDate = refreshedAt.toISOString().slice(0, 10);
  let refreshedHoldingCount = 0;
  const missingQuoteKeys = new Set<string>();
  const historyPointMap = new Map<string, SecurityPriceHistoryPoint>();
  uniqueSymbols.forEach((request, index) => {
    const quote = quoteResults.results[index];
    if (!quote || !Number.isFinite(quote.price) || quote.price <= 0) {
      return;
    }
    const point: SecurityPriceHistoryPoint = {
      id: `quote-refresh-${request.securityId}-${refreshedDate}`,
      securityId: request.securityId,
      symbol: request.symbol,
      exchange: normalizeExchangeCode(request.exchange),
      priceDate: refreshedDate,
      close: quote.price,
      adjustedClose: null,
      currency: request.currency,
      source: `quote-refresh-${quote.provider}`,
      provider: quote.provider,
      sourceMode: getQuoteSourceMode(quote),
      freshness: getQuoteStatus(quote),
      refreshRunId: null,
      isReference: false,
      fallbackReason: null,
      createdAt: refreshedAt.toISOString(),
    };
    historyPointMap.set(
      `${point.securityId ?? point.symbol}::${point.priceDate}`,
      point,
    );
  });
  const historyPoints = [...historyPointMap.values()];

  await db.transaction(async (tx) => {
    await upsertSecurityPriceHistoryPointsInTransaction(tx, historyPoints);

    const currentHoldings = await tx
      .select()
      .from(holdingPositions)
      .where(eq(holdingPositions.userId, userId));

    for (const holding of currentHoldings) {
      if (holding.symbol.trim().toUpperCase() !== normalizedSymbol) {
        continue;
      }
      if (!matchedHoldingIds.has(holding.id)) {
        continue;
      }

      const requestedCurrency = normalizeCurrencyCode(
        (holding.currency as string) || "CAD",
      );
      const security = resolvedHoldingById.get(holding.id);
      const quoteKey = security?.id ?? "";
      const quote = quoteMap.get(quoteKey);
      if (!quote) {
        missingQuoteKeys.add(quoteKey || holding.id);
        const missingStatus = getMissingQuoteStatus(holding);
        await tx
          .update(holdingPositions)
          .set({
            quoteSourceMode: missingStatus.sourceMode,
            quoteStatus: missingStatus.status,
            quoteCurrency: requestedCurrency,
            securityId: security?.id ?? null,
            quoteExchange:
              security?.canonicalExchange ??
              normalizeExchangeCode(holding.exchangeOverride),
            lastQuoteAttemptedAt: refreshedAt,
            lastQuoteErrorCode: missingStatus.errorCode,
            lastQuoteErrorMessage: missingStatus.errorMessage,
            marketDataRefreshRunId: null,
          })
          .where(eq(holdingPositions.id, holding.id));
        continue;
      }

      const priceInCad =
        requestedCurrency === "CAD"
          ? quote.price
          : quote.price * usdToCadFx.rate;

      const quantity =
        holding.quantity == null ? null : Number(holding.quantity);
      const currentMarketValue =
        quantity != null && quantity > 0
          ? round(quantity * quote.price)
          : Number(holding.marketValueAmount ?? holding.marketValueCad);
      const currentMarketValueCad =
        quantity != null && quantity > 0
          ? round(quantity * priceInCad)
          : Number(holding.marketValueCad);
      const costBasis =
        holding.costBasisCad == null ? null : Number(holding.costBasisCad);
      const gainLossPct =
        costBasis != null && costBasis > 0
          ? round(((currentMarketValueCad - costBasis) / costBasis) * 100, 2)
          : Number(holding.gainLossPct);

      await tx
        .update(holdingPositions)
        .set({
          currency: requestedCurrency,
          securityId: security?.id ?? null,
          lastPriceAmount: quote.price.toFixed(4),
          lastPriceCad: priceInCad.toFixed(4),
          marketValueAmount: currentMarketValue.toFixed(2),
          marketValueCad: currentMarketValueCad.toFixed(2),
          quoteProvider: quote.provider,
          quoteSourceMode: getQuoteSourceMode(quote),
          quoteStatus: getQuoteStatus(quote),
          quoteCurrency: requestedCurrency,
          quoteExchange: normalizeExchangeCode(
            quote.exchange ||
              security?.canonicalExchange ||
              holding.exchangeOverride,
          ),
          quoteProviderTimestamp: parseProviderTimestamp(quote.timestamp),
          lastQuoteAttemptedAt: refreshedAt,
          lastQuoteSuccessAt: refreshedAt,
          lastQuoteErrorCode: null,
          lastQuoteErrorMessage: null,
          marketDataRefreshRunId: null,
          gainLossPct: gainLossPct.toFixed(2),
          updatedAt: refreshedAt,
        })
        .where(eq(holdingPositions.id, holding.id));

      refreshedHoldingCount += 1;
    }

    if (refreshedHoldingCount > 0) {
      await recalculatePortfolioState(tx, userId, {
        sourceMode: "quote-refresh",
        freshness: "fresh",
      });
    }
  });

  const firstQuote =
    quoteResults.results.find(
      (quote) => Number.isFinite(quote.price) && quote.price > 0,
    ) ?? null;

  return {
    symbol: normalizedSymbol,
    matchedHoldingCount: holdings.length,
    refreshedHoldingCount,
    missingQuoteCount: missingQuoteKeys.size,
    sampledSymbolCount: uniqueSymbols.length,
    ambiguousHoldingCount: 0,
    quoteFound: quoteMap.size > 0,
    quotePrice: firstQuote?.price ?? null,
    quoteCurrency: firstQuote?.currency ?? null,
    historyPointCount: historyPoints.length,
    snapshotRecorded: refreshedHoldingCount > 0,
    fxRateLabel: formatFxRefreshLabel(usdToCadFx),
    fxAsOf: usdToCadFx.rateDate,
    fxSource: usdToCadFx.source,
    fxFreshness: usdToCadFx.freshness,
    refreshedAt: refreshedAt.toISOString(),
  };
}

export async function createRecommendationRun(
  userId: string,
  input: CreateRecommendationRunInput,
): Promise<RecommendationRun> {
  const repositories = getRepositories();
  const [user, accounts, holdings, profile] = await Promise.all([
    repositories.users.getById(userId),
    repositories.accounts.listByUserId(userId),
    repositories.holdings.listByUserId(userId),
    repositories.preferences.getByUserId(userId),
  ]);

  if (accounts.length === 0 || holdings.length === 0) {
    throw new Error(
      "Import accounts and holdings before generating a recommendation run.",
    );
  }

  const recommendation = buildRecommendationV2({
    accounts,
    holdings,
    profile,
    contributionAmountCad: input.contributionAmountCad,
    language: user.displayLanguage,
  });

  const db = getDb();
  return db.transaction(async (tx) => {
    const [runRow] = await tx
      .insert(recommendationRuns)
      .values({
        userId,
        contributionAmountCad: input.contributionAmountCad.toFixed(2),
        engineVersion: recommendation.engineVersion,
        objective: recommendation.objective,
        confidenceScore: recommendation.confidenceScore?.toFixed(2) ?? null,
        assumptions: recommendation.assumptions,
        notes: recommendation.notes ?? [],
      })
      .returning();

    const items = await Promise.all(
      recommendation.items.map(async (item) => {
        if (!item.securitySymbol) {
          return item;
        }
        const security = await resolveCanonicalSecurityIdentity({
          symbol: item.securitySymbol,
          currency: item.securityCurrency ?? "CAD",
          name: item.securityName ?? item.securitySymbol,
          securityType: "ETF",
        });
        return {
          ...item,
          securityId: security.id,
          securityExchange: security.canonicalExchange,
          securityMicCode: security.micCode,
          securityCurrency: security.currency,
          rationale: item.rationale
            ? {
                ...item.rationale,
                metadataSource: security.metadataSource,
                metadataConfidence: security.metadataConfidence,
                economicAssetClass: security.economicAssetClass,
              }
            : item.rationale,
        };
      }),
    );

    if (items.length > 0) {
      await tx.insert(recommendationItems).values(
        items.map((item) => ({
          recommendationRunId: runRow.id,
          assetClass: item.assetClass,
          amountCad: item.amountCad.toFixed(2),
          targetAccountType: item.targetAccountType,
          securityId: item.securityId ?? null,
          securitySymbol: item.securitySymbol ?? null,
          securityName: item.securityName ?? null,
          securityExchange: item.securityExchange ?? null,
          securityMicCode: item.securityMicCode ?? null,
          securityCurrency: item.securityCurrency ?? null,
          securityScore: item.securityScore?.toFixed(2) ?? null,
          allocationGapBeforePct:
            item.allocationGapBeforePct?.toFixed(2) ?? null,
          allocationGapAfterPct: item.allocationGapAfterPct?.toFixed(2) ?? null,
          accountFitScore: item.accountFitScore?.toFixed(2) ?? null,
          taxFitScore: item.taxFitScore?.toFixed(2) ?? null,
          fxFrictionPenaltyBps: item.fxFrictionPenaltyBps ?? null,
          tickerOptions: item.tickerOptions,
          explanation: item.explanation,
          rationale: item.rationale ?? null,
        })),
      );
    }

    return {
      id: runRow.id,
      userId,
      contributionAmountCad: input.contributionAmountCad,
      createdAt: runRow.createdAt.toISOString(),
      engineVersion: recommendation.engineVersion,
      objective: recommendation.objective,
      confidenceScore: recommendation.confidenceScore,
      assumptions: recommendation.assumptions,
      notes: recommendation.notes,
      items,
    };
  });
}
