export type EntityId = string;

export type AccountType = "TFSA" | "RRSP" | "FHSA" | "Taxable";
export type RiskProfile = "Conservative" | "Balanced" | "Growth";
export type TransitionPreference = "stay-close" | "gradual" | "direct";
export type RecommendationStrategy = "tax-aware" | "target-first" | "balanced";
export type GuidedAllocationGoal = "retirement" | "home" | "wealth" | "capital-preservation";
export type GuidedAllocationHorizon = "short" | "medium" | "long";
export type GuidedAllocationVolatility = "low" | "medium" | "high";
export type GuidedAllocationPriority = "tax-efficiency" | "balanced" | "stay-close";
export type GuidedAllocationCashNeed = "low" | "medium" | "high";

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
  quantity?: number | null;
  avgCostPerShareCad?: number | null;
  costBasisCad?: number | null;
  lastPriceCad?: number | null;
  marketValueCad: number;
  weightPct: number;
  gainLossPct: number;
  updatedAt?: string | null;
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

export interface GuidedAllocationAnswers {
  goal: GuidedAllocationGoal;
  horizon: GuidedAllocationHorizon;
  volatility: GuidedAllocationVolatility;
  priority: GuidedAllocationPriority;
  cashNeed: GuidedAllocationCashNeed;
}

export interface GuidedAllocationDraft {
  id: EntityId;
  userId: EntityId;
  answers: GuidedAllocationAnswers;
  suggestedProfile: Omit<PreferenceProfile, "id" | "userId" | "watchlistSymbols">;
  assumptions: string[];
  rationale: string[];
  createdAt: string;
  updatedAt: string;
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
  workflow: "portfolio" | "spending";
  status: "draft" | "mapped" | "validated" | "completed";
  sourceType: "csv";
  fileName: string;
  createdAt: string;
}

export interface ImportMappingPreset {
  id: EntityId;
  userId: EntityId;
  name: string;
  sourceType: "csv";
  mapping: Record<string, string>;
  createdAt: string;
}

export interface AuthIdentity {
  userId: EntityId;
  email: string;
  passwordHash: string;
}
