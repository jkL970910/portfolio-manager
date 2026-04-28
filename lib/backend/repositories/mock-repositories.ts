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
  securityPriceHistory,
  preferenceProfiles,
  recommendationRuns,
  transactions
} from "@/lib/backend/mock-store";
import { PortfolioAnalysisRun } from "@/lib/backend/models";
import { BackendRepositories } from "@/lib/backend/repositories/interfaces";
import { normalizeRecommendationConstraints } from "@/lib/backend/recommendation-constraints";

const portfolioAnalysisRuns: PortfolioAnalysisRun[] = [];

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
        baseCurrency: currency
      };
    },
    async updateDisplayLanguage(userId, language) {
      const user = findUserById(userId);
      if (!user) {
        throw new Error(`User not found for id ${userId}.`);
      }
      return {
        ...user,
        displayLanguage: language
      };
    }
  },
  accounts: {
    async listByUserId(userId) {
      return accounts.filter((account) => account.userId === userId);
    }
  },
  holdings: {
    async listByUserId(userId) {
      return holdings.filter((holding) => holding.userId === userId);
    }
  },
  transactions: {
    async listByUserId(userId) {
      return transactions.filter((transaction) => transaction.userId === userId);
    }
  },
  cashAccounts: {
    async listByUserId(userId) {
      return cashAccounts.filter((account) => account.userId === userId);
    }
  },
  cashAccountBalanceEvents: {
    async listByUserId(userId) {
      return cashAccountBalanceEvents.filter((event) => event.userId === userId);
    }
  },
  portfolioEvents: {
    async listByUserId(userId) {
      return portfolioEvents.filter((event) => event.userId === userId);
    }
  },
  snapshots: {
    async listByUserId(userId) {
      return portfolioSnapshots.filter((snapshot) => snapshot.userId === userId);
    }
  },
  securityPriceHistory: {
    async listBySymbol(symbol) {
      const normalized = symbol.trim().toUpperCase();
      return securityPriceHistory.filter((point) => point.symbol.trim().toUpperCase() === normalized);
    }
  },
  preferences: {
    async getByUserId(userId) {
      const profile = preferenceProfiles.find((item) => item.userId === userId);
      if (!profile) {
        throw new Error(`Preference profile not found for user ${userId}.`);
      }
      return {
        ...profile,
        recommendationConstraints: normalizeRecommendationConstraints(profile.recommendationConstraints)
      };
    }
  },
  recommendations: {
    async getLatestByUserId(userId) {
      const run = recommendationRuns.find((item) => item.userId === userId);
      if (!run) {
        throw new Error(`Recommendation run not found for user ${userId}.`);
      }
      return run;
    }
  },
  analysisRuns: {
    async getFreshByKey(userId, params) {
      const match = portfolioAnalysisRuns
        .filter((run) => run.userId === userId)
        .filter((run) => run.scope === params.scope)
        .filter((run) => run.mode === params.mode)
        .filter((run) => run.targetKey === params.targetKey)
        .filter((run) => new Date(run.expiresAt).getTime() > params.now.getTime())
        .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())[0];
      return match ?? null;
    },
    async listRecentByUserId(userId, limit) {
      return portfolioAnalysisRuns
        .filter((run) => run.userId === userId)
        .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
        .slice(0, limit);
    },
    async create(input) {
      const run: PortfolioAnalysisRun = {
        ...input,
        id: `analysis_${portfolioAnalysisRuns.length + 1}`,
        createdAt: new Date().toISOString()
      };
      portfolioAnalysisRuns.unshift(run);
      return run;
    }
  },
  importJobs: {
    async getLatestByUserId(userId) {
      const job = importJobs.find((item) => item.userId === userId);
      if (!job) {
        throw new Error(`Import job not found for user ${userId}.`);
      }
      return job;
    }
  }
};
