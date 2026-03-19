import {
  accounts,
  findAuthUserByEmail,
  findUserById,
  holdings,
  importJobs,
  preferenceProfiles,
  recommendationRuns,
  transactions
} from "@/lib/backend/mock-store";
import { BackendRepositories } from "@/lib/backend/repositories/interfaces";

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
  preferences: {
    async getByUserId(userId) {
      const profile = preferenceProfiles.find((item) => item.userId === userId);
      if (!profile) {
        throw new Error(`Preference profile not found for user ${userId}.`);
      }
      return profile;
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
