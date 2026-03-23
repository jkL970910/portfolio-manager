import { hash } from "bcryptjs";
import { and, desc, eq } from "drizzle-orm";
import { apiSuccess } from "@/lib/backend/contracts";
import { ImportFieldMapping, ImportValidationError, ParsedCsvImport, parseImportCsv } from "@/lib/backend/csv-import";
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
  RecommendationRun,
  RiskProfile,
  TransitionPreference,
  RecommendationStrategy,
  AccountType,
  UserProfile
} from "@/lib/backend/models";
import {
  buildDashboardData,
  buildImportData,
  buildPortfolioData,
  buildRecommendationsData,
  buildSettingsData,
  buildSpendingData
} from "@/lib/backend/view-builders";
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
  preferenceProfiles,
  recommendationItems,
  recommendationRuns,
  users
} from "@/lib/db/schema";
import type { ImportJob, ImportMappingPreset, InvestmentAccount, HoldingPosition } from "@/lib/backend/models";
import { convertCurrencyAmount, getFxRate } from "@/lib/market-data/fx";

export interface PreferenceProfileInput {
  riskProfile: RiskProfile;
  targetAllocation: AllocationTarget[];
  accountFundingPriority: AccountType[];
  taxAwarePlacement: boolean;
  cashBufferTargetCad: number;
  transitionPreference: TransitionPreference;
  recommendationStrategy: RecommendationStrategy;
  rebalancingTolerancePct: number;
  watchlistSymbols: string[];
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
  suggestedProfile: Omit<PreferenceProfile, "id" | "userId" | "watchlistSymbols">;
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
  refreshedAt: string;
}

export interface CreateRecommendationRunInput {
  contributionAmountCad: number;
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

const DEFAULT_TARGETS_BY_RISK: Record<RiskProfile, AllocationTarget[]> = {
  Conservative: [
    { assetClass: "Canadian Equity", targetPct: 18 },
    { assetClass: "US Equity", targetPct: 22 },
    { assetClass: "International Equity", targetPct: 10 },
    { assetClass: "Fixed Income", targetPct: 35 },
    { assetClass: "Cash", targetPct: 15 }
  ],
  Balanced: [
    { assetClass: "Canadian Equity", targetPct: 22 },
    { assetClass: "US Equity", targetPct: 32 },
    { assetClass: "International Equity", targetPct: 16 },
    { assetClass: "Fixed Income", targetPct: 20 },
    { assetClass: "Cash", targetPct: 10 }
  ],
  Growth: [
    { assetClass: "Canadian Equity", targetPct: 16 },
    { assetClass: "US Equity", targetPct: 42 },
    { assetClass: "International Equity", targetPct: 22 },
    { assetClass: "Fixed Income", targetPct: 10 },
    { assetClass: "Cash", targetPct: 10 }
  ]
};

function getDefaultPreferenceInput(riskProfile: RiskProfile = "Balanced"): PreferenceProfileInput {
  return {
    riskProfile,
    targetAllocation: DEFAULT_TARGETS_BY_RISK[riskProfile],
    accountFundingPriority: ["TFSA", "RRSP", "Taxable"],
    taxAwarePlacement: true,
    cashBufferTargetCad: 10000,
    transitionPreference: "gradual",
    recommendationStrategy: "balanced",
    rebalancingTolerancePct: 5,
    watchlistSymbols: []
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
    emperor: ["8888", "9999", "6666", "88888", "99999"]
  };
  const pool = poolByRank[rank];
  const suffix = pool[Math.floor(Math.random() * pool.length)] ?? "1042";
  const yearSuffix = new Date().getUTCFullYear().toString().slice(-2);
  return `LOO${yearSuffix}${suffix}`;
}

async function getTotalPortfolioValueCad(userId: string) {
  const accounts = await getRepositories().accounts.listByUserId(userId);
  return round(accounts.reduce((sum, account) => sum + account.marketValueCad, 0));
}

function mapCitizenProfileRow(row: typeof citizenProfiles.$inferSelect): Omit<CitizenProfile, "effectiveRank" | "effectiveAddressTier" | "effectiveIdCode"> {
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
    overrideAddressTier: (row.overrideAddressTier as CitizenAddressTier | null) ?? null,
    overrideIdCode: row.overrideIdCode ?? null,
    wealthScoreSnapshotCad: toNumber(row.wealthScoreSnapshotCad),
    issuedAt: row.issuedAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

function applyEffectiveCitizenValues(
  citizen: Omit<CitizenProfile, "effectiveRank" | "effectiveAddressTier" | "effectiveIdCode">
): CitizenProfile {
  return {
    ...citizen,
    effectiveRank: citizen.overrideRank ?? citizen.derivedRank,
    effectiveAddressTier: citizen.overrideAddressTier ?? citizen.derivedAddressTier,
    effectiveIdCode: citizen.overrideIdCode ?? citizen.derivedIdCode
  };
}

async function ensureCitizenProfile(userId: string, options?: {
  citizenName?: string;
  gender?: CitizenGender | null;
  birthDate?: string | null;
}) {
  const db = getDb();
  const existing = await db.query.citizenProfiles.findFirst({ where: eq(citizenProfiles.userId, userId) });
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
        wealthScoreSnapshotCad: wealthScoreSnapshotCad.toFixed(2)
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
      avatarType: getCitizenAvatarType(options?.gender ?? mapped.gender ?? null),
      derivedRank: nextDerivedRank,
      derivedAddressTier: nextDerivedAddressTier,
      derivedIdCode: nextDerivedIdCode,
      wealthScoreSnapshotCad: wealthScoreSnapshotCad.toFixed(2),
      updatedAt: new Date()
    })
    .where(eq(citizenProfiles.id, existing.id))
    .returning();

  return applyEffectiveCitizenValues(mapCitizenProfileRow(updated));
}

function getAdminEmails() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
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
    assumptions: [
      "No recommendation run has been generated yet.",
      "Import holdings and save preferences to unlock a ranked funding plan."
    ],
    items: []
  };
}

const TICKER_OPTIONS_BY_ASSET_CLASS: Record<string, string[]> = {
  "Canadian Equity": ["VCN", "XIC"],
  "US Equity": ["VFV", "XUU"],
  "International Equity": ["XEF", "VIU"],
  "Fixed Income": ["XBB", "ZAG"],
  Cash: ["CASH", "PSA"]
};

function getCurrentAllocationFromHoldings(holdings: HoldingPosition[]) {
  const total = holdings.reduce((sum, holding) => sum + holding.marketValueCad, 0);
  const byAssetClass = new Map<string, number>();
  for (const holding of holdings) {
    byAssetClass.set(holding.assetClass, (byAssetClass.get(holding.assetClass) ?? 0) + holding.marketValueCad);
  }

  return {
    total,
    allocation: new Map(
      [...byAssetClass.entries()].map(([assetClass, value]) => [assetClass, total > 0 ? (value / total) * 100 : 0])
    )
  };
}

