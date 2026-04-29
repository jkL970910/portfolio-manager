import {
  CashflowTransaction,
  EntityId,
  ExternalResearchJob,
  ExternalResearchUsageCounter,
  HoldingPosition,
  ImportJob,
  InvestmentAccount,
  CashAccount,
  CashAccountBalanceEvent,
  PortfolioEvent,
  PortfolioAnalysisRun,
  PortfolioSnapshot,
  SecurityPriceHistoryPoint,
  PreferenceProfile,
  RecommendationRun,
  UserProfile,
} from "@/lib/backend/models";

export interface AuthUserRecord {
  profile: UserProfile;
  passwordHash: string;
}

export interface UserRepository {
  getById(userId: EntityId): Promise<UserProfile>;
  findByEmail(email: string): Promise<AuthUserRecord | null>;
  updateBaseCurrency(
    userId: EntityId,
    currency: UserProfile["baseCurrency"],
  ): Promise<UserProfile>;
  updateDisplayLanguage(
    userId: EntityId,
    language: UserProfile["displayLanguage"],
  ): Promise<UserProfile>;
}

export interface AccountRepository {
  listByUserId(userId: EntityId): Promise<InvestmentAccount[]>;
}

export interface HoldingRepository {
  listByUserId(userId: EntityId): Promise<HoldingPosition[]>;
}

export interface TransactionRepository {
  listByUserId(userId: EntityId): Promise<CashflowTransaction[]>;
}

export interface CashAccountRepository {
  listByUserId(userId: EntityId): Promise<CashAccount[]>;
}

export interface CashAccountBalanceEventRepository {
  listByUserId(userId: EntityId): Promise<CashAccountBalanceEvent[]>;
}

export interface PortfolioEventRepository {
  listByUserId(userId: EntityId): Promise<PortfolioEvent[]>;
}

export interface PortfolioSnapshotRepository {
  listByUserId(userId: EntityId): Promise<PortfolioSnapshot[]>;
}

export interface SecurityPriceHistoryRepository {
  listBySymbol(symbol: string): Promise<SecurityPriceHistoryPoint[]>;
  listByIdentity(input: {
    symbol: string;
    exchange?: string | null;
    currency?: string | null;
  }): Promise<SecurityPriceHistoryPoint[]>;
}

export interface PreferenceRepository {
  getByUserId(userId: EntityId): Promise<PreferenceProfile>;
}

export interface RecommendationRepository {
  getLatestByUserId(userId: EntityId): Promise<RecommendationRun>;
}

export interface PortfolioAnalysisRunRepository {
  getFreshByKey(
    userId: EntityId,
    params: {
      scope: PortfolioAnalysisRun["scope"];
      mode: PortfolioAnalysisRun["mode"];
      targetKey: string;
      now: Date;
    },
  ): Promise<PortfolioAnalysisRun | null>;
  listRecentByUserId(
    userId: EntityId,
    limit: number,
  ): Promise<PortfolioAnalysisRun[]>;
  create(
    input: Omit<PortfolioAnalysisRun, "id" | "createdAt">,
  ): Promise<PortfolioAnalysisRun>;
}

export interface ExternalResearchJobRepository {
  create(
    input: Omit<ExternalResearchJob, "id" | "createdAt" | "updatedAt">,
  ): Promise<ExternalResearchJob>;
  listRecentByUserId(
    userId: EntityId,
    limit: number,
  ): Promise<ExternalResearchJob[]>;
  claimNext(workerId: string, now: Date): Promise<ExternalResearchJob | null>;
  markSucceeded(
    jobId: EntityId,
    resultRunId: EntityId,
    now: Date,
  ): Promise<ExternalResearchJob>;
  markFailed(
    jobId: EntityId,
    errorMessage: string,
    now: Date,
  ): Promise<ExternalResearchJob>;
}

export interface ExternalResearchUsageCounterRepository {
  listByUserIdAndDate(
    userId: EntityId,
    counterDate: string,
  ): Promise<ExternalResearchUsageCounter[]>;
  increment(input: {
    userId: EntityId;
    counterDate: string;
    scope: ExternalResearchUsageCounter["scope"];
    runCount: number;
    symbolCount: number;
  }): Promise<ExternalResearchUsageCounter>;
}

export interface ImportJobRepository {
  getLatestByUserId(userId: EntityId): Promise<ImportJob>;
}

export interface BackendRepositories {
  users: UserRepository;
  accounts: AccountRepository;
  holdings: HoldingRepository;
  transactions: TransactionRepository;
  cashAccounts: CashAccountRepository;
  cashAccountBalanceEvents: CashAccountBalanceEventRepository;
  portfolioEvents: PortfolioEventRepository;
  snapshots: PortfolioSnapshotRepository;
  securityPriceHistory: SecurityPriceHistoryRepository;
  preferences: PreferenceRepository;
  recommendations: RecommendationRepository;
  analysisRuns: PortfolioAnalysisRunRepository;
  externalResearchJobs: ExternalResearchJobRepository;
  externalResearchUsageCounters: ExternalResearchUsageCounterRepository;
  importJobs: ImportJobRepository;
}
