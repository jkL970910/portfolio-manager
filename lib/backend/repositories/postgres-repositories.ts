import { and, desc, eq, gt, isNull, lte, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import {
  allocationTargets,
  cashAccountBalanceEvents,
  cashAccounts,
  cashflowTransactions,
  externalResearchDocuments,
  externalResearchJobs,
  externalResearchUsageCounters,
  holdingPositions,
  importJobs,
  investmentAccounts,
  portfolioEvents,
  portfolioAnalysisRuns,
  portfolioSnapshots,
  preferenceProfiles,
  recommendationItems,
  recommendationRuns,
  securities,
  securityAliases,
  securityPriceHistory,
  users,
} from "@/lib/db/schema";
import {
  HoldingPosition,
  ImportJob,
  InvestmentAccount,
  CashAccount,
  CashAccountBalanceEvent,
  ExternalResearchDocumentRecord,
  ExternalResearchJob,
  ExternalResearchUsageCounter,
  PortfolioEvent,
  PortfolioAnalysisRun,
  PortfolioSnapshot,
  SecurityAliasRecord,
  SecurityPriceHistoryPoint,
  SecurityRecord,
  PreferenceProfile,
  RecommendationRun,
  UserProfile,
} from "@/lib/backend/models";
import { BackendRepositories } from "@/lib/backend/repositories/interfaces";
import { normalizeRecommendationConstraints } from "@/lib/backend/recommendation-constraints";
import { normalizePreferenceFactors } from "@/lib/backend/preference-factors";

function toNumber(value: string | number | null | undefined) {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    return Number(value);
  }
  return 0;
}

function mapUser(row: typeof users.$inferSelect): UserProfile {
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    baseCurrency: row.baseCurrency as UserProfile["baseCurrency"],
    displayLanguage:
      (row.displayLanguage as UserProfile["displayLanguage"]) ?? "zh",
  };
}

function mapAccount(
  row: typeof investmentAccounts.$inferSelect,
): InvestmentAccount {
  const currency = (row.currency as InvestmentAccount["currency"]) ?? "CAD";
  const marketValueCad = toNumber(row.marketValueCad);
  const marketValueAmount = toNumber(row.marketValueAmount);
  return {
    id: row.id,
    userId: row.userId,
    institution: row.institution,
    type: row.type as InvestmentAccount["type"],
    nickname: row.nickname,
    currency,
    marketValueAmount:
      marketValueAmount > 0 ? marketValueAmount : marketValueCad,
    marketValueCad,
    contributionRoomCad:
      row.contributionRoomCad == null
        ? null
        : toNumber(row.contributionRoomCad),
  };
}

function mapImportJob(row: typeof importJobs.$inferSelect): ImportJob {
  return {
    id: row.id,
    userId: row.userId,
    workflow: row.workflow as ImportJob["workflow"],
    status: row.status as ImportJob["status"],
    sourceType: row.sourceType as "csv",
    fileName: row.fileName,
    createdAt: row.createdAt.toISOString(),
  };
}

