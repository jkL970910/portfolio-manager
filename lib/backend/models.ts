export type EntityId = string;

export type AccountType = "TFSA" | "RRSP" | "FHSA" | "Taxable";
export type RiskProfile = "Conservative" | "Balanced" | "Growth";
export type TransitionPreference = "stay-close" | "gradual" | "direct";
export type RecommendationStrategy = "tax-aware" | "target-first" | "balanced";

export interface UserProfile {
  id: EntityId;
  email: string;
  displayName: string;
  baseCurrency: "CAD";
}

export interface InvestmentAccount {
  id: EntityId;
  userId: EntityId;
  institution: string;
  type: AccountType;
  nickname: string;
  marketValueCad: number;
  contributionRoomCad: number | null;
}

export interface HoldingPosition {
  id: EntityId;
  userId: EntityId;
  accountId: EntityId;
  symbol: string;
  name: string;
  assetClass: string;
  sector: string;
  marketValueCad: number;
  weightPct: number;
  gainLossPct: number;
}

export interface CashflowTransaction {
  id: EntityId;
  userId: EntityId;
  accountId?: EntityId;
  bookedAt: string;
  merchant: string;
  category: string;
  amountCad: number;
  direction: "inflow" | "outflow";
}

export interface AllocationTarget {
  assetClass: string;
  targetPct: number;
}

export interface PreferenceProfile {
  id: EntityId;
  userId: EntityId;
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

export interface RecommendationItem {
  assetClass: string;
  amountCad: number;
  targetAccountType: AccountType;
  tickerOptions: string[];
  explanation: string;
}

export interface RecommendationRun {
  id: EntityId;
  userId: EntityId;
  contributionAmountCad: number;
  createdAt: string;
  items: RecommendationItem[];
  assumptions: string[];
}

export interface ImportJob {
  id: EntityId;
  userId: EntityId;
  status: "draft" | "mapped" | "validated" | "completed";
  sourceType: "csv";
  fileName: string;
  createdAt: string;
}

export interface AuthIdentity {
  userId: EntityId;
  email: string;
  passwordHash: string;
}
