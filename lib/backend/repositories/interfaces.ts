import {
  CashflowTransaction,
  EntityId,
  ExternalResearchDocumentRecord,
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
  SecurityAliasRecord,
  SecurityPriceHistoryPoint,
  SecurityRecord,
  MarketSentimentSnapshot,
  PortfolioAnalysisGptEnhancement,
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
  listBySecurityId(securityId: EntityId): Promise<SecurityPriceHistoryPoint[]>;
  listByIdentity(input: {
    symbol: string;
    exchange?: string | null;
    currency?: string | null;
  }): Promise<SecurityPriceHistoryPoint[]>;
}

export interface SecurityRepository {
  getById(securityId: EntityId): Promise<SecurityRecord | null>;
  listNeedingMetadataRefresh(params: {
    limit: number;
    staleBefore: string;
  }): Promise<SecurityRecord[]>;
  findByCanonicalIdentity(input: {
    symbol: string;
    canonicalExchange: string;
    currency: SecurityRecord["currency"];
  }): Promise<SecurityRecord | null>;
  findByAlias(input: {
    aliasType: SecurityAliasRecord["aliasType"];
    aliasValue: string;
    provider?: string | null;
  }): Promise<SecurityRecord | null>;
  upsertCanonical(
    input: Omit<SecurityRecord, "id" | "createdAt" | "updatedAt">,
  ): Promise<SecurityRecord>;
  updateMetadata(
    securityId: EntityId,
    input: Pick<
      SecurityRecord,
      | "economicAssetClass"
      | "economicSector"
      | "exposureRegion"
      | "metadataSource"
      | "metadataConfidence"
      | "metadataAsOf"
      | "metadataConfirmedAt"
      | "metadataNotes"
    >,
  ): Promise<SecurityRecord>;
  addAlias(
    input: Omit<SecurityAliasRecord, "id" | "createdAt">,
  ): Promise<SecurityAliasRecord>;
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

export interface PortfolioAnalysisGptEnhancementRepository {
  getFreshByKey(
    userId: EntityId,
    params: {
      enhancementKey: string;
      now: Date;
    },
  ): Promise<PortfolioAnalysisGptEnhancement | null>;
  upsert(
    input: Omit<
      PortfolioAnalysisGptEnhancement,
      "id" | "createdAt" | "updatedAt"
    >,
  ): Promise<PortfolioAnalysisGptEnhancement>;
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
  markSkipped(
    jobId: EntityId,
    message: string,
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

export interface ExternalResearchDocumentRepository {
  create(
    input: Omit<ExternalResearchDocumentRecord, "id" | "createdAt" | "updatedAt">,
  ): Promise<ExternalResearchDocumentRecord>;
  listFreshByUserId(
    userId: EntityId,
    params: {
      now: Date;
      limit: number;
      securityId?: EntityId | null;
      symbol?: string | null;
      exchange?: string | null;
      currency?: string | null;
      underlyingId?: string | null;
    },
  ): Promise<ExternalResearchDocumentRecord[]>;
}

export interface MarketSentimentSnapshotRepository {
  create(
    input: Omit<MarketSentimentSnapshot, "id" | "createdAt" | "updatedAt">,
  ): Promise<MarketSentimentSnapshot>;
  getLatest(params: {
    now: Date;
    provider?: string;
    indexName?: string;
  }): Promise<MarketSentimentSnapshot | null>;
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
  securities: SecurityRepository;
  preferences: PreferenceRepository;
  recommendations: RecommendationRepository;
  analysisRuns: PortfolioAnalysisRunRepository;
  analysisGptEnhancements: PortfolioAnalysisGptEnhancementRepository;
  externalResearchJobs: ExternalResearchJobRepository;
  externalResearchUsageCounters: ExternalResearchUsageCounterRepository;
  externalResearchDocuments: ExternalResearchDocumentRepository;
  marketSentimentSnapshots: MarketSentimentSnapshotRepository;
  importJobs: ImportJobRepository;
}