function getRecommendedAccountType(accounts: InvestmentAccount[], profile: PreferenceProfile, assetClass: string): AccountType {
  const eligible = profile.accountFundingPriority.find((type) =>
    accounts.some((account) => account.type === type && (account.contributionRoomCad ?? 0) > 0)
  );

  if (eligible) {
    return eligible;
  }

  if (assetClass === "Cash") {
    return accounts.find((account) => account.type === "FHSA")?.type
      ?? accounts.find((account) => account.type === "TFSA")?.type
      ?? "Taxable";
  }

  return accounts[0]?.type ?? "Taxable";
}

function getAutoRecommendationAmount(profile: PreferenceProfile, transactions: CashflowTransaction[]) {
  const latestMonth = transactions
    .map((transaction) => transaction.bookedAt.slice(0, 7))
    .sort()
    .at(-1);

  if (!latestMonth) {
    return 5000;
  }

  const monthTransactions = transactions.filter((transaction) => transaction.bookedAt.startsWith(latestMonth));
  const inflows = monthTransactions
    .filter((transaction) => transaction.direction === "inflow")
    .reduce((sum, transaction) => sum + transaction.amountCad, 0);
  const outflows = monthTransactions
    .filter((transaction) => transaction.direction === "outflow")
    .reduce((sum, transaction) => sum + transaction.amountCad, 0);
  const investable = Math.max(0, inflows - outflows - profile.cashBufferTargetCad / 12);
  const rounded = Math.round(investable / 500) * 500;
  return Math.max(rounded || 0, 2500);
}

function accountMatchKey(account: { institution: string; type: AccountType; nickname: string }) {
  return `${account.institution.toLowerCase()}::${account.type}::${account.nickname.toLowerCase()}`;
}

