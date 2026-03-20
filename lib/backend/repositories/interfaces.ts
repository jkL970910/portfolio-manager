import {
  CashflowTransaction,
  EntityId,
  HoldingPosition,
  ImportJob,
  InvestmentAccount,
  PreferenceProfile,
  RecommendationRun,
  UserProfile
} from "@/lib/backend/models";

export interface AuthUserRecord {
  profile: UserProfile;
  passwordHash: string;
}

export interface UserRepository {
  getById(userId: EntityId): Promise<UserProfile>;
  findByEmail(email: string): Promise<AuthUserRecord | null>;
  updateBaseCurrency(userId: EntityId, currency: UserProfile["baseCurrency"]): Promise<UserProfile>;
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

export interface PreferenceRepository {
  getByUserId(userId: EntityId): Promise<PreferenceProfile>;
}

export interface RecommendationRepository {
  getLatestByUserId(userId: EntityId): Promise<RecommendationRun>;
}

export interface ImportJobRepository {
  getLatestByUserId(userId: EntityId): Promise<ImportJob>;
}

export interface BackendRepositories {
  users: UserRepository;
  accounts: AccountRepository;
  holdings: HoldingRepository;
  transactions: TransactionRepository;
  preferences: PreferenceRepository;
  recommendations: RecommendationRepository;
  importJobs: ImportJobRepository;
}
