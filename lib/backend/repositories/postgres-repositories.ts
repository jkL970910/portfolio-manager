import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import {
  allocationTargets,
  cashflowTransactions,
  holdingPositions,
  importJobs,
  investmentAccounts,
  preferenceProfiles,
  recommendationItems,
  recommendationRuns,
  users
} from "@/lib/db/schema";
import {
  ImportJob,
  InvestmentAccount,
  PreferenceProfile,
  RecommendationRun,
  UserProfile
} from "@/lib/backend/models";
import { BackendRepositories } from "@/lib/backend/repositories/interfaces";

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
    baseCurrency: row.baseCurrency as "CAD"
  };
}

function mapAccount(row: typeof investmentAccounts.$inferSelect): InvestmentAccount {
  return {
    id: row.id,
    userId: row.userId,
    institution: row.institution,
    type: row.type as InvestmentAccount["type"],
    nickname: row.nickname,
    marketValueCad: toNumber(row.marketValueCad),
    contributionRoomCad: row.contributionRoomCad == null ? null : toNumber(row.contributionRoomCad)
  };
}

function mapImportJob(row: typeof importJobs.$inferSelect): ImportJob {
  return {
    id: row.id,
    userId: row.userId,
    status: row.status as ImportJob["status"],
    sourceType: row.sourceType as "csv",
    fileName: row.fileName,
    createdAt: row.createdAt.toISOString()
  };
}

export const postgresRepositories: BackendRepositories = {
  users: {
    async getById(userId) {
      const db = getDb();
      const row = await db.query.users.findFirst({ where: eq(users.id, userId) });
      if (!row) {
        throw new Error(`User not found for id ${userId}.`);
      }
      return mapUser(row);
    },
    async findByEmail(email) {
      const db = getDb();
      const row = await db.query.users.findFirst({ where: eq(users.email, email.toLowerCase()) });
      if (!row) {
        return null;
      }
      return {
        profile: mapUser(row),
        passwordHash: row.passwordHash
      };
    }
  },
  accounts: {
    async listByUserId(userId) {
      const db = getDb();
      const rows = await db.query.investmentAccounts.findMany({ where: eq(investmentAccounts.userId, userId) });
      return rows.map(mapAccount);
    }
  },
  holdings: {
    async listByUserId(userId) {
      const db = getDb();
      const rows = await db.query.holdingPositions.findMany({ where: eq(holdingPositions.userId, userId) });
      return rows.map((row) => ({
        id: row.id,
        userId: row.userId,
        accountId: row.accountId,
        symbol: row.symbol,
        name: row.name,
        assetClass: row.assetClass,
        sector: row.sector,
        quantity: row.quantity == null ? null : toNumber(row.quantity),
        avgCostPerShareCad: row.avgCostPerShareCad == null ? null : toNumber(row.avgCostPerShareCad),
        costBasisCad: row.costBasisCad == null ? null : toNumber(row.costBasisCad),
        lastPriceCad: row.lastPriceCad == null ? null : toNumber(row.lastPriceCad),
        marketValueCad: toNumber(row.marketValueCad),
        weightPct: toNumber(row.weightPct),
        gainLossPct: toNumber(row.gainLossPct),
        updatedAt: row.updatedAt.toISOString()
      }));
    }
  },
  transactions: {
    async listByUserId(userId) {
      const db = getDb();
      const rows = await db.query.cashflowTransactions.findMany({
        where: eq(cashflowTransactions.userId, userId),
        orderBy: desc(cashflowTransactions.bookedAt)
      });
      return rows.map((row) => ({
        id: row.id,
        userId: row.userId,
        accountId: row.accountId ?? undefined,
        bookedAt: row.bookedAt,
        merchant: row.merchant,
        category: row.category,
        amountCad: toNumber(row.amountCad),
        direction: row.direction as "inflow" | "outflow"
      }));
    }
  },
  preferences: {
    async getByUserId(userId) {
      const db = getDb();
      const profileRow = await db.query.preferenceProfiles.findFirst({ where: eq(preferenceProfiles.userId, userId) });
      if (!profileRow) {
        throw new Error(`Preference profile not found for user ${userId}.`);
      }
      const targets = await db.query.allocationTargets.findMany({ where: eq(allocationTargets.preferenceProfileId, profileRow.id) });
      return {
        id: profileRow.id,
        userId: profileRow.userId,
        riskProfile: profileRow.riskProfile as PreferenceProfile["riskProfile"],
        targetAllocation: targets.map((target) => ({ assetClass: target.assetClass, targetPct: target.targetPct })),
        accountFundingPriority: profileRow.accountFundingPriority as PreferenceProfile["accountFundingPriority"],
        taxAwarePlacement: profileRow.taxAwarePlacement,
        cashBufferTargetCad: toNumber(profileRow.cashBufferTargetCad),
        transitionPreference: profileRow.transitionPreference as PreferenceProfile["transitionPreference"],
        recommendationStrategy: profileRow.recommendationStrategy as PreferenceProfile["recommendationStrategy"],
        rebalancingTolerancePct: profileRow.rebalancingTolerancePct,
        watchlistSymbols: profileRow.watchlistSymbols as string[]
      };
    }
  },
  recommendations: {
    async getLatestByUserId(userId) {
      const db = getDb();
      const run = await db.query.recommendationRuns.findFirst({
        where: eq(recommendationRuns.userId, userId),
        orderBy: desc(recommendationRuns.createdAt)
      });
      if (!run) {
        throw new Error(`Recommendation run not found for user ${userId}.`);
      }
      const items = await db.query.recommendationItems.findMany({ where: eq(recommendationItems.recommendationRunId, run.id) });
      return {
        id: run.id,
        userId: run.userId,
        contributionAmountCad: toNumber(run.contributionAmountCad),
        createdAt: run.createdAt.toISOString(),
        assumptions: run.assumptions as string[],
        items: items.map((item) => ({
          assetClass: item.assetClass,
          amountCad: toNumber(item.amountCad),
          targetAccountType: item.targetAccountType as RecommendationRun["items"][number]["targetAccountType"],
          tickerOptions: item.tickerOptions as string[],
          explanation: item.explanation
        }))
      };
    }
  },
  importJobs: {
    async getLatestByUserId(userId) {
      const db = getDb();
      const row = await db.query.importJobs.findFirst({
        where: eq(importJobs.userId, userId),
        orderBy: desc(importJobs.createdAt)
      });
      if (!row) {
        throw new Error(`Import job not found for user ${userId}.`);
      }
      return mapImportJob(row);
    }
  }
};