function holdingMatchKey(accountId: string, symbol: string) {
  return `${accountId}::${symbol.toUpperCase()}`;
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

async function toCadAmount(amount: number | null | undefined, currency: CurrencyCode) {
  if (amount == null || !Number.isFinite(amount)) {
    return null;
  }
  return currency === "CAD" ? round(amount) : round(await convertCurrencyAmount(amount, currency, "CAD"));
}

async function normalizeManualHolding(input: NonNullable<CreateGuidedImportInput["holdings"]>[number]) {
  const quantity = input.quantity ?? null;
  const currency = normalizeCurrencyCode(input.currency);
  const avgCostPerShareAmount = input.avgCostPerShareAmount ?? null;
  const explicitCostBasisAmount = input.costBasisAmount ?? null;
  const lastPriceAmount = input.lastPriceAmount ?? null;
  const explicitMarketValueAmount = input.marketValueAmount ?? null;
  const costBasisAmount = explicitCostBasisAmount ?? (
    quantity != null && avgCostPerShareAmount != null ? round(quantity * avgCostPerShareAmount) : null
  );
  const marketValueAmount = explicitMarketValueAmount ?? (
    quantity != null && lastPriceAmount != null ? round(quantity * lastPriceAmount) : null
  );

  if (marketValueAmount == null || marketValueAmount <= 0) {
    throw new Error(`Holding ${input.symbol.toUpperCase()} requires market value or quantity plus current price.`);
  }

  const avgCostPerShareCad = await toCadAmount(avgCostPerShareAmount, currency);
  const costBasisCad = await toCadAmount(costBasisAmount, currency);
  const lastPriceCad = await toCadAmount(lastPriceAmount, currency);
  const marketValueCad = (await toCadAmount(marketValueAmount, currency)) ?? 0;

  const gainLossPct = costBasisCad != null && costBasisCad > 0
    ? round(((marketValueCad - costBasisCad) / costBasisCad) * 100, 2)
    : 0;

  return {
    symbol: input.symbol.trim().toUpperCase(),
    name: input.holdingName?.trim() || input.symbol.trim().toUpperCase(),
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
    gainLossPct
  };
}

function applySymbolCorrectionsToParsedImport(
  parsed: ParsedCsvImport,
  corrections: Record<string, { symbol: string; name?: string }> | undefined
) {
  if (!corrections || Object.keys(corrections).length === 0) {
    return parsed;
  }

  const normalizedCorrections = new Map(
    Object.entries(corrections).map(([requestedSymbol, correction]) => [
      requestedSymbol.trim().toUpperCase(),
      {
        symbol: correction.symbol.trim().toUpperCase(),
        name: correction.name?.trim() || undefined
      }
    ])
  );

  return {
    ...parsed,
    holdings: parsed.holdings.map((holding) => {
      const correction = normalizedCorrections.get(holding.symbol.trim().toUpperCase());
      if (!correction) {
        return holding;
      }

      return {
        ...holding,
        symbol: correction.symbol,
        name: correction.name ?? holding.name
      };
    })
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

    if (character === "\"") {
      if (inQuotes && nextCharacter === "\"") {
        current += "\"";
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
  workflow: CreateImportJobInput["workflow"]
) {
  const lines = csvContent
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim());

  if (lines.length < 2) {
    return csvContent;
  }

  const rawHeaders = splitCsvLinePreservingQuotes(lines[0]);
  const recordTypeHeader = normalizeMappedHeader(fieldMapping?.record_type ?? "record_type");
  const recordTypeIndex = rawHeaders.map(normalizeMappedHeader).indexOf(recordTypeHeader);

  if (recordTypeIndex === -1) {
    return csvContent;
  }

  const allowedRecordTypes = workflow === "spending"
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
  const user = await repositories.users.getById(userId);
  const [userAccounts, userHoldings, userTransactions, profile] = await Promise.all([
    repositories.accounts.listByUserId(user.id),
    repositories.holdings.listByUserId(user.id),
    repositories.transactions.listByUserId(user.id),
    repositories.preferences.getByUserId(user.id)
  ]);

  let latestRun: RecommendationRun | null = null;
  try {
    latestRun = await repositories.recommendations.getLatestByUserId(user.id);
  } catch {
    latestRun = null;
  }

  const display = {
    currency: user.baseCurrency,
    cadToDisplayRate: await getFxRate("CAD", user.baseCurrency)
  } as const;

  return apiSuccess({
    ...buildDashboardData({
      viewer: user,
      accounts: userAccounts,
      holdings: userHoldings,
      transactions: userTransactions,
      profile,
      latestRun,
      display
    }),
    context: {
      userId: user.id,
      accountCount: userAccounts.length,
      holdingCount: userHoldings.length,
      viewerName: user.displayName
    }
  }, "database");
}

export async function getPortfolioView(userId: string) {
  const repositories = getRepositories();
  const [user, userAccounts, userHoldings, profile] = await Promise.all([
    repositories.users.getById(userId),
    repositories.accounts.listByUserId(userId),
    repositories.holdings.listByUserId(userId),
    repositories.preferences.getByUserId(userId)
  ]);

  const display = {
    currency: user.baseCurrency,
    cadToDisplayRate: await getFxRate("CAD", user.baseCurrency)
  } as const;

  return apiSuccess({
    ...buildPortfolioData({ language: user.displayLanguage, accounts: userAccounts, holdings: userHoldings, profile, display }),
    context: {
      totalMarketValueCad: userAccounts.reduce((sum, account) => sum + account.marketValueCad, 0),
      topHoldingSymbol: [...userHoldings].sort((left, right) => right.marketValueCad - left.marketValueCad)[0]?.symbol ?? null
    }
  }, "database");
}

export async function getRecommendationView(userId: string) {
  const repositories = getRepositories();
  const [user, profile] = await Promise.all([
    repositories.users.getById(userId),
    repositories.preferences.getByUserId(userId)
  ]);
  let latestRun: RecommendationRun | null = null;
  try {
    latestRun = await repositories.recommendations.getLatestByUserId(userId);
  } catch {
    latestRun = null;
  }

  const display = {
    currency: user.baseCurrency,
    cadToDisplayRate: await getFxRate("CAD", user.baseCurrency)
  } as const;

  return apiSuccess({
    ...buildRecommendationsData({ language: user.displayLanguage, profile, latestRun, display }),
    run: latestRun ?? createEmptyRun(userId)
  }, "database");
}

export async function getSpendingView(userId: string) {
  const repositories = getRepositories();
  const [user, userTransactions, profile] = await Promise.all([
    repositories.users.getById(userId),
    repositories.transactions.listByUserId(userId),
    repositories.preferences.getByUserId(userId)
  ]);

  const display = {
    currency: user.baseCurrency,
    cadToDisplayRate: await getFxRate("CAD", user.baseCurrency)
  } as const;

  return apiSuccess({
    ...buildSpendingData({ language: user.displayLanguage, transactions: userTransactions, profile, display }),
    context: {
      transactionCount: userTransactions.length,
      latestBookedAt: [...userTransactions].sort((left, right) => right.bookedAt.localeCompare(left.bookedAt))[0]?.bookedAt ?? null
    }
  }, "database");
}

export async function updateDisplayCurrency(userId: string, input: UpdateDisplayCurrencyInput): Promise<UserProfile> {
  return getRepositories().users.updateBaseCurrency(userId, input.currency);
}

export async function updateDisplayLanguage(userId: string, input: UpdateDisplayLanguageInput): Promise<UserProfile> {
  return getRepositories().users.updateDisplayLanguage(userId, input.language);
}

export async function getImportView(userId: string) {
  const repositories = getRepositories();
  const [user, userAccounts] = await Promise.all([
    repositories.users.getById(userId),
    repositories.accounts.listByUserId(userId)
  ]);
  const db = getDb();
  const [latestPortfolioRow, latestSpendingRow] = await Promise.all([
    db.query.importJobs.findFirst({
      where: and(eq(importJobs.userId, userId), eq(importJobs.workflow, "portfolio")),
      orderBy: desc(importJobs.createdAt)
    }),
    db.query.importJobs.findFirst({
      where: and(eq(importJobs.userId, userId), eq(importJobs.workflow, "spending")),
      orderBy: desc(importJobs.createdAt)
    })
  ]);

  const latestPortfolioJob = latestPortfolioRow ? {
    id: latestPortfolioRow.id,
    userId: latestPortfolioRow.userId,
    workflow: latestPortfolioRow.workflow as ImportJob["workflow"],
    status: latestPortfolioRow.status as ImportJob["status"],
    sourceType: latestPortfolioRow.sourceType as "csv",
    fileName: latestPortfolioRow.fileName,
    createdAt: latestPortfolioRow.createdAt.toISOString()
  } : null;

  const latestSpendingJob = latestSpendingRow ? {
    id: latestSpendingRow.id,
    userId: latestSpendingRow.userId,
    workflow: latestSpendingRow.workflow as ImportJob["workflow"],
    status: latestSpendingRow.status as ImportJob["status"],
    sourceType: latestSpendingRow.sourceType as "csv",
    fileName: latestSpendingRow.fileName,
    createdAt: latestSpendingRow.createdAt.toISOString()
  } : null;

  return apiSuccess({
    ...buildImportData({
      latestPortfolioJob,
      latestSpendingJob,
      accounts: userAccounts,
      language: user.displayLanguage
    }),
    latestPortfolioJob,
    latestSpendingJob
  }, "database");
}

export async function getPreferenceView(userId: string) {
  const repositories = getRepositories();
  const [user, profile] = await Promise.all([
    repositories.users.getById(userId),
    repositories.preferences.getByUserId(userId)
  ]);
  const db = getDb();
  const guidedDraftRow = await db.query.guidedAllocationDrafts.findFirst({
    where: eq(guidedAllocationDrafts.userId, userId)
  });

  const guidedDraft = guidedDraftRow ? {
    id: guidedDraftRow.id,
    userId: guidedDraftRow.userId,
    answers: guidedDraftRow.answers as GuidedAllocationAnswers,
    suggestedProfile: guidedDraftRow.suggestedProfile as Omit<PreferenceProfile, "id" | "userId" | "watchlistSymbols">,
    assumptions: guidedDraftRow.assumptions as string[],
    rationale: guidedDraftRow.rationale as string[],
    createdAt: guidedDraftRow.createdAt.toISOString(),
    updatedAt: guidedDraftRow.updatedAt.toISOString()
  } satisfies GuidedAllocationDraft : null;

  return apiSuccess({
    ...buildSettingsData(profile, user.displayLanguage),
    profile,
    guidedDraft
  }, "database");
}

export async function getCitizenProfileView(userId: string) {
  const [viewer, citizen] = await Promise.all([
    getRepositories().users.getById(userId),
    getCitizenProfile(userId)
  ]);

  return apiSuccess({
    viewer,
    citizen,
    isAdmin: getAdminEmails().includes(viewer.email.toLowerCase())
  }, "database");
}

export async function updateCitizenProfileOverrides(
  viewerId: string,
  targetUserId: string,
  input: UpdateCitizenOverrideInput
) {
  const viewer = await getRepositories().users.getById(viewerId);
  if (!getAdminEmails().includes(viewer.email.toLowerCase())) {
    throw new Error("Admin privileges are required to override citizen profile values.");
  }

  const db = getDb();
  const existing = await db.query.citizenProfiles.findFirst({
    where: eq(citizenProfiles.userId, targetUserId)
  });

  if (!existing) {
    throw new Error("Citizen profile not found.");
  }

  const [updated] = await db
    .update(citizenProfiles)
    .set({
      overrideRank: input.rank === undefined ? existing.overrideRank : input.rank,
      overrideAddressTier: input.addressTier === undefined ? existing.overrideAddressTier : input.addressTier,
      overrideIdCode: input.idCode === undefined ? existing.overrideIdCode : input.idCode,
      updatedAt: new Date()
    })
    .where(eq(citizenProfiles.id, existing.id))
    .returning();

  return applyEffectiveCitizenValues(mapCitizenProfileRow(updated));
}

export async function saveGuidedAllocationDraft(
  userId: string,
  input: SaveGuidedAllocationDraftInput
): Promise<GuidedAllocationDraft> {
  const db = getDb();
  const existing = await db.query.guidedAllocationDrafts.findFirst({
    where: eq(guidedAllocationDrafts.userId, userId)
  });

  if (existing) {
    const [updated] = await db
      .update(guidedAllocationDrafts)
      .set({
        answers: input.answers,
        suggestedProfile: input.suggestedProfile,
        assumptions: input.assumptions,
        rationale: input.rationale,
        updatedAt: new Date()
      })
      .where(eq(guidedAllocationDrafts.id, existing.id))
      .returning();

    return {
      id: updated.id,
      userId: updated.userId,
      answers: updated.answers as GuidedAllocationAnswers,
      suggestedProfile: updated.suggestedProfile as Omit<PreferenceProfile, "id" | "userId" | "watchlistSymbols">,
      assumptions: updated.assumptions as string[],
      rationale: updated.rationale as string[],
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString()
    };
  }

  const [created] = await db
    .insert(guidedAllocationDrafts)
    .values({
      userId,
      answers: input.answers,
      suggestedProfile: input.suggestedProfile,
      assumptions: input.assumptions,
      rationale: input.rationale
    })
    .returning();

  return {
    id: created.id,
    userId: created.userId,
    answers: created.answers as GuidedAllocationAnswers,
    suggestedProfile: created.suggestedProfile as Omit<PreferenceProfile, "id" | "userId" | "watchlistSymbols">,
    assumptions: created.assumptions as string[],
    rationale: created.rationale as string[],
    createdAt: created.createdAt.toISOString(),
    updatedAt: created.updatedAt.toISOString()
  };
}

export async function listImportMappingPresets(userId: string): Promise<ImportMappingPreset[]> {
  const db = getDb();
  const rows = await db.query.importMappingPresets.findMany({
    where: eq(importMappingPresets.userId, userId)
  });

  return rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    name: row.name,
    sourceType: row.sourceType as "csv",
    mapping: row.mapping as Record<string, string>,
    createdAt: row.createdAt.toISOString()
  }));
}

