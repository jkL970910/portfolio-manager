import { hash } from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { apiSuccess } from "@/lib/backend/contracts";
import { ImportFieldMapping, ImportValidationError, parseImportCsv } from "@/lib/backend/csv-import";
import { getRepositories } from "@/lib/backend/repositories/factory";
import {
  AllocationTarget,
  CashflowTransaction,
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
}

export interface CreateImportJobInput {
  fileName: string;
  sourceType: "csv";
  csvContent?: string;
  fieldMapping?: ImportFieldMapping;
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
  contributionRoomCad: number;
  initialMarketValueCad: number;
  holdings?: Array<{
    symbol: string;
    holdingName?: string;
    assetClass: string;
    sector?: string;
    quantity?: number | null;
    avgCostPerShareCad?: number | null;
    costBasisCad?: number | null;
    lastPriceCad?: number | null;
    marketValueCad?: number | null;
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

function normalizeManualHolding(input: NonNullable<CreateGuidedImportInput["holdings"]>[number]) {
  const quantity = input.quantity ?? null;
  const avgCostPerShareCad = input.avgCostPerShareCad ?? null;
  const explicitCostBasisCad = input.costBasisCad ?? null;
  const lastPriceCad = input.lastPriceCad ?? null;
  const explicitMarketValueCad = input.marketValueCad ?? null;
  const costBasisCad = explicitCostBasisCad ?? (
    quantity != null && avgCostPerShareCad != null ? round(quantity * avgCostPerShareCad) : null
  );
  const marketValueCad = explicitMarketValueCad ?? (
    quantity != null && lastPriceCad != null ? round(quantity * lastPriceCad) : null
  );

  if (marketValueCad == null || marketValueCad <= 0) {
    throw new Error(`Holding ${input.symbol.toUpperCase()} requires market value or quantity plus current price.`);
  }

  const gainLossPct = costBasisCad != null && costBasisCad > 0
    ? round(((marketValueCad - costBasisCad) / costBasisCad) * 100, 2)
    : 0;

  return {
    symbol: input.symbol.trim().toUpperCase(),
    name: input.holdingName?.trim() || input.symbol.trim().toUpperCase(),
    assetClass: input.assetClass,
    sector: input.sector?.trim() || "Multi-sector",
    quantity,
    avgCostPerShareCad,
    costBasisCad,
    lastPriceCad,
    marketValueCad,
    gainLossPct
  };
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

  return apiSuccess({
    ...buildDashboardData({
      viewer: user,
      accounts: userAccounts,
      holdings: userHoldings,
      transactions: userTransactions,
      profile,
      latestRun
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
  const [userAccounts, userHoldings, profile] = await Promise.all([
    repositories.accounts.listByUserId(userId),
    repositories.holdings.listByUserId(userId),
    repositories.preferences.getByUserId(userId)
  ]);

  return apiSuccess({
    ...buildPortfolioData({ accounts: userAccounts, holdings: userHoldings, profile }),
    context: {
      totalMarketValueCad: userAccounts.reduce((sum, account) => sum + account.marketValueCad, 0),
      topHoldingSymbol: [...userHoldings].sort((left, right) => right.marketValueCad - left.marketValueCad)[0]?.symbol ?? null
    }
  }, "database");
}

export async function getRecommendationView(userId: string) {
  const repositories = getRepositories();
  const profile = await repositories.preferences.getByUserId(userId);
  let latestRun: RecommendationRun | null = null;
  try {
    latestRun = await repositories.recommendations.getLatestByUserId(userId);
  } catch {
    latestRun = null;
  }

  return apiSuccess({
    ...buildRecommendationsData({ profile, latestRun }),
    run: latestRun ?? createEmptyRun(userId)
  }, "database");
}

export async function getSpendingView(userId: string) {
  const repositories = getRepositories();
  const [userTransactions, profile] = await Promise.all([
    repositories.transactions.listByUserId(userId),
    repositories.preferences.getByUserId(userId)
  ]);

  return apiSuccess({
    ...buildSpendingData({ transactions: userTransactions, profile }),
    context: {
      transactionCount: userTransactions.length,
      latestBookedAt: [...userTransactions].sort((left, right) => right.bookedAt.localeCompare(left.bookedAt))[0]?.bookedAt ?? null
    }
  }, "database");
}

export async function getImportView(userId: string) {
  const repositories = getRepositories();
  const userAccounts = await repositories.accounts.listByUserId(userId);
  let latestJob = null;
  try {
    latestJob = await repositories.importJobs.getLatestByUserId(userId);
  } catch {
    latestJob = null;
  }

  return apiSuccess({
    ...buildImportData({ latestJob, accounts: userAccounts }),
    latestJob
  }, "database");
}

export async function getPreferenceView(userId: string) {
  const repositories = getRepositories();
  const profile = await repositories.preferences.getByUserId(userId);

  return apiSuccess({
    ...buildSettingsData(profile),
    profile
  }, "database");
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

export async function registerUserAccount(input: RegisterUserInput): Promise<UserProfile> {
  const db = getDb();
  const email = input.email.trim().toLowerCase();
  const displayName = input.displayName.trim();

  const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (existing) {
    throw new Error("An account with this email already exists.");
  }

  const passwordHash = await hash(input.password, 10);
  const defaultPreferences = getDefaultPreferenceInput();

  return db.transaction(async (tx) => {
    const [userRow] = await tx
      .insert(users)
      .values({
        email,
        passwordHash,
        displayName,
        baseCurrency: "CAD"
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
      status: "draft",
      sourceType: "csv",
      fileName: "awaiting-first-import.csv"
    });

    return {
      id: userRow.id,
      email: userRow.email,
      displayName: userRow.displayName,
      baseCurrency: userRow.baseCurrency as "CAD"
    };
  });
}

export async function createImportJob(userId: string, input: CreateImportJobInput): Promise<CreateImportJobResult> {
  const db = getDb();

  if (!input.csvContent) {
    const [jobRow] = await db
      .insert(importJobs)
      .values({
        userId,
        status: "draft",
        sourceType: input.sourceType,
        fileName: input.fileName
      })
      .returning();

    return {
      job: {
        id: jobRow.id,
        userId: jobRow.userId,
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

  const parsed = parseImportCsv(input.csvContent, input.fieldMapping ?? {});
  const review = {
    importMode: input.importMode,
    detectedHeaders: parsed.detectedHeaders,
    rowCount: parsed.accounts.length + parsed.holdings.length + parsed.transactions.length
  };

  if (input.dryRun) {
    return {
      job: {
        id: "dry-run",
        userId,
        status: parsed.validationErrors.length > 0 ? "draft" : "validated",
        sourceType: input.sourceType,
        fileName: input.fileName,
        createdAt: new Date().toISOString()
      },
      summary: {
        accountsImported: parsed.accounts.length,
        holdingsImported: parsed.holdings.length,
        transactionsImported: parsed.transactions.length
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
        status: "draft",
        sourceType: input.sourceType,
        fileName: input.fileName
      })
      .returning();

    return {
      job: {
        id: jobRow.id,
        userId: jobRow.userId,
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
        status: "completed",
        sourceType: input.sourceType,
        fileName: input.fileName
      })
      .returning();

    if (isReplaceMode) {
      await tx.delete(cashflowTransactions).where(eq(cashflowTransactions.userId, userId));
      await tx.delete(holdingPositions).where(eq(holdingPositions.userId, userId));
      await tx.delete(investmentAccounts).where(eq(investmentAccounts.userId, userId));
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
    const accountsToInsert = parsed.accounts.filter((account) => {
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
      for (const account of parsed.accounts) {
        const matched = existingAccountByKey.get(accountMatchKey(account));
        if (matched) {
          await tx
            .update(investmentAccounts)
            .set({
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
      quantity: string | null;
      avgCostPerShareCad: string | null;
      costBasisCad: string | null;
      lastPriceCad: string | null;
      marketValueCad: string;
      weightPct: string;
      gainLossPct: string;
    }> = [];

    for (const holding of parsed.holdings) {
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
        quantity: holding.quantity?.toFixed(6) ?? null,
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
            quantity: payload.quantity,
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

    for (const transaction of parsed.transactions) {
      const accountId = transaction.accountKey ? accountIdByKey.get(transaction.accountKey) ?? null : null;
      if (transaction.accountKey && !accountId) {
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
        status: jobRow.status as ImportJob["status"],
        sourceType: jobRow.sourceType as "csv",
        fileName: jobRow.fileName,
        createdAt: jobRow.createdAt.toISOString()
      },
      summary: {
        accountsImported: isReplaceMode ? parsed.accounts.length : accountsToInsert.length,
        holdingsImported: isReplaceMode ? parsed.holdings.length : holdingsToInsert.length,
        transactionsImported: isReplaceMode ? parsed.transactions.length : transactionsToInsert.length
      },
      validationErrors: [],
      autoRecommendationRun: null,
      review
    };
  });

  let autoRecommendationRun: CreateImportJobResult["autoRecommendationRun"] = null;
  if (result.summary.accountsImported > 0 && result.summary.holdingsImported > 0) {
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
          marketValueCad: input.initialMarketValueCad.toFixed(2),
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
      const normalizedHoldings = input.holdings.map(normalizeManualHolding);

      for (const holding of normalizedHoldings) {
        const matched = existingHoldingBySymbol.get(holding.symbol);
        if (matched) {
          await tx
            .update(holdingPositions)
            .set({
              name: holding.name,
              assetClass: holding.assetClass,
              sector: holding.sector,
              quantity: holding.quantity?.toFixed(6) ?? null,
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
            quantity: holding.quantity?.toFixed(6) ?? null,
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
          status: "draft",
          sourceType: "csv",
          fileName: `guided-${input.accountType.toLowerCase()}-${input.nickname.replace(/\s+/g, "-").toLowerCase()}.csv`
        })
        .returning();

      importJob = {
        id: jobRow.id,
        userId: jobRow.userId,
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