function mapSecurity(row: typeof securities.$inferSelect): SecurityRecord {
  return {
    id: row.id,
    symbol: row.symbol,
    canonicalExchange: row.canonicalExchange,
    micCode: row.micCode ?? null,
    currency: row.currency as SecurityRecord["currency"],
    name: row.name,
    securityType: row.securityType ?? null,
    marketSector: row.marketSector ?? null,
    country: row.country ?? null,
    underlyingId: row.underlyingId ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapSecurityAlias(
  row: typeof securityAliases.$inferSelect,
): SecurityAliasRecord {
  return {
    id: row.id,
    securityId: row.securityId,
    aliasType: row.aliasType as SecurityAliasRecord["aliasType"],
    aliasValue: row.aliasValue,
    provider: row.provider ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

function mapCashAccount(row: typeof cashAccounts.$inferSelect): CashAccount {
  return {
    id: row.id,
    userId: row.userId,
    institution: row.institution,
    nickname: row.nickname,
    currency: row.currency as CashAccount["currency"],
    currentBalanceAmount: toNumber(row.currentBalanceAmount),
    currentBalanceCad: toNumber(row.currentBalanceCad),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapCashAccountBalanceEvent(
  row: typeof cashAccountBalanceEvents.$inferSelect,
): CashAccountBalanceEvent {
  return {
    id: row.id,
    userId: row.userId,
    cashAccountId: row.cashAccountId,
    bookedAt: row.bookedAt,
    balanceAmount: toNumber(row.balanceAmount),
    balanceCad: toNumber(row.balanceCad),
    source: row.source,
    createdAt: row.createdAt.toISOString(),
  };
}

function mapSnapshot(
  row: typeof portfolioSnapshots.$inferSelect,
): PortfolioSnapshot {
  const accountBreakdown = row.accountBreakdownJson as Record<
    string,
    number | string | null
  >;
  const holdingBreakdown = row.holdingBreakdownJson as Record<
    string,
    number | string | null
  >;

  return {
    id: row.id,
    userId: row.userId,
    snapshotDate: row.snapshotDate,
    totalValueCad: toNumber(row.totalValueCad),
    accountBreakdown: Object.fromEntries(
      Object.entries(accountBreakdown ?? {}).map(([key, value]) => [
        key,
        toNumber(value),
      ]),
    ),
    holdingBreakdown: Object.fromEntries(
      Object.entries(holdingBreakdown ?? {}).map(([key, value]) => [
        key,
        toNumber(value),
      ]),
    ),
    sourceVersion: row.sourceVersion,
    sourceMode: row.sourceMode,
    freshness: row.freshness,
    refreshRunId: row.refreshRunId ?? null,
    isReference: row.isReference,
    fallbackReason: row.fallbackReason ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

function mapSecurityPriceHistory(
  row: typeof securityPriceHistory.$inferSelect,
): SecurityPriceHistoryPoint {
  return {
    id: row.id,
    securityId: row.securityId ?? null,
    symbol: row.symbol,
    exchange: row.exchange || null,
    priceDate: row.priceDate,
    close: toNumber(row.close),
    adjustedClose:
      row.adjustedClose == null ? null : toNumber(row.adjustedClose),
    currency: row.currency as SecurityPriceHistoryPoint["currency"],
    source: row.source,
    provider: row.provider ?? null,
    sourceMode: row.sourceMode,
    freshness: row.freshness,
    refreshRunId: row.refreshRunId ?? null,
    isReference: row.isReference,
    fallbackReason: row.fallbackReason ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

function dedupeSecurityPriceHistoryByDate(
  points: SecurityPriceHistoryPoint[],
) {
  const byDate = new Map<string, SecurityPriceHistoryPoint>();
  for (const point of points) {
    if (!byDate.has(point.priceDate)) {
      byDate.set(point.priceDate, point);
    }
  }
  return [...byDate.values()];
}

function dedupeSecurityPriceHistoryByIdentityDate(
  points: SecurityPriceHistoryPoint[],
) {
  const byIdentityDate = new Map<string, SecurityPriceHistoryPoint>();
  for (const point of points) {
    const key = [
      point.securityId ?? "",
      point.symbol,
      point.exchange ?? "",
      point.currency,
      point.priceDate,
    ].join("::");
    if (!byIdentityDate.has(key)) {
      byIdentityDate.set(key, point);
    }
  }
  return [...byIdentityDate.values()];
}

function mapPortfolioEvent(
  row: typeof portfolioEvents.$inferSelect,
): PortfolioEvent {
  return {
    id: row.id,
    userId: row.userId,
    accountId: row.accountId,
    symbol: row.symbol ?? null,
    eventType: row.eventType,
    quantity: row.quantity == null ? null : toNumber(row.quantity),
    priceAmount: row.priceAmount == null ? null : toNumber(row.priceAmount),
    currency: row.currency as PortfolioEvent["currency"],
    bookedAt: row.bookedAt,
    effectiveAt: row.effectiveAt.toISOString(),
    source: row.source,
    createdAt: row.createdAt.toISOString(),
  };
}

function mapPortfolioAnalysisRun(
  row: typeof portfolioAnalysisRuns.$inferSelect,
): PortfolioAnalysisRun {
  return {
    id: row.id,
    userId: row.userId,
    scope: row.scope as PortfolioAnalysisRun["scope"],
    mode: row.mode as PortfolioAnalysisRun["mode"],
    targetKey: row.targetKey,
    request: row.requestJson as Record<string, unknown>,
    result: row.resultJson as Record<string, unknown>,
    sourceMode: row.sourceMode as PortfolioAnalysisRun["sourceMode"],
    generatedAt: row.generatedAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

function mapExternalResearchJob(
  row: typeof externalResearchJobs.$inferSelect,
): ExternalResearchJob {
  return {
    id: row.id,
    userId: row.userId,
    scope: row.scope as ExternalResearchJob["scope"],
    targetKey: row.targetKey,
    request: row.requestJson as Record<string, unknown>,
    status: row.status as ExternalResearchJob["status"],
    sourceMode: row.sourceMode as ExternalResearchJob["sourceMode"],
    sourceAllowlist: row.sourceAllowlistJson as Record<string, unknown>[],
    priority: row.priority,
    attemptCount: row.attemptCount,
    maxAttempts: row.maxAttempts,
    runAfter: row.runAfter.toISOString(),
    lockedAt: row.lockedAt?.toISOString() ?? null,
    lockedBy: row.lockedBy ?? null,
    startedAt: row.startedAt?.toISOString() ?? null,
    finishedAt: row.finishedAt?.toISOString() ?? null,
    errorMessage: row.errorMessage ?? null,
    resultRunId: row.resultRunId ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapExternalResearchUsageCounter(
  row: typeof externalResearchUsageCounters.$inferSelect,
): ExternalResearchUsageCounter {
  return {
    id: row.id,
    userId: row.userId,
    counterDate: row.counterDate,
    scope: row.scope as ExternalResearchUsageCounter["scope"],
    runCount: row.runCount,
    symbolCount: row.symbolCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapExternalResearchDocument(
  row: typeof externalResearchDocuments.$inferSelect,
): ExternalResearchDocumentRecord {
  return {
    id: row.id,
    userId: row.userId,
    providerDocumentId: row.providerDocumentId,
    sourceType: row.sourceType as ExternalResearchDocumentRecord["sourceType"],
    providerId: row.providerId,
    sourceName: row.sourceName,
    title: row.title,
    summary: row.summary,
    url: row.url ?? null,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    capturedAt: row.capturedAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    language: row.language as ExternalResearchDocumentRecord["language"],
    security: row.securityId || row.symbol
      ? {
          securityId: row.securityId ?? null,
          symbol: row.symbol ?? null,
          exchange: row.exchange ?? null,
          currency:
            (row.currency as ExternalResearchDocumentRecord["security"] extends infer S
              ? S extends { currency?: infer C }
                ? C
                : never
              : never) ?? null,
          name: row.securityName ?? null,
          provider: row.securityProvider ?? null,
          securityType: row.securityType ?? null,
        }
      : null,
    underlyingId: row.underlyingId ?? null,
    confidence: row.confidence as ExternalResearchDocumentRecord["confidence"],
    sentiment: row.sentiment as ExternalResearchDocumentRecord["sentiment"],
    relevanceScore: row.relevanceScore,
    sourceReliability: row.sourceReliability,
    keyPoints: row.keyPoints as string[],
    riskFlags: row.riskFlags as string[],
    tags: row.tags as string[],
    rawPayload: row.rawPayload as Record<string, unknown>,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export const postgresRepositories: BackendRepositories = {
  users: {
    async getById(userId) {
      const db = getDb();
      const row = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });
      if (!row) {
        throw new Error(`User not found for id ${userId}.`);
      }
      return mapUser(row);
    },
    async findByEmail(email) {
      const db = getDb();
      const row = await db.query.users.findFirst({
        where: eq(users.email, email.toLowerCase()),
      });
      if (!row) {
        return null;
      }
      return {
        profile: mapUser(row),
        passwordHash: row.passwordHash,
      };
    },
    async updateBaseCurrency(userId, currency) {
      const db = getDb();
      const [row] = await db
        .update(users)
        .set({
          baseCurrency: currency,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId))
        .returning();
      if (!row) {
        throw new Error(`User not found for id ${userId}.`);
      }
      return mapUser(row);
    },
    async updateDisplayLanguage(userId, language) {
      const db = getDb();
      const [row] = await db
        .update(users)
        .set({
          displayLanguage: language,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId))
        .returning();
      if (!row) {
        throw new Error(`User not found for id ${userId}.`);
      }
      return mapUser(row);
    },
  },
  accounts: {
    async listByUserId(userId) {
      const db = getDb();
      const rows = await db.query.investmentAccounts.findMany({
        where: eq(investmentAccounts.userId, userId),
      });
      return rows.map(mapAccount);
    },
  },
  holdings: {
    async listByUserId(userId) {
      const db = getDb();
      const rows = await db.query.holdingPositions.findMany({
        where: eq(holdingPositions.userId, userId),
      });
      return rows.map((row) => ({
        ...(() => {
          const currency =
            (row.currency as HoldingPosition["currency"]) ?? "CAD";
          const marketValueCad = toNumber(row.marketValueCad);
          const marketValueAmount = toNumber(row.marketValueAmount);
          const avgCostPerShareCad =
            row.avgCostPerShareCad == null
              ? null
              : toNumber(row.avgCostPerShareCad);
          const costBasisCad =
            row.costBasisCad == null ? null : toNumber(row.costBasisCad);
          const lastPriceCad =
            row.lastPriceCad == null ? null : toNumber(row.lastPriceCad);
          return {
            id: row.id,
            userId: row.userId,
            accountId: row.accountId,
            securityId: row.securityId ?? null,
            symbol: row.symbol,
            name: row.name,
            assetClass: row.assetClassOverride ?? row.assetClass,
            rawAssetClass: row.assetClass,
            assetClassOverride: row.assetClassOverride ?? null,
            sector: row.sectorOverride ?? row.sector,
            rawSector: row.sector,
            sectorOverride: row.sectorOverride ?? null,
            currency,
            securityTypeOverride: row.securityTypeOverride ?? null,
            exchangeOverride: row.exchangeOverride ?? null,
            marketSectorOverride: row.marketSectorOverride ?? null,
            quantity: row.quantity == null ? null : toNumber(row.quantity),
            avgCostPerShareAmount:
              row.avgCostPerShareAmount == null
                ? avgCostPerShareCad
                : toNumber(row.avgCostPerShareAmount),
            costBasisAmount:
              row.costBasisAmount == null
                ? costBasisCad
                : toNumber(row.costBasisAmount),
            lastPriceAmount:
              row.lastPriceAmount == null
                ? lastPriceCad
                : toNumber(row.lastPriceAmount),
            marketValueAmount:
              marketValueAmount > 0 ? marketValueAmount : marketValueCad,
            avgCostPerShareCad,
            costBasisCad,
            lastPriceCad,
            marketValueCad,
            quoteProvider: row.quoteProvider ?? null,
            quoteSourceMode: row.quoteSourceMode ?? null,
            quoteStatus: row.quoteStatus ?? null,
            quoteCurrency:
              (row.quoteCurrency as HoldingPosition["quoteCurrency"]) ?? null,
            quoteExchange: row.quoteExchange ?? null,
            quoteProviderTimestamp:
              row.quoteProviderTimestamp?.toISOString() ?? null,
            lastQuoteAttemptedAt:
              row.lastQuoteAttemptedAt?.toISOString() ?? null,
            lastQuoteSuccessAt: row.lastQuoteSuccessAt?.toISOString() ?? null,
            lastQuoteErrorCode: row.lastQuoteErrorCode ?? null,
            lastQuoteErrorMessage: row.lastQuoteErrorMessage ?? null,
            marketDataRefreshRunId: row.marketDataRefreshRunId ?? null,
            weightPct: toNumber(row.weightPct),
            gainLossPct: toNumber(row.gainLossPct),
            createdAt: row.createdAt.toISOString(),
            updatedAt: row.updatedAt.toISOString(),
          };
        })(),
      }));
    },
  },
  transactions: {
    async listByUserId(userId) {
      const db = getDb();
      const rows = await db.query.cashflowTransactions.findMany({
        where: eq(cashflowTransactions.userId, userId),
        orderBy: desc(cashflowTransactions.bookedAt),
      });
      return rows.map((row) => ({
        id: row.id,
        userId: row.userId,
        accountId: row.accountId ?? undefined,
        bookedAt: row.bookedAt,
        merchant: row.merchant,
        category: row.category,
        amountCad: toNumber(row.amountCad),
        direction: row.direction as "inflow" | "outflow",
      }));
    },
  },
  cashAccounts: {
    async listByUserId(userId) {
      const db = getDb();
      const rows = await db.query.cashAccounts.findMany({
        where: eq(cashAccounts.userId, userId),
      });
      return rows.map(mapCashAccount);
    },
  },
  cashAccountBalanceEvents: {
    async listByUserId(userId) {
      const db = getDb();
      const rows = await db.query.cashAccountBalanceEvents.findMany({
        where: eq(cashAccountBalanceEvents.userId, userId),
        orderBy: desc(cashAccountBalanceEvents.bookedAt),
      });
      return rows.map(mapCashAccountBalanceEvent);
    },
  },
  portfolioEvents: {
    async listByUserId(userId) {
      const db = getDb();
      const rows = await db.query.portfolioEvents.findMany({
        where: eq(portfolioEvents.userId, userId),
        orderBy: desc(portfolioEvents.effectiveAt),
      });
      return rows.map(mapPortfolioEvent);
    },
  },
  snapshots: {
    async listByUserId(userId) {
      const db = getDb();
      const rows = await db.query.portfolioSnapshots.findMany({
        where: eq(portfolioSnapshots.userId, userId),
        orderBy: desc(portfolioSnapshots.snapshotDate),
      });
      return rows.map(mapSnapshot);
    },
  },
  securityPriceHistory: {
    async listBySymbol(symbol) {
      const db = getDb();
      const rows = await db.query.securityPriceHistory.findMany({
        where: eq(securityPriceHistory.symbol, symbol.trim().toUpperCase()),
        orderBy: [
          desc(securityPriceHistory.priceDate),
          desc(securityPriceHistory.createdAt),
        ],
      });
      return dedupeSecurityPriceHistoryByIdentityDate(
        rows.map(mapSecurityPriceHistory),
      );
    },
    async listBySecurityId(securityId) {
      const db = getDb();
      const rows = await db.query.securityPriceHistory.findMany({
        where: eq(securityPriceHistory.securityId, securityId),
        orderBy: [
          desc(securityPriceHistory.priceDate),
          desc(securityPriceHistory.createdAt),
        ],
      });
      return dedupeSecurityPriceHistoryByDate(rows.map(mapSecurityPriceHistory));
    },
    async listByIdentity(input) {
      const db = getDb();
      const rows = await db.query.securityPriceHistory.findMany({
        where: and(
          eq(securityPriceHistory.symbol, input.symbol.trim().toUpperCase()),
          eq(
            securityPriceHistory.exchange,
            input.exchange?.trim().toUpperCase() || "",
          ),
          input.currency
            ? eq(securityPriceHistory.currency, input.currency)
            : undefined,
        ),
        orderBy: [
          desc(securityPriceHistory.priceDate),
          desc(securityPriceHistory.createdAt),
        ],
      });
      return dedupeSecurityPriceHistoryByDate(rows.map(mapSecurityPriceHistory));
    },
  },
  securities: {
    async getById(securityId) {
      const db = getDb();
      const row = await db.query.securities.findFirst({
        where: eq(securities.id, securityId),
      });
      return row ? mapSecurity(row) : null;
    },
    async findByCanonicalIdentity(input) {
      const db = getDb();
      const row = await db.query.securities.findFirst({
        where: and(
          eq(securities.symbol, input.symbol.trim().toUpperCase()),
          eq(securities.canonicalExchange, input.canonicalExchange),
          eq(securities.currency, input.currency),
        ),
      });
      return row ? mapSecurity(row) : null;
    },
    async findByAlias(input) {
      const db = getDb();
      const alias = await db.query.securityAliases.findFirst({
        where: and(
          eq(securityAliases.aliasType, input.aliasType),
          eq(securityAliases.aliasValue, input.aliasValue),
          input.provider
            ? eq(securityAliases.provider, input.provider)
            : isNull(securityAliases.provider),
        ),
      });
      if (!alias) {
        return null;
      }
      const row = await db.query.securities.findFirst({
        where: eq(securities.id, alias.securityId),
      });
      return row ? mapSecurity(row) : null;
    },
    async upsertCanonical(input) {
      const db = getDb();
      const [row] = await db
        .insert(securities)
        .values({
          symbol: input.symbol.trim().toUpperCase(),
          canonicalExchange: input.canonicalExchange,
          micCode: input.micCode,
          currency: input.currency,
          name: input.name,
          securityType: input.securityType,
          marketSector: input.marketSector,
          country: input.country,
          underlyingId: input.underlyingId,
        })
        .onConflictDoUpdate({
          target: [
            securities.symbol,
            securities.canonicalExchange,
            securities.currency,
          ],
          set: {
            micCode: input.micCode,
            name: input.name,
            securityType: input.securityType,
            marketSector: input.marketSector,
            country: input.country,
            underlyingId: input.underlyingId,
            updatedAt: new Date(),
          },
        })
        .returning();
      if (!row) {
        throw new Error("Failed to upsert security identity.");
      }
      return mapSecurity(row);
    },
    async addAlias(input) {
      const db = getDb();
      const existing = await db.query.securityAliases.findFirst({
        where: and(
          eq(securityAliases.securityId, input.securityId),
          eq(securityAliases.aliasType, input.aliasType),
          eq(securityAliases.aliasValue, input.aliasValue),
          input.provider
            ? eq(securityAliases.provider, input.provider)
            : isNull(securityAliases.provider),
        ),
      });
      if (existing) {
        return mapSecurityAlias(existing);
      }
      const [row] = await db
        .insert(securityAliases)
        .values({
          securityId: input.securityId,
          aliasType: input.aliasType,
          aliasValue: input.aliasValue,
          provider: input.provider,
        })
        .onConflictDoNothing({
          target: [
            securityAliases.aliasType,
            securityAliases.aliasValue,
            securityAliases.provider,
          ],
        })
        .returning();
      if (row) {
        return mapSecurityAlias(row);
      }
      const insertedByRace = await db.query.securityAliases.findFirst({
        where: and(
          eq(securityAliases.aliasType, input.aliasType),
          eq(securityAliases.aliasValue, input.aliasValue),
          input.provider
            ? eq(securityAliases.provider, input.provider)
            : isNull(securityAliases.provider),
        ),
      });
      if (!insertedByRace) {
        throw new Error("Failed to add security alias.");
      }
      return mapSecurityAlias(insertedByRace);
    },
  },
  preferences: {
    async getByUserId(userId) {
      const db = getDb();
      const profileRow = await db.query.preferenceProfiles.findFirst({
        where: eq(preferenceProfiles.userId, userId),
      });
      if (!profileRow) {
        throw new Error(`Preference profile not found for user ${userId}.`);
      }
      const targets = await db.query.allocationTargets.findMany({
        where: eq(allocationTargets.preferenceProfileId, profileRow.id),
      });
      return {
        id: profileRow.id,
        userId: profileRow.userId,
        riskProfile: profileRow.riskProfile as PreferenceProfile["riskProfile"],
        targetAllocation: targets.map((target) => ({
          assetClass: target.assetClass,
          targetPct: target.targetPct,
        })),
        accountFundingPriority:
          profileRow.accountFundingPriority as PreferenceProfile["accountFundingPriority"],
        taxAwarePlacement: profileRow.taxAwarePlacement,
        cashBufferTargetCad: toNumber(profileRow.cashBufferTargetCad),
        transitionPreference:
          profileRow.transitionPreference as PreferenceProfile["transitionPreference"],
        recommendationStrategy:
          profileRow.recommendationStrategy as PreferenceProfile["recommendationStrategy"],
        source: (profileRow.source as PreferenceProfile["source"]) ?? "manual",
        rebalancingTolerancePct: profileRow.rebalancingTolerancePct,
        watchlistSymbols: profileRow.watchlistSymbols as string[],
        recommendationConstraints: normalizeRecommendationConstraints(
          profileRow.recommendationConstraints,
        ),
        preferenceFactors: normalizePreferenceFactors(
          profileRow.preferenceFactors,
        ),
        updatedAt: profileRow.updatedAt.toISOString(),
      };
    },
  },
  recommendations: {
    async getLatestByUserId(userId) {
      const db = getDb();
      const run = await db.query.recommendationRuns.findFirst({
        where: eq(recommendationRuns.userId, userId),
        orderBy: desc(recommendationRuns.createdAt),
      });
      if (!run) {
        throw new Error(`Recommendation run not found for user ${userId}.`);
      }
      const items = await db.query.recommendationItems.findMany({
        where: eq(recommendationItems.recommendationRunId, run.id),
      });
      return {
        id: run.id,
        userId: run.userId,
        contributionAmountCad: toNumber(run.contributionAmountCad),
        createdAt: run.createdAt.toISOString(),
        engineVersion: run.engineVersion ?? null,
        objective: run.objective ?? null,
        confidenceScore:
          run.confidenceScore == null ? null : toNumber(run.confidenceScore),
        assumptions: run.assumptions as string[],
        notes: (run.notes as string[] | null) ?? [],
        items: items.map((item) => ({
          assetClass: item.assetClass,
          amountCad: toNumber(item.amountCad),
          targetAccountType:
            item.targetAccountType as RecommendationRun["items"][number]["targetAccountType"],
          tickerOptions: item.tickerOptions as string[],
          explanation: item.explanation,
          securityId: item.securityId ?? null,
          securitySymbol: item.securitySymbol ?? undefined,
          securityName: item.securityName ?? undefined,
          securityExchange: item.securityExchange ?? null,
          securityMicCode: item.securityMicCode ?? null,
          securityCurrency:
            (item.securityCurrency as RecommendationRun["items"][number]["securityCurrency"]) ??
            undefined,
          securityScore:
            item.securityScore == null
              ? undefined
              : toNumber(item.securityScore),
          preferenceFitScore:
            typeof (
              item.rationale as RecommendationRun["items"][number]["rationale"]
            )?.preferenceFitScore === "number"
              ? (
                  item.rationale as RecommendationRun["items"][number]["rationale"]
                )?.preferenceFitScore
              : undefined,
          allocationGapBeforePct:
            item.allocationGapBeforePct == null
              ? undefined
              : toNumber(item.allocationGapBeforePct),
          allocationGapAfterPct:
            item.allocationGapAfterPct == null
              ? undefined
              : toNumber(item.allocationGapAfterPct),
          accountFitScore:
            item.accountFitScore == null
              ? undefined
              : toNumber(item.accountFitScore),
          taxFitScore:
            item.taxFitScore == null ? undefined : toNumber(item.taxFitScore),
          fxFrictionPenaltyBps: item.fxFrictionPenaltyBps ?? undefined,
          rationale:
            (item.rationale as
              | RecommendationRun["items"][number]["rationale"]
              | null) ?? undefined,
        })),
      };
    },
  },
  analysisRuns: {
    async getFreshByKey(userId, params) {
      const db = getDb();
      const row = await db.query.portfolioAnalysisRuns.findFirst({
        where: and(
          eq(portfolioAnalysisRuns.userId, userId),
          eq(portfolioAnalysisRuns.scope, params.scope),
          eq(portfolioAnalysisRuns.mode, params.mode),
          eq(portfolioAnalysisRuns.targetKey, params.targetKey),
          gt(portfolioAnalysisRuns.expiresAt, params.now),
        ),
        orderBy: desc(portfolioAnalysisRuns.createdAt),
      });
      return row ? mapPortfolioAnalysisRun(row) : null;
    },
    async listRecentByUserId(userId, limit) {
      const db = getDb();
      const rows = await db.query.portfolioAnalysisRuns.findMany({
        where: eq(portfolioAnalysisRuns.userId, userId),
        orderBy: desc(portfolioAnalysisRuns.createdAt),
        limit,
      });
      return rows.map(mapPortfolioAnalysisRun);
    },
    async create(input) {
      const db = getDb();
      const [row] = await db
        .insert(portfolioAnalysisRuns)
        .values({
          userId: input.userId,
          scope: input.scope,
          mode: input.mode,
          targetKey: input.targetKey,
          requestJson: input.request,
          resultJson: input.result,
          sourceMode: input.sourceMode,
          generatedAt: new Date(input.generatedAt),
          expiresAt: new Date(input.expiresAt),
        })
        .returning();
      if (!row) {
        throw new Error("Failed to persist portfolio analysis run.");
      }
      return mapPortfolioAnalysisRun(row);
    },
  },
  externalResearchJobs: {
    async create(input) {
      const db = getDb();
      const [row] = await db
        .insert(externalResearchJobs)
        .values({
          userId: input.userId,
          scope: input.scope,
          targetKey: input.targetKey,
          requestJson: input.request,
          status: input.status,
          sourceMode: input.sourceMode,
          sourceAllowlistJson: input.sourceAllowlist,
          priority: input.priority,
          attemptCount: input.attemptCount,
          maxAttempts: input.maxAttempts,
          runAfter: new Date(input.runAfter),
          lockedAt: input.lockedAt ? new Date(input.lockedAt) : null,
          lockedBy: input.lockedBy,
          startedAt: input.startedAt ? new Date(input.startedAt) : null,
          finishedAt: input.finishedAt ? new Date(input.finishedAt) : null,
          errorMessage: input.errorMessage,
          resultRunId: input.resultRunId,
        })
        .returning();
      if (!row) {
        throw new Error("Failed to create external research job.");
      }
      return mapExternalResearchJob(row);
    },
    async listRecentByUserId(userId, limit) {
      const db = getDb();
      const rows = await db.query.externalResearchJobs.findMany({
        where: eq(externalResearchJobs.userId, userId),
        orderBy: desc(externalResearchJobs.createdAt),
        limit,
      });
      return rows.map(mapExternalResearchJob);
    },
    async claimNext(workerId, now) {
      const db = getDb();
      const candidate = await db.query.externalResearchJobs.findFirst({
        where: and(
          eq(externalResearchJobs.status, "queued"),
          lte(externalResearchJobs.runAfter, now),
        ),
        orderBy: [
          desc(externalResearchJobs.priority),
          desc(externalResearchJobs.createdAt),
        ],
      });
      if (!candidate) {
        return null;
      }

      const [row] = await db
        .update(externalResearchJobs)
        .set({
          status: "running",
          lockedAt: now,
          lockedBy: workerId,
          startedAt: now,
          attemptCount: sql`${externalResearchJobs.attemptCount} + 1`,
          updatedAt: now,
        })
        .where(
          and(
            eq(externalResearchJobs.id, candidate.id),
            eq(externalResearchJobs.status, "queued"),
          ),
        )
        .returning();
      return row ? mapExternalResearchJob(row) : null;
    },
    async markSucceeded(jobId, resultRunId, now) {
      const db = getDb();
      const [row] = await db
        .update(externalResearchJobs)
        .set({
          status: "succeeded",
          resultRunId,
          finishedAt: now,
          errorMessage: null,
          updatedAt: now,
        })
        .where(eq(externalResearchJobs.id, jobId))
        .returning();
      if (!row) {
        throw new Error(`External research job not found for id ${jobId}.`);
      }
      return mapExternalResearchJob(row);
    },
    async markFailed(jobId, errorMessage, now) {
      const db = getDb();
      const [row] = await db
        .update(externalResearchJobs)
        .set({
          status: "failed",
          finishedAt: now,
          errorMessage,
          updatedAt: now,
        })
        .where(eq(externalResearchJobs.id, jobId))
        .returning();
      if (!row) {
        throw new Error(`External research job not found for id ${jobId}.`);
      }
      return mapExternalResearchJob(row);
    },
  },
  externalResearchUsageCounters: {
    async listByUserIdAndDate(userId, counterDate) {
      const db = getDb();
      const rows = await db.query.externalResearchUsageCounters.findMany({
        where: and(
          eq(externalResearchUsageCounters.userId, userId),
          eq(externalResearchUsageCounters.counterDate, counterDate),
        ),
      });
      return rows.map(mapExternalResearchUsageCounter);
    },
    async increment(input) {
      const db = getDb();
      const [row] = await db
        .insert(externalResearchUsageCounters)
        .values({
          userId: input.userId,
          counterDate: input.counterDate,
          scope: input.scope,
          runCount: input.runCount,
          symbolCount: input.symbolCount,
        })
        .onConflictDoUpdate({
          target: [
            externalResearchUsageCounters.userId,
            externalResearchUsageCounters.counterDate,
            externalResearchUsageCounters.scope,
          ],
          set: {
            runCount: sql`${externalResearchUsageCounters.runCount} + ${input.runCount}`,
            symbolCount: sql`${externalResearchUsageCounters.symbolCount} + ${input.symbolCount}`,
            updatedAt: new Date(),
          },
        })
        .returning();
      if (!row) {
        throw new Error("Failed to increment external research usage.");
      }
      return mapExternalResearchUsageCounter(row);
    },
  },
  externalResearchDocuments: {
    async create(input) {
      const db = getDb();
      const [row] = await db
        .insert(externalResearchDocuments)
        .values({
          userId: input.userId,
          providerDocumentId: input.providerDocumentId,
          sourceType: input.sourceType,
          providerId: input.providerId,
          sourceName: input.sourceName,
          title: input.title,
          summary: input.summary,
          url: input.url,
          publishedAt: input.publishedAt
            ? new Date(input.publishedAt)
            : null,
          capturedAt: new Date(input.capturedAt),
          expiresAt: new Date(input.expiresAt),
          language: input.language,
          securityId: input.security?.securityId ?? null,
          symbol: input.security?.symbol ?? null,
          exchange: input.security?.exchange ?? null,
          currency: input.security?.currency ?? null,
          securityName: input.security?.name ?? null,
          securityProvider: input.security?.provider ?? null,
          securityType: input.security?.securityType ?? null,
          underlyingId: input.underlyingId,
          confidence: input.confidence,
          sentiment: input.sentiment,
          relevanceScore: input.relevanceScore,
          sourceReliability: input.sourceReliability,
          keyPoints: input.keyPoints,
          riskFlags: input.riskFlags,
          tags: input.tags,
          rawPayload: input.rawPayload,
        })
        .onConflictDoUpdate({
          target: [
            externalResearchDocuments.userId,
            externalResearchDocuments.providerId,
            externalResearchDocuments.providerDocumentId,
          ],
          set: {
            title: input.title,
            summary: input.summary,
            url: input.url,
            publishedAt: input.publishedAt
              ? new Date(input.publishedAt)
              : null,
            capturedAt: new Date(input.capturedAt),
            expiresAt: new Date(input.expiresAt),
            confidence: input.confidence,
            sentiment: input.sentiment,
            relevanceScore: input.relevanceScore,
            sourceReliability: input.sourceReliability,
            keyPoints: input.keyPoints,
            riskFlags: input.riskFlags,
            tags: input.tags,
            rawPayload: input.rawPayload,
            updatedAt: new Date(),
          },
        })
        .returning();
      if (!row) {
        throw new Error("Failed to persist external research document.");
      }
      return mapExternalResearchDocument(row);
    },
    async listFreshByUserId(userId, params) {
      const db = getDb();
      const symbol = params.symbol?.trim().toUpperCase() || null;
      const exchange = params.exchange?.trim().toUpperCase() || null;
      const currency = params.currency?.trim().toUpperCase() || null;
      const rows = await db.query.externalResearchDocuments.findMany({
        where: and(
          eq(externalResearchDocuments.userId, userId),
          gt(externalResearchDocuments.expiresAt, params.now),
          params.securityId
            ? eq(externalResearchDocuments.securityId, params.securityId)
            : undefined,
          !params.securityId && symbol
            ? eq(externalResearchDocuments.symbol, symbol)
            : undefined,
          !params.securityId && exchange
            ? eq(externalResearchDocuments.exchange, exchange)
            : undefined,
          !params.securityId && currency
            ? eq(externalResearchDocuments.currency, currency)
            : undefined,
          params.underlyingId
            ? eq(externalResearchDocuments.underlyingId, params.underlyingId)
            : undefined,
        ),
        orderBy: [
          desc(externalResearchDocuments.relevanceScore),
          desc(externalResearchDocuments.capturedAt),
        ],
        limit: Math.min(Math.max(Math.trunc(params.limit), 1), 50),
      });
      return rows.map(mapExternalResearchDocument);
    },
  },
  importJobs: {
    async getLatestByUserId(userId) {
      const db = getDb();
      const row = await db.query.importJobs.findFirst({
        where: eq(importJobs.userId, userId),
        orderBy: desc(importJobs.createdAt),
      });
      if (!row) {
        throw new Error(`Import job not found for user ${userId}.`);
      }
      return mapImportJob(row);
    },
  },
};