export async function saveImportMappingPreset(userId: string, input: SaveImportMappingPresetInput): Promise<ImportMappingPreset> {
  const db = getDb();
  const existing = await db.query.importMappingPresets.findFirst({
    where: and(
      eq(importMappingPresets.userId, userId),
      eq(importMappingPresets.name, input.name)
    )
  });

  if (existing) {
    const [updated] = await db
      .update(importMappingPresets)
      .set({
        sourceType: input.sourceType,
        mapping: input.mapping,
        updatedAt: new Date()
      })
      .where(eq(importMappingPresets.id, existing.id))
      .returning();

    return {
      id: updated.id,
      userId: updated.userId,
      name: updated.name,
      sourceType: updated.sourceType as "csv",
      mapping: updated.mapping as Record<string, string>,
      createdAt: updated.createdAt.toISOString()
    };
  }

  const [created] = await db
    .insert(importMappingPresets)
    .values({
      userId,
      name: input.name,
      sourceType: input.sourceType,
      mapping: input.mapping
    })
    .returning();

  return {
    id: created.id,
    userId: created.userId,
    name: created.name,
    sourceType: created.sourceType as "csv",
    mapping: created.mapping as Record<string, string>,
    createdAt: created.createdAt.toISOString()
  };
}

export async function updateImportMappingPreset(
  userId: string,
  presetId: string,
  input: UpdateImportMappingPresetInput
): Promise<ImportMappingPreset> {
  const db = getDb();
  const existing = await db.query.importMappingPresets.findFirst({
    where: and(
      eq(importMappingPresets.userId, userId),
      eq(importMappingPresets.id, presetId)
    )
  });

  if (!existing) {
    throw new Error("Import mapping preset not found.");
  }

  const nextName = input.name?.trim() || existing.name;
  if (nextName !== existing.name) {
    const conflicting = await db.query.importMappingPresets.findFirst({
      where: and(
        eq(importMappingPresets.userId, userId),
        eq(importMappingPresets.name, nextName)
      )
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
      updatedAt: new Date()
    })
    .where(eq(importMappingPresets.id, presetId))
    .returning();

  return {
    id: updated.id,
    userId: updated.userId,
    name: updated.name,
    sourceType: updated.sourceType as "csv",
    mapping: updated.mapping as Record<string, string>,
    createdAt: updated.createdAt.toISOString()
  };
}

export async function deleteImportMappingPreset(userId: string, presetId: string): Promise<void> {
  const db = getDb();
  const existing = await db.query.importMappingPresets.findFirst({
    where: and(
      eq(importMappingPresets.userId, userId),
      eq(importMappingPresets.id, presetId)
    )
  });

  if (!existing) {
    throw new Error("Import mapping preset not found.");
  }

  await db.delete(importMappingPresets).where(eq(importMappingPresets.id, presetId));
}

export async function updatePreferenceProfile(userId: string, input: PreferenceProfileInput): Promise<PreferenceProfile> {
  const db = getDb();

  return db.transaction(async (tx) => {
    const profileRow = await tx.query.preferenceProfiles.findFirst({ where: eq(preferenceProfiles.userId, userId) });
    if (!profileRow) {
      throw new Error(`Preference profile not found for user ${userId}.`);
    }

    await tx
      .update(preferenceProfiles)
      .set({
        riskProfile: input.riskProfile,
        accountFundingPriority: input.accountFundingPriority,
        taxAwarePlacement: input.taxAwarePlacement,
        cashBufferTargetCad: input.cashBufferTargetCad.toFixed(2),
        transitionPreference: input.transitionPreference,
        recommendationStrategy: input.recommendationStrategy,
        rebalancingTolerancePct: input.rebalancingTolerancePct,
        watchlistSymbols: input.watchlistSymbols,
        updatedAt: new Date()
      })
      .where(eq(preferenceProfiles.id, profileRow.id));

    await tx.delete(allocationTargets).where(eq(allocationTargets.preferenceProfileId, profileRow.id));

    if (input.targetAllocation.length > 0) {
      await tx.insert(allocationTargets).values(
        input.targetAllocation.map((target) => ({
          preferenceProfileId: profileRow.id,
          assetClass: target.assetClass,
          targetPct: target.targetPct
        }))
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
      rebalancingTolerancePct: input.rebalancingTolerancePct,
      watchlistSymbols: input.watchlistSymbols
    };
  });
}

export async function registerUserWithCitizenProfile(input: RegisterUserInput): Promise<{
  user: UserProfile;
  citizenProfile: CitizenProfile;
}> {
  const db = getDb();
  const email = input.email.trim().toLowerCase();
  const displayName = input.displayName.trim();

  const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (existing) {
    throw new Error("An account with this email already exists.");
  }

  const passwordHash = await hash(input.password, 10);
  const defaultPreferences = getDefaultPreferenceInput();
  const displayLanguage = input.displayLanguage ?? (input.mode === "loo-zh" ? "zh" : "en");

  const user = await db.transaction(async (tx) => {
    const [userRow] = await tx
      .insert(users)
      .values({
        email,
        passwordHash,
        displayName,
        baseCurrency: "CAD",
        displayLanguage
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
        rebalancingTolerancePct: defaultPreferences.rebalancingTolerancePct,
        watchlistSymbols: defaultPreferences.watchlistSymbols
      })
      .returning();

    await tx.insert(allocationTargets).values(
      defaultPreferences.targetAllocation.map((target) => ({
        preferenceProfileId: profileRow.id,
        assetClass: target.assetClass,
        targetPct: target.targetPct
      }))
    );

    await tx.insert(importJobs).values({
      userId: userRow.id,
      workflow: "portfolio",
      status: "draft",
      sourceType: "csv",
      fileName: "awaiting-first-import.csv"
    });

    return {
      id: userRow.id,
      email: userRow.email,
      displayName: userRow.displayName,
      baseCurrency: userRow.baseCurrency as CurrencyCode,
      displayLanguage: (userRow.displayLanguage as DisplayLanguage) ?? "zh"
    };
  });

  const citizenProfile = await ensureCitizenProfile(user.id, {
    citizenName: displayName,
    gender: input.gender ?? null,
    birthDate: input.birthDate ?? null
  });

  return {
    user,
    citizenProfile
  };
}

export async function registerUserAccount(input: RegisterUserInput): Promise<UserProfile> {
  const result = await registerUserWithCitizenProfile(input);
  return result.user;
}

export async function createImportJob(userId: string, input: CreateImportJobInput): Promise<CreateImportJobResult> {
  const db = getDb();

  if (!input.csvContent) {
    const [jobRow] = await db
      .insert(importJobs)
      .values({
        userId,
        workflow: input.workflow,
        status: "draft",
        sourceType: input.sourceType,
        fileName: input.fileName
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
        createdAt: jobRow.createdAt.toISOString()
      },
      summary: {
        accountsImported: 0,
        holdingsImported: 0,
        transactionsImported: 0
      },
      validationErrors: [],
      autoRecommendationRun: null,
      review: {
        importMode: input.importMode,
        detectedHeaders: [],
        rowCount: 0
      }
    };
  }

  const parsed = applySymbolCorrectionsToParsedImport(
    await parseImportCsv(filterCsvContentByWorkflow(input.csvContent, input.fieldMapping, input.workflow), input.fieldMapping ?? {}),
    input.symbolCorrections
  );
  const workflowScopedParsed = input.workflow === "spending"
    ? { ...parsed, accounts: [], holdings: [] }
    : { ...parsed, transactions: [] };

  if (input.workflow === "portfolio" && workflowScopedParsed.accounts.length === 0 && workflowScopedParsed.holdings.length === 0) {
    throw new Error("Portfolio import requires at least one account or holding row.");
  }

  if (input.workflow === "spending" && workflowScopedParsed.transactions.length === 0) {
    throw new Error("Spending import requires at least one transaction row.");
  }

  const review = {
    importMode: input.importMode,
    detectedHeaders: workflowScopedParsed.detectedHeaders,
    rowCount: workflowScopedParsed.accounts.length + workflowScopedParsed.holdings.length + workflowScopedParsed.transactions.length
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
        createdAt: new Date().toISOString()
      },
      summary: {
        accountsImported: workflowScopedParsed.accounts.length,
        holdingsImported: workflowScopedParsed.holdings.length,
        transactionsImported: workflowScopedParsed.transactions.length
      },
      validationErrors: parsed.validationErrors,
      autoRecommendationRun: null,
      review
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
        fileName: input.fileName
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
        createdAt: jobRow.createdAt.toISOString()
      },
      summary: {
        accountsImported: 0,
        holdingsImported: 0,
        transactionsImported: 0
      },
      validationErrors: parsed.validationErrors,
      autoRecommendationRun: null,
      review
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
        fileName: input.fileName
      })
      .returning();

    if (isReplaceMode) {
      if (input.workflow === "portfolio") {
        await tx.delete(holdingPositions).where(eq(holdingPositions.userId, userId));
        await tx.delete(investmentAccounts).where(eq(investmentAccounts.userId, userId));
      } else {
        await tx.delete(cashflowTransactions).where(eq(cashflowTransactions.userId, userId));
      }
    }

    const existingAccounts = isReplaceMode
      ? []
      : await tx.select().from(investmentAccounts).where(eq(investmentAccounts.userId, userId));
    const existingHoldings = isReplaceMode
      ? []
      : await tx.select().from(holdingPositions).where(eq(holdingPositions.userId, userId));
    const existingTransactions = isReplaceMode
      ? []
      : await tx.select().from(cashflowTransactions).where(eq(cashflowTransactions.userId, userId));

    const existingAccountByKey = new Map(existingAccounts.map((account) => [accountMatchKey({
      institution: account.institution,
      type: account.type as AccountType,
      nickname: account.nickname
    }), account]));

    const accountIdByKey = new Map<string, string>();
    const accountsToInsert = workflowScopedParsed.accounts.filter((account) => {
      const matched = existingAccountByKey.get(accountMatchKey(account));
      if (matched) {
        accountIdByKey.set(account.accountKey, matched.id);
        return false;
      }
      return true;
    });

    const insertedAccounts = accountsToInsert.length > 0
      ? await tx.insert(investmentAccounts).values(
          accountsToInsert.map((account) => ({
            userId,
            institution: account.institution,
            type: account.type,
            nickname: account.nickname,
            currency: account.currency,
            marketValueAmount: (account.marketValueAmount ?? account.marketValueCad ?? 0).toFixed(2),
            marketValueCad: (account.marketValueCad ?? 0).toFixed(2),
            contributionRoomCad: account.contributionRoomCad?.toFixed(2) ?? null
          }))
        ).returning()
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
              marketValueAmount: (account.marketValueAmount ?? account.marketValueCad ?? 0).toFixed(2),
              marketValueCad: (account.marketValueCad ?? 0).toFixed(2),
              contributionRoomCad: account.contributionRoomCad?.toFixed(2) ?? null,
              updatedAt: new Date()
            })
            .where(eq(investmentAccounts.id, matched.id));
        }
      }
    }

    const existingHoldingByKey = new Map(existingHoldings.map((holding) => [holdingMatchKey(holding.accountId, holding.symbol), holding]));
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
    }> = [];

    for (const holding of workflowScopedParsed.holdings) {
      const accountId = accountIdByKey.get(holding.accountKey);
      if (!accountId) {
        throw new Error(`Holding ${holding.symbol} references unknown account_key ${holding.accountKey}.`);
      }

      const payload = {
        userId,
        accountId,
        symbol: holding.symbol,
        name: holding.name,
        assetClass: holding.assetClass,
        sector: holding.sector,
        currency: holding.currency,
        quantity: holding.quantity?.toFixed(6) ?? null,
        avgCostPerShareAmount: holding.avgCostPerShareAmount?.toFixed(4) ?? null,
        costBasisAmount: holding.costBasisAmount?.toFixed(2) ?? null,
        lastPriceAmount: holding.lastPriceAmount?.toFixed(4) ?? null,
        marketValueAmount: holding.marketValueAmount.toFixed(2),
        avgCostPerShareCad: holding.avgCostPerShareCad?.toFixed(4) ?? null,
        costBasisCad: holding.costBasisCad?.toFixed(2) ?? null,
        lastPriceCad: holding.lastPriceCad?.toFixed(4) ?? null,
        marketValueCad: holding.marketValueCad.toFixed(2),
        weightPct: (holding.weightPct ?? 0).toFixed(2),
        gainLossPct: holding.gainLossPct.toFixed(2)
      };
      const matchedHolding = existingHoldingByKey.get(holdingMatchKey(accountId, holding.symbol));

      if (matchedHolding) {
        await tx
          .update(holdingPositions)
          .set({
            name: payload.name,
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
            updatedAt: new Date()
          })
          .where(eq(holdingPositions.id, matchedHolding.id));
      } else {
        holdingsToInsert.push(payload);
      }
    }

    if (holdingsToInsert.length > 0) {
      await tx.insert(holdingPositions).values(holdingsToInsert);
    }

    const existingTransactionByKey = new Map(existingTransactions.map((transaction) => [transactionMatchKey({
      accountId: transaction.accountId,
      bookedAt: transaction.bookedAt,
      merchant: transaction.merchant,
      category: transaction.category,
      amountCad: Number(transaction.amountCad),
      direction: transaction.direction as "inflow" | "outflow"
    }), transaction]));

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
      const accountId = transaction.accountKey ? accountIdByKey.get(transaction.accountKey) ?? null : null;
      if (input.workflow !== "spending" && transaction.accountKey && !accountId) {
        throw new Error(`Transaction ${transaction.merchant} references unknown account_key ${transaction.accountKey}.`);
      }

      const payload = {
        userId,
        accountId,
        bookedAt: transaction.bookedAt,
        merchant: transaction.merchant,
        category: transaction.category,
        amountCad: transaction.amountCad.toFixed(2),
        direction: transaction.direction
      };

      if (!existingTransactionByKey.has(transactionMatchKey({
        accountId,
        bookedAt: transaction.bookedAt,
        merchant: transaction.merchant,
        category: transaction.category,
        amountCad: transaction.amountCad,
        direction: transaction.direction
      }))) {
        transactionsToInsert.push(payload);
      }
    }

    if (transactionsToInsert.length > 0) {
      await tx.insert(cashflowTransactions).values(transactionsToInsert);
    }

      return {
        job: {
          id: jobRow.id,
          userId: jobRow.userId,
          workflow: jobRow.workflow as ImportJob["workflow"],
          status: jobRow.status as ImportJob["status"],
          sourceType: jobRow.sourceType as "csv",
          fileName: jobRow.fileName,
        createdAt: jobRow.createdAt.toISOString()
        },
        summary: {
          accountsImported: isReplaceMode ? workflowScopedParsed.accounts.length : accountsToInsert.length,
          holdingsImported: isReplaceMode ? workflowScopedParsed.holdings.length : holdingsToInsert.length,
          transactionsImported: isReplaceMode ? workflowScopedParsed.transactions.length : transactionsToInsert.length
        },
        validationErrors: [],
        autoRecommendationRun: null,
        review
      };
  });

  let autoRecommendationRun: CreateImportJobResult["autoRecommendationRun"] = null;
  if (input.workflow === "portfolio" && result.summary.accountsImported > 0 && result.summary.holdingsImported > 0) {
    try {
      const repositories = getRepositories();
      const [profile, transactions] = await Promise.all([
        repositories.preferences.getByUserId(userId),
        repositories.transactions.listByUserId(userId)
      ]);
      const contributionAmountCad = getAutoRecommendationAmount(profile, transactions);
      const run = await createRecommendationRun(userId, { contributionAmountCad });
      autoRecommendationRun = {
        id: run.id,
        contributionAmountCad: run.contributionAmountCad,
        itemCount: run.items.length
      };
    } catch {
      autoRecommendationRun = null;
    }
  }

  return {
    ...result,
    autoRecommendationRun
  };
}

