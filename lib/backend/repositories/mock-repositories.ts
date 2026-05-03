import {
  accounts,
  cashAccounts,
  cashAccountBalanceEvents,
  findAuthUserByEmail,
  findUserById,
  holdings,
  importJobs,
  portfolioEvents,
  portfolioSnapshots,
  securities,
  securityAliases,
  securityPriceHistory,
  preferenceProfiles,
  recommendationRuns,
  transactions,
} from "@/lib/backend/mock-store";
import {
  ExternalResearchDocumentRecord,
  PortfolioAnalysisRun,
} from "@/lib/backend/models";
import {
  ExternalResearchJob,
  ExternalResearchUsageCounter,
} from "@/lib/backend/models";
import { BackendRepositories } from "@/lib/backend/repositories/interfaces";
import { normalizePreferenceFactors } from "@/lib/backend/preference-factors";
import { normalizeRecommendationConstraints } from "@/lib/backend/recommendation-constraints";

const portfolioAnalysisRuns: PortfolioAnalysisRun[] = [];
const externalResearchJobs: ExternalResearchJob[] = [];
const externalResearchUsageCounters: ExternalResearchUsageCounter[] = [];
const externalResearchDocuments: ExternalResearchDocumentRecord[] = [];

export const mockRepositories: BackendRepositories = {
  users: {
    async getById(userId) {
      const user = findUserById(userId);
      if (!user) {
        throw new Error(`User not found for id ${userId}.`);
      }
      return user;
    },
    async findByEmail(email) {
      return findAuthUserByEmail(email.toLowerCase());
    },
    async updateBaseCurrency(userId, currency) {
      const user = findUserById(userId);
      if (!user) {
        throw new Error(`User not found for id ${userId}.`);
      }
      return {
        ...user,
        baseCurrency: currency,
      };
    },
    async updateDisplayLanguage(userId, language) {
      const user = findUserById(userId);
      if (!user) {
        throw new Error(`User not found for id ${userId}.`);
      }
      return {
        ...user,
        displayLanguage: language,
      };
    },
  },
  accounts: {
    async listByUserId(userId) {
      return accounts.filter((account) => account.userId === userId);
    },
  },
  holdings: {
    async listByUserId(userId) {
      return holdings.filter((holding) => holding.userId === userId);
    },
  },
  transactions: {
    async listByUserId(userId) {
      return transactions.filter(
        (transaction) => transaction.userId === userId,
      );
    },
  },
  cashAccounts: {
    async listByUserId(userId) {
      return cashAccounts.filter((account) => account.userId === userId);
    },
  },
  cashAccountBalanceEvents: {
    async listByUserId(userId) {
      return cashAccountBalanceEvents.filter(
        (event) => event.userId === userId,
      );
    },
  },
  portfolioEvents: {
    async listByUserId(userId) {
      return portfolioEvents.filter((event) => event.userId === userId);
    },
  },
  snapshots: {
    async listByUserId(userId) {
      return portfolioSnapshots.filter(
        (snapshot) => snapshot.userId === userId,
      );
    },
  },
  securityPriceHistory: {
    async listBySymbol(symbol) {
      const normalized = symbol.trim().toUpperCase();
      return securityPriceHistory.filter(
        (point) => point.symbol.trim().toUpperCase() === normalized,
      );
    },
    async listBySecurityId(securityId) {
      return securityPriceHistory.filter(
        (point) => point.securityId === securityId,
      );
    },
    async listByIdentity(input) {
      const normalizedSymbol = input.symbol.trim().toUpperCase();
      const normalizedExchange = input.exchange?.trim().toUpperCase() || "";
      return securityPriceHistory.filter(
        (point) =>
          point.symbol.trim().toUpperCase() === normalizedSymbol &&
          (point.exchange?.trim().toUpperCase() || "") === normalizedExchange &&
          (!input.currency || point.currency === input.currency),
      );
    },
  },
  securities: {
    async getById(securityId) {
      return securities.find((security) => security.id === securityId) ?? null;
    },
    async findByCanonicalIdentity(input) {
      return securities.find(
        (security) =>
          security.symbol === input.symbol.trim().toUpperCase() &&
          security.canonicalExchange === input.canonicalExchange &&
          security.currency === input.currency,
      ) ?? null;
    },
    async findByAlias(input) {
      const alias = securityAliases.find(
        (item) =>
          item.aliasType === input.aliasType &&
          item.aliasValue === input.aliasValue &&
          item.provider === (input.provider ?? null),
      );
      if (!alias) {
        return null;
      }
      return securities.find((security) => security.id === alias.securityId) ?? null;
    },
    async upsertCanonical(input) {
      const existing = securities.find(
        (security) =>
          security.symbol === input.symbol.trim().toUpperCase() &&
          security.canonicalExchange === input.canonicalExchange &&
          security.currency === input.currency,
      );
      if (existing) {
        Object.assign(existing, {
          ...input,
          symbol: input.symbol.trim().toUpperCase(),
          updatedAt: new Date().toISOString(),
        });
        return existing;
      }
      const security = {
        ...input,
        id: `security_${securities.length + 1}`,
        symbol: input.symbol.trim().toUpperCase(),
        metadataSource: input.metadataSource ?? "heuristic",
        metadataConfidence: input.metadataConfidence ?? 45,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      securities.push(security);
      return security;
    },
    async addAlias(input) {
      const existing = securityAliases.find(
        (alias) =>
          alias.securityId === input.securityId &&
          alias.aliasType === input.aliasType &&
          alias.aliasValue === input.aliasValue &&
          alias.provider === (input.provider ?? null),
      );
      if (existing) {
        return existing;
      }
      const alias = {
        ...input,
        id: `security_alias_${securityAliases.length + 1}`,
        createdAt: new Date().toISOString(),
      };
      securityAliases.push(alias);
      return alias;
    },
  },
  preferences: {
    async getByUserId(userId) {
      const profile = preferenceProfiles.find((item) => item.userId === userId);
      if (!profile) {
        throw new Error(`Preference profile not found for user ${userId}.`);
      }
      return {
        ...profile,
        recommendationConstraints: normalizeRecommendationConstraints(
          profile.recommendationConstraints,
        ),
        preferenceFactors: normalizePreferenceFactors(profile.preferenceFactors),
      };
    },
  },
  recommendations: {
    async getLatestByUserId(userId) {
      const run = recommendationRuns.find((item) => item.userId === userId);
      if (!run) {
        throw new Error(`Recommendation run not found for user ${userId}.`);
      }
      return run;
    },
  },
  analysisRuns: {
    async getFreshByKey(userId, params) {
      const match = portfolioAnalysisRuns
        .filter((run) => run.userId === userId)
        .filter((run) => run.scope === params.scope)
        .filter((run) => run.mode === params.mode)
        .filter((run) => run.targetKey === params.targetKey)
        .filter(
          (run) => new Date(run.expiresAt).getTime() > params.now.getTime(),
        )
        .sort(
          (left, right) =>
            new Date(right.createdAt).getTime() -
            new Date(left.createdAt).getTime(),
        )[0];
      return match ?? null;
    },
    async listRecentByUserId(userId, limit) {
      return portfolioAnalysisRuns
        .filter((run) => run.userId === userId)
        .filter((run) => new Date(run.expiresAt).getTime() > Date.now())
        .sort(
          (left, right) =>
            new Date(right.createdAt).getTime() -
            new Date(left.createdAt).getTime(),
        )
        .slice(0, limit);
    },
    async create(input) {
      const run: PortfolioAnalysisRun = {
        ...input,
        id: `analysis_${portfolioAnalysisRuns.length + 1}`,
        createdAt: new Date().toISOString(),
      };
      portfolioAnalysisRuns.unshift(run);
      return run;
    },
  },
  externalResearchJobs: {
    async create(input) {
      const now = new Date().toISOString();
      const job: ExternalResearchJob = {
        ...input,
        id: `external_research_job_${externalResearchJobs.length + 1}`,
        createdAt: now,
        updatedAt: now,
      };
      externalResearchJobs.unshift(job);
      return job;
    },
    async listRecentByUserId(userId, limit) {
      return externalResearchJobs
        .filter((job) => job.userId === userId)
        .sort(
          (left, right) =>
            new Date(right.createdAt).getTime() -
            new Date(left.createdAt).getTime(),
        )
        .slice(0, limit);
    },
    async claimNext(workerId, now) {
      const candidate = externalResearchJobs
        .filter((job) => job.status === "queued")
        .filter((job) => new Date(job.runAfter).getTime() <= now.getTime())
        .sort((left, right) => {
          if (right.priority !== left.priority) {
            return right.priority - left.priority;
          }
          return (
            new Date(right.createdAt).getTime() -
            new Date(left.createdAt).getTime()
          );
        })[0];
      if (!candidate) {
        return null;
      }
      candidate.status = "running";
      candidate.lockedAt = now.toISOString();
      candidate.lockedBy = workerId;
      candidate.startedAt = now.toISOString();
      candidate.attemptCount += 1;
      candidate.updatedAt = now.toISOString();
      return candidate;
    },
    async markSucceeded(jobId, resultRunId, now) {
      const job = externalResearchJobs.find((item) => item.id === jobId);
      if (!job) {
        throw new Error(`External research job not found for id ${jobId}.`);
      }
      job.status = "succeeded";
      job.resultRunId = resultRunId;
      job.finishedAt = now.toISOString();
      job.errorMessage = null;
      job.updatedAt = now.toISOString();
      return job;
    },
    async markFailed(jobId, errorMessage, now) {
      const job = externalResearchJobs.find((item) => item.id === jobId);
      if (!job) {
        throw new Error(`External research job not found for id ${jobId}.`);
      }
      job.status = "failed";
      job.finishedAt = now.toISOString();
      job.errorMessage = errorMessage;
      job.updatedAt = now.toISOString();
      return job;
    },
  },
  externalResearchUsageCounters: {
    async listByUserIdAndDate(userId, counterDate) {
      return externalResearchUsageCounters.filter(
        (counter) =>
          counter.userId === userId && counter.counterDate === counterDate,
      );
    },
    async increment(input) {
      const existing = externalResearchUsageCounters.find(
        (counter) =>
          counter.userId === input.userId &&
          counter.counterDate === input.counterDate &&
          counter.scope === input.scope,
      );
      const now = new Date().toISOString();
      if (existing) {
        existing.runCount += input.runCount;
        existing.symbolCount += input.symbolCount;
        existing.updatedAt = now;
        return existing;
      }
      const counter: ExternalResearchUsageCounter = {
        id: `external_research_usage_${externalResearchUsageCounters.length + 1}`,
        userId: input.userId,
        counterDate: input.counterDate,
        scope: input.scope,
        runCount: input.runCount,
        symbolCount: input.symbolCount,
        createdAt: now,
        updatedAt: now,
      };
      externalResearchUsageCounters.push(counter);
      return counter;
    },
  },
  externalResearchDocuments: {
    async create(input) {
      const existing = externalResearchDocuments.find(
        (document) =>
          document.userId === input.userId &&
          document.providerId === input.providerId &&
          document.providerDocumentId === input.providerDocumentId,
      );
      const now = new Date().toISOString();
      if (existing) {
        Object.assign(existing, input, { updatedAt: now });
        return existing;
      }
      const document: ExternalResearchDocumentRecord = {
        id: `external_research_document_${externalResearchDocuments.length + 1}`,
        createdAt: now,
        updatedAt: now,
        ...input,
      };
      externalResearchDocuments.unshift(document);
      return document;
    },
    async listFreshByUserId(userId, params) {
      const symbol = params.symbol?.trim().toUpperCase() || null;
      const exchange = params.exchange?.trim().toUpperCase() || null;
      const currency = params.currency?.trim().toUpperCase() || null;
      return externalResearchDocuments
        .filter((document) => document.userId === userId)
        .filter((document) => Date.parse(document.expiresAt) > params.now.getTime())
        .filter((document) =>
          params.securityId
            ? document.security?.securityId === params.securityId
            : true,
        )
        .filter((document) =>
          !params.securityId && symbol
            ? document.security?.symbol?.trim().toUpperCase() === symbol
            : true,
        )
        .filter((document) =>
          !params.securityId && exchange
            ? document.security?.exchange?.trim().toUpperCase() === exchange
            : true,
        )
        .filter((document) =>
          !params.securityId && currency
            ? document.security?.currency === currency
            : true,
        )
        .filter((document) =>
          params.underlyingId
            ? document.underlyingId === params.underlyingId
            : true,
        )
        .sort((left, right) => right.relevanceScore - left.relevanceScore)
        .slice(0, Math.min(Math.max(Math.trunc(params.limit), 1), 50));
    },
  },
  importJobs: {
    async getLatestByUserId(userId) {
      const job = importJobs.find((item) => item.userId === userId);
      if (!job) {
        throw new Error(`Import job not found for user ${userId}.`);
      }
      return job;
    },
  },
};
