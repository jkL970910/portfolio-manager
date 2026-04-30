export type EntityId = string;
export type CurrencyCode = "CAD" | "USD";
export type DisplayLanguage = "zh" | "en";
export type CitizenGender = "male" | "female";
export type CitizenRank =
  | "lowly-ox"
  | "base-loo"
  | "citizen"
  | "general"
  | "emperor";
export type CitizenAddressTier =
  | "cowshed"
  | "suburbs"
  | "city"
  | "palace-gate"
  | "bedchamber";
export type CitizenAvatarType = "default" | "male" | "female" | "emperor";

export type AccountType = "TFSA" | "RRSP" | "FHSA" | "Taxable";
export type RiskProfile = "Conservative" | "Balanced" | "Growth";
export type TransitionPreference = "stay-close" | "gradual" | "direct";
export type RecommendationStrategy = "tax-aware" | "target-first" | "balanced";
export type PreferenceProfileSource = "manual" | "guided";
export type PreferenceFactorLevel = "low" | "medium" | "high";
export type UsdFundingPath = "unknown" | "available" | "avoid";
export type GuidedAllocationGoal =
  | "retirement"
  | "home"
  | "wealth"
  | "capital-preservation";
export type GuidedAllocationHorizon = "short" | "medium" | "long";
export type GuidedAllocationVolatility = "low" | "medium" | "high";
export type GuidedAllocationPriority =
  | "tax-efficiency"
  | "balanced"
  | "stay-close";
export type GuidedAllocationCashNeed = "low" | "medium" | "high";

export interface UserProfile {
  id: EntityId;
  email: string;
  displayName: string;
  baseCurrency: CurrencyCode;
  displayLanguage: DisplayLanguage;
}

export interface CitizenProfile {
  id: EntityId;
  userId: EntityId;
  citizenName: string;
  gender: CitizenGender | null;
  birthDate: string | null;
  avatarType: CitizenAvatarType;
  derivedRank: CitizenRank;
  derivedAddressTier: CitizenAddressTier;
  derivedIdCode: string;
  overrideRank: CitizenRank | null;
  overrideAddressTier: CitizenAddressTier | null;
  overrideIdCode: string | null;
  effectiveRank: CitizenRank;
  effectiveAddressTier: CitizenAddressTier;
  effectiveIdCode: string;
  wealthScoreSnapshotCad: number;
  issuedAt: string;
  updatedAt: string;
}