export async function createGuidedImportAccount(userId: string, input: CreateGuidedImportInput): Promise<CreateGuidedImportResult> {
  const db = getDb();

  const result = await db.transaction(async (tx) => {
    let accountRow: typeof investmentAccounts.$inferSelect;
    if (input.accountMode === "existing" && input.existingAccountId) {
      const existing = await tx.query.investmentAccounts.findFirst({
        where: and(
          eq(investmentAccounts.userId, userId),
          eq(investmentAccounts.id, input.existingAccountId)
        )
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
          updatedAt: new Date()
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
          marketValueCad: (await toCadAmount(input.initialMarketValueAmount, input.currency) ?? 0).toFixed(2),
          contributionRoomCad: input.contributionRoomCad.toFixed(2)
        })
        .returning();
    }

    let createdHoldingSymbol: string | null = null;
    if (input.method === "manual-entry" && input.holdings && input.holdings.length > 0) {
      const existingHoldings = await tx.select().from(holdingPositions).where(
        and(
          eq(holdingPositions.userId, userId),
          eq(holdingPositions.accountId, accountRow.id)
        )
      );
      const existingHoldingBySymbol = new Map(existingHoldings.map((holding) => [holding.symbol.toUpperCase(), holding]));
      const normalizedHoldings = await Promise.all(input.holdings.map(normalizeManualHolding));

      for (const holding of normalizedHoldings) {
        const matched = existingHoldingBySymbol.get(holding.symbol);
        if (matched) {
          await tx
            .update(holdingPositions)
            .set({
              name: holding.name,
              assetClass: holding.assetClass,
              sector: holding.sector,
              currency: holding.currency,
              quantity: holding.quantity?.toFixed(6) ?? null,
              avgCostPerShareAmount: holding.avgCostPerShareAmount?.toFixed(4) ?? null,
              costBasisAmount: holding.costBasisAmount?.toFixed(2) ?? null,
              lastPriceAmount: holding.lastPriceAmount?.toFixed(4) ?? null,
              marketValueAmount: holding.marketValueAmount.toFixed(2),
              avgCostPerShareCad: holding.avgCostPerShareCad?.toFixed(4) ?? null,
              costBasisCad: holding.costBasisCad?.toFixed(2) ?? null,
              lastPriceCad: holding.lastPriceCad?.toFixed(4) ?? null,
              marketValueCad: holding.marketValueCad.toFixed(2),
              gainLossPct: holding.gainLossPct.toFixed(2),
              updatedAt: new Date()
            })
            .where(eq(holdingPositions.id, matched.id));
        } else {
          await tx.insert(holdingPositions).values({
            userId,
            accountId: accountRow.id,
            symbol: holding.symbol,
            name: holding.name,
            assetClass: holding.assetClass,
            sector: holding.sector,
            currency: holding.currency,
            quantity: holding.quantity?.toFixed(6) ?? null,
            avgCostPerShareAmount: holding.avgCostPerShareAmount?.toFixed(4) ?? null,
            costBasisAmount: holding.costBasisAmount?.toFixed(2) ?? null,
            lastPriceAmount: holding.lastPriceAmount?.toFixed(4) ?? null,
            marketValueAmount: holding.marketValueAmount.toFixed(2),
            avgCostPerShareCad: holding.avgCostPerShareCad?.toFixed(4) ?? null,
            costBasisCad: holding.costBasisCad?.toFixed(2) ?? null,
            lastPriceCad: holding.lastPriceCad?.toFixed(4) ?? null,
            marketValueCad: holding.marketValueCad.toFixed(2),
            weightPct: "0.00",
            gainLossPct: holding.gainLossPct.toFixed(2)
          });
        }
      }

      const refreshedHoldings = await tx.select().from(holdingPositions).where(
        and(
          eq(holdingPositions.userId, userId),
          eq(holdingPositions.accountId, accountRow.id)
        )
      );
      const totalMarketValue = refreshedHoldings.reduce((sum, holding) => sum + Number(holding.marketValueCad), 0);
      for (const holding of refreshedHoldings) {
        const weightPct = totalMarketValue > 0 ? round((Number(holding.marketValueCad) / totalMarketValue) * 100, 2) : 0;
        await tx
          .update(holdingPositions)
          .set({ weightPct: weightPct.toFixed(2), updatedAt: new Date() })
          .where(eq(holdingPositions.id, holding.id));
      }
      const [updatedAccount] = await tx
        .update(investmentAccounts)
        .set({
          marketValueAmount: ((await convertCurrencyAmount(totalMarketValue, "CAD", accountRow.currency as CurrencyCode)) || totalMarketValue).toFixed(2),
          marketValueCad: totalMarketValue.toFixed(2),
          updatedAt: new Date()
        })
        .where(eq(investmentAccounts.id, accountRow.id))
        .returning();
      accountRow = updatedAccount;
      createdHoldingSymbol = normalizedHoldings.map((holding) => holding.symbol).join(", ");
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
          fileName: `guided-${input.accountType.toLowerCase()}-${input.nickname.replace(/\s+/g, "-").toLowerCase()}.csv`
        })
        .returning();

      importJob = {
        id: jobRow.id,
        userId: jobRow.userId,
        workflow: jobRow.workflow as ImportJob["workflow"],
        status: jobRow.status as ImportJob["status"],
        sourceType: jobRow.sourceType as "csv",
        fileName: jobRow.fileName,
        createdAt: jobRow.createdAt.toISOString()
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
        contributionRoomCad: accountRow.contributionRoomCad == null ? null : Number(accountRow.contributionRoomCad)
      },
      importJob,
      createdHoldingSymbol
    };
  });

  let autoRecommendationRun: CreateGuidedImportResult["autoRecommendationRun"] = null;
  try {
    const repositories = getRepositories();
    const [holdings, profile, transactions] = await Promise.all([
      repositories.holdings.listByUserId(userId),
      repositories.preferences.getByUserId(userId),
      repositories.transactions.listByUserId(userId)
    ]);

    if (holdings.length > 0) {
      const run = await createRecommendationRun(userId, {
        contributionAmountCad: getAutoRecommendationAmount(profile, transactions)
      });
      autoRecommendationRun = {
        id: run.id,
        contributionAmountCad: run.contributionAmountCad,
        itemCount: run.items.length
      };
    }
  } catch {
    autoRecommendationRun = null;
  }

  return {
    ...result,
    autoRecommendationRun
  };
}

export async function refreshPortfolioQuotes(userId: string): Promise<RefreshPortfolioQuotesResult> {
  const db = getDb();
  const repositories = getRepositories();
  const holdings = await repositories.holdings.listByUserId(userId);
  const uniqueSymbols = [...new Set(holdings.map((holding) => holding.symbol.trim().toUpperCase()).filter(Boolean))];

  if (uniqueSymbols.length === 0) {
    return {
      refreshedHoldingCount: 0,
      missingQuoteCount: 0,
      sampledSymbolCount: 0,
      refreshedAt: new Date().toISOString()
    };
  }

  const { getBatchSecurityQuotes } = await import("@/lib/market-data/service");
  const quoteResults = await getBatchSecurityQuotes(uniqueSymbols);
  const quoteMap = new Map(
    quoteResults.results
      .filter((quote) => Number.isFinite(quote.price) && quote.price > 0)
      .map((quote) => [quote.symbol.trim().toUpperCase(), quote])
  );

  const refreshedAt = new Date();
  let refreshedHoldingCount = 0;

  await db.transaction(async (tx) => {
    const currentHoldings = await tx.select().from(holdingPositions).where(eq(holdingPositions.userId, userId));

    for (const holding of currentHoldings) {
      const quote = quoteMap.get(holding.symbol.trim().toUpperCase());
      if (!quote) {
        continue;
      }
      const holdingCurrency = normalizeCurrencyCode((holding.currency as string) || "CAD");
      const quoteCurrency = normalizeCurrencyCode(quote.currency || holdingCurrency);
      const nativePrice = quote.price;
      const priceInCad = quoteCurrency === "CAD"
        ? nativePrice
        : await convertCurrencyAmount(nativePrice, quoteCurrency, "CAD");

      const quantity = holding.quantity == null ? null : Number(holding.quantity);
      const currentMarketValue = quantity != null && quantity > 0
        ? round((holdingCurrency === quoteCurrency
          ? quantity * nativePrice
          : quantity * (holding.lastPriceAmount == null ? nativePrice : Number(holding.lastPriceAmount))))
        : Number(holding.marketValueAmount ?? holding.marketValueCad);
      const currentMarketValueCad = quantity != null && quantity > 0
        ? round(quantity * priceInCad)
        : Number(holding.marketValueCad);
      const costBasis = holding.costBasisCad == null ? null : Number(holding.costBasisCad);
      const gainLossPct = costBasis != null && costBasis > 0
        ? round(((currentMarketValueCad - costBasis) / costBasis) * 100, 2)
        : Number(holding.gainLossPct);

      await tx
        .update(holdingPositions)
        .set({
          currency: holdingCurrency,
          lastPriceAmount: nativePrice.toFixed(4),
          lastPriceCad: priceInCad.toFixed(4),
          marketValueAmount: currentMarketValue.toFixed(2),
          marketValueCad: currentMarketValueCad.toFixed(2),
          gainLossPct: gainLossPct.toFixed(2),
          updatedAt: refreshedAt
        })
        .where(eq(holdingPositions.id, holding.id));

      refreshedHoldingCount += 1;
    }

    const refreshedHoldings = await tx.select().from(holdingPositions).where(eq(holdingPositions.userId, userId));
    const holdingsByAccount = new Map<string, typeof refreshedHoldings>();
    for (const holding of refreshedHoldings) {
      const group = holdingsByAccount.get(holding.accountId) ?? [];
      group.push(holding);
      holdingsByAccount.set(holding.accountId, group);
    }

    for (const [accountId, accountHoldings] of holdingsByAccount.entries()) {
      const accountTotal = accountHoldings.reduce((sum, holding) => sum + Number(holding.marketValueCad), 0);
      const accountRow = await tx.query.investmentAccounts.findFirst({
        where: eq(investmentAccounts.id, accountId)
      });

      for (const holding of accountHoldings) {
        const weightPct = accountTotal > 0 ? round((Number(holding.marketValueCad) / accountTotal) * 100, 2) : 0;
        await tx
          .update(holdingPositions)
          .set({
            weightPct: weightPct.toFixed(2),
            updatedAt: refreshedAt
          })
          .where(eq(holdingPositions.id, holding.id));
      }

      await tx
        .update(investmentAccounts)
        .set({
          marketValueAmount: ((await convertCurrencyAmount(accountTotal, "CAD", normalizeCurrencyCode((accountRow?.currency as string) || "CAD"))) || accountTotal).toFixed(2),
          marketValueCad: accountTotal.toFixed(2),
          updatedAt: refreshedAt
        })
        .where(eq(investmentAccounts.id, accountId));
    }
  });

  return {
    refreshedHoldingCount,
    missingQuoteCount: uniqueSymbols.length - quoteMap.size,
    sampledSymbolCount: uniqueSymbols.length,
    refreshedAt: refreshedAt.toISOString()
  };
}