export interface InvestmentAccount {
  id: EntityId;
  userId: EntityId;
  institution: string;
  type: AccountType;
  nickname: string;
  currency?: CurrencyCode;
  marketValueAmount?: number;
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
  rawAssetClass?: string;
  assetClassOverride?: string | null;
  sector: string;
  rawSector?: string;
  sectorOverride?: string | null;
  currency?: CurrencyCode;
  securityTypeOverride?: string | null;
  exchangeOverride?: string | null;
  marketSectorOverride?: string | null;
  quantity?: number | null;
  avgCostPerShareAmount?: number | null;
  costBasisAmount?: number | null;
  lastPriceAmount?: number | null;
  marketValueAmount?: number;
  avgCostPerShareCad?: number | null;
  costBasisCad?: number | null;
  lastPriceCad?: number | null;
  marketValueCad: number;
  quoteProvider?: string | null;
  quoteSourceMode?: string | null;
  quoteStatus?: string | null;
  quoteCurrency?: CurrencyCode | null;
  quoteExchange?: string | null;
  quoteProviderTimestamp?: string | null;
  lastQuoteAttemptedAt?: string | null;
  lastQuoteSuccessAt?: string | null;
  lastQuoteErrorCode?: string | null;
  lastQuoteErrorMessage?: string | null;
  marketDataRefreshRunId?: string | null;
  weightPct: number;
  gainLossPct: number;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface PortfolioSnapshot {
  id: EntityId;
  userId: EntityId;
  snapshotDate: string;
  totalValueCad: number;
  accountBreakdown: Record<string, number>;
  holdingBreakdown: Record<string, number>;
  sourceVersion: string;
  sourceMode?: string | null;
  freshness?: string | null;
  refreshRunId?: string | null;
  isReference?: boolean;
  fallbackReason?: string | null;
  createdAt: string;
}

export interface SecurityPriceHistoryPoint {
  id: EntityId;
  symbol: string;
  exchange?: string | null;
  priceDate: string;
  close: number;
  adjustedClose: number | null;
  currency: CurrencyCode;
  source: string;
  provider?: string | null;
  sourceMode?: string | null;
  freshness?: string | null;
  refreshRunId?: string | null;
  isReference?: boolean;
  fallbackReason?: string | null;
  createdAt: string;
}

export interface FxRatePoint {
  id: EntityId;
  baseCurrency: CurrencyCode;
  quoteCurrency: CurrencyCode;
  rateDate: string;
  rate: number;
  source: string;
  createdAt: string;
}

export interface PortfolioEvent {
  id: EntityId;
  userId: EntityId;
  accountId: EntityId;
  symbol: string | null;
  eventType: string;
  quantity: number | null;
  priceAmount: number | null;
  currency: CurrencyCode | null;
  bookedAt: string;
  effectiveAt: string;
  source: string;
  createdAt: string;
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

export interface CashAccount {
  id: EntityId;
  userId: EntityId;
  institution: string;
  nickname: string;
  currency: CurrencyCode;
  currentBalanceAmount: number;
  currentBalanceCad: number;
  createdAt: string;
  updatedAt: string;
}

export interface CashAccountBalanceEvent {
  id: EntityId;
  userId: EntityId;
  cashAccountId: EntityId;
  bookedAt: string;
  balanceAmount: number;
  balanceCad: number;
  source: string;
  createdAt: string;
}

export interface AllocationTarget {
  assetClass: string;
  targetPct: number;
}

export interface AssetClassConstraintBand {
  assetClass: string;
  minPct?: number | null;
  maxPct?: number | null;
}

export interface SecurityConstraintIdentity {
  symbol: string;
  exchange?: string | null;
  currency?: CurrencyCode | null;
  name?: string | null;
  provider?: string | null;
}

export interface RecommendationConstraints {
  excludedSymbols: string[];
  preferredSymbols: string[];
  excludedSecurities: SecurityConstraintIdentity[];
  preferredSecurities: SecurityConstraintIdentity[];
  assetClassBands: AssetClassConstraintBand[];
  avoidAccountTypes: AccountType[];
  preferredAccountTypes: AccountType[];
  allowedSecurityTypes: string[];
}

export interface PreferenceFactors {
  behavior: {
    riskCapacity: PreferenceFactorLevel;
    maxDrawdownComfortPct: number | null;
    volatilityComfort: PreferenceFactorLevel;
    concentrationTolerance: PreferenceFactorLevel;
    leverageAllowed: boolean;
    optionsAllowed: boolean;
    cryptoAllowed: boolean;
  };
  sectorTilts: {
    preferredSectors: string[];
    avoidedSectors: string[];
    styleTilts: string[];
    thematicInterests: string[];
  };
  lifeGoals: {
    homePurchase: {
      enabled: boolean;
      horizonYears: number | null;
      downPaymentTargetCad: number | null;
      priority: PreferenceFactorLevel;
    };
    emergencyFundTargetCad: number | null;
    expectedLargeExpenses: string[];
    retirementHorizonYears: number | null;
  };
  taxStrategy: {
    province: string | null;
    marginalTaxBracket: PreferenceFactorLevel | null;
    rrspDeductionPriority: PreferenceFactorLevel;
    tfsaGrowthPriority: PreferenceFactorLevel;
    fhsaHomeGoalPriority: PreferenceFactorLevel;
    taxableTaxSensitivity: PreferenceFactorLevel;
    dividendWithholdingSensitivity: PreferenceFactorLevel;
    usdFundingPath: UsdFundingPath;
  };
  liquidity: {
    monthlyContributionCad: number | null;
    minimumTradeSizeCad: number | null;
    liquidityNeed: PreferenceFactorLevel;
    cashDuringUncertainty: PreferenceFactorLevel;
  };
  externalInfo: {
    allowNewsSignals: boolean;
    allowInstitutionalSignals: boolean;
    allowCommunitySignals: boolean;
    preferredFreshnessHours: number;
    maxDailyExternalCalls: number;
  };
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
  source?: PreferenceProfileSource | null;
  rebalancingTolerancePct: number;
  watchlistSymbols: string[];
  recommendationConstraints: RecommendationConstraints;
  preferenceFactors: PreferenceFactors;
  updatedAt?: string | null;
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
  suggestedProfile: Omit<
    PreferenceProfile,
    | "id"
    | "userId"
    | "watchlistSymbols"
    | "recommendationConstraints"
    | "preferenceFactors"
  >;
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
  securitySymbol?: string;
  securityName?: string;
  securityScore?: number;
  preferenceFitScore?: number;
  allocationGapBeforePct?: number;
  allocationGapAfterPct?: number;
  accountFitScore?: number;
  taxFitScore?: number;
  fxFrictionPenaltyBps?: number;
  rationale?: {
    assetClass: string;
    targetPct: number;
    currentPct: number;
    gapBeforePct: number;
    gapAfterPct: number;
    selectedAccountType: AccountType;
    selectedSecurity: string;
    selectedSecurityName: string;
    accountFitScore: number;
    taxFitScore: number;
    securityScore: number;
    preferenceFitScore?: number;
    preferenceSignals?: string[];
    fxPolicy: string;
    fxPenaltyBps: number;
    minTradeApplied: boolean;
    watchlistMatched: boolean;
    preferredSymbolMatched?: boolean;
    existingHoldingId?: string;
    existingHoldingAccountId?: string;
    existingHoldingSymbol?: string;
    existingHoldingWeightPct?: number;
    existingHoldingRiskContributionPct?: number;
  };
}

export interface RecommendationRun {
  id: EntityId;
  userId: EntityId;
  contributionAmountCad: number;
  createdAt: string;
  engineVersion?: string | null;
  objective?: string | null;
  confidenceScore?: number | null;
  items: RecommendationItem[];
  assumptions: string[];
  notes?: string[];
}

export interface PortfolioAnalysisRun {
  id: EntityId;
  userId: EntityId;
  scope: "security" | "portfolio" | "account" | "recommendation-run";
  mode: "quick" | "full";
  targetKey: string;
  request: Record<string, unknown>;
  result: Record<string, unknown>;
  sourceMode: "local" | "cached-external" | "live-external";
  generatedAt: string;
  expiresAt: string;
  createdAt: string;
}

export type ExternalResearchScope = PortfolioAnalysisRun["scope"];
export type ExternalResearchJobStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled";

export interface ExternalResearchJob {
  id: EntityId;
  userId: EntityId;
  scope: ExternalResearchScope;
  targetKey: string;
  request: Record<string, unknown>;
  status: ExternalResearchJobStatus;
  sourceMode: "cached-external";
  sourceAllowlist: Record<string, unknown>[];
  priority: number;
  attemptCount: number;
  maxAttempts: number;
  runAfter: string;
  lockedAt: string | null;
  lockedBy: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  errorMessage: string | null;
  resultRunId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExternalResearchUsageCounter {
  id: EntityId;
  userId: EntityId;
  counterDate: string;
  scope: ExternalResearchScope;
  runCount: number;
  symbolCount: number;
  createdAt: string;
  updatedAt: string;
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