export async function createRecommendationRun(userId: string, input: CreateRecommendationRunInput): Promise<RecommendationRun> {
  const repositories = getRepositories();
  const [accounts, holdings, profile] = await Promise.all([
    repositories.accounts.listByUserId(userId),
    repositories.holdings.listByUserId(userId),
    repositories.preferences.getByUserId(userId)
  ]);

  if (accounts.length === 0 || holdings.length === 0) {
    throw new Error("Import accounts and holdings before generating a recommendation run.");
  }

  const { allocation: currentAllocation } = getCurrentAllocationFromHoldings(holdings);
  const targetAllocation = profile.targetAllocation.length > 0 ? profile.targetAllocation : DEFAULT_TARGETS_BY_RISK[profile.riskProfile];

  const underweights = targetAllocation
    .map((target) => ({
      assetClass: target.assetClass,
      gapPct: Math.max(0, target.targetPct - (currentAllocation.get(target.assetClass) ?? 0))
    }))
    .filter((target) => target.gapPct > 0)
    .sort((left, right) => right.gapPct - left.gapPct)
    .slice(0, 3);

  const priorities = underweights.length > 0
    ? underweights
    : targetAllocation
      .slice()
      .sort((left, right) => right.targetPct - left.targetPct)
      .slice(0, 3)
      .map((target) => ({ assetClass: target.assetClass, gapPct: target.targetPct }));

  const totalGap = priorities.reduce((sum, item) => sum + item.gapPct, 0) || 1;
  const assumptions = [
    `Recommendation uses the ${profile.riskProfile.toLowerCase()} target allocation and current asset-class drift.`,
    `Contribution ladder honors ${profile.accountFundingPriority.join(" -> ")} before lower-priority accounts.`,
    profile.taxAwarePlacement
      ? "Tax-aware placement is enabled, so sheltered room is favored when account fit is comparable."
      : "Tax-aware placement is disabled, so the run prioritizes target fit over tax sheltering."
  ];

  const db = getDb();
  return db.transaction(async (tx) => {
    const [runRow] = await tx
      .insert(recommendationRuns)
      .values({
        userId,
        contributionAmountCad: input.contributionAmountCad.toFixed(2),
        assumptions
      })
      .returning();

    const items = priorities.map((priority, index) => {
      const normalizedShare = priority.gapPct / totalGap;
      const rawAmount = index === priorities.length - 1
        ? input.contributionAmountCad - priorities.slice(0, -1).reduce((sum, item) => {
            const share = item.gapPct / totalGap;
            return sum + Math.round(input.contributionAmountCad * share);
          }, 0)
        : Math.round(input.contributionAmountCad * normalizedShare);
      const amountCad = Math.max(rawAmount, 0);
      const targetAccountType = getRecommendedAccountType(accounts, profile, priority.assetClass);
      const tickerOptions = TICKER_OPTIONS_BY_ASSET_CLASS[priority.assetClass] ?? ["VCN", "XIC"];

      return {
        assetClass: priority.assetClass,
        amountCad,
        targetAccountType,
        tickerOptions,
        explanation: `${priority.assetClass} is currently underweight relative to the configured target, so this run allocates ${amountCad.toLocaleString("en-CA")} CAD to ${targetAccountType}.`
      };
    });

    if (items.length > 0) {
      await tx.insert(recommendationItems).values(
        items.map((item) => ({
          recommendationRunId: runRow.id,
          assetClass: item.assetClass,
          amountCad: item.amountCad.toFixed(2),
          targetAccountType: item.targetAccountType,
          tickerOptions: item.tickerOptions,
          explanation: item.explanation
        }))
      );
    }

    return {
      id: runRow.id,
      userId,
      contributionAmountCad: input.contributionAmountCad,
      createdAt: runRow.createdAt.toISOString(),
      assumptions,
      items
    };
  });
}

