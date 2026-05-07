import type {
  AccountType,
  HoldingPosition,
  InvestmentAccount,
  PreferenceProfile,
  PortfolioSnapshot,
  SecurityPriceHistoryPoint,
} from "@/lib/backend/models";
import type { AnalyzerSecurityIdentity } from "@/lib/backend/portfolio-analyzer-contracts";

export interface SecurityDecisionMarketDataContext {
  priceHistory?: SecurityPriceHistoryPoint[];
  portfolioSnapshots?: PortfolioSnapshot[];
}

export type SecurityDecisionVerdict =
  | "good-candidate"
  | "watch-only"
  | "weak-fit"
  | "review-existing"
  | "needs-more-data";

export interface SecurityPreferenceFit {
  score: number;
  summary: string;
  notes: string[];
  blockers: string[];
}

export interface SecurityDecisionContext {
  identity: AnalyzerSecurityIdentity;
  accounts: InvestmentAccount[];
  holdings: HoldingPosition[];
  profile: PreferenceProfile;
  marketData?: SecurityDecisionMarketDataContext;
  generatedAt: string;
  normalizedSymbol: string;
  matchingHoldings: HoldingPosition[];
  referenceHolding?: HoldingPosition;
  economicAssetClass: string;
  targetPct: number;
  currentSleevePct: number;
  heldValueCad: number;
  heldWeightPct: number;
  accountTypes: AccountType[];
  preferenceFit: SecurityPreferenceFit;
  blockers: string[];
  hasEnoughMarketData: boolean;
  marketDataConfidenceScore: number;
}

export interface SecurityDecisionSummary {
  gapPct: number;
  title: string;
  detail: string;
}

export type SecurityGuardrailSeverity = "info" | "low" | "medium" | "high";

export type SecurityGuardrailCategory =
  | "identity"
  | "freshness"
  | "duplicate-exposure"
  | "preference-conflict"
  | "tax-account-mismatch"
  | "liquidity"
  | "account-fit"
  | "market-data"
  | "portfolio-fit";

export interface SecurityGuardrail {
  id: string;
  category: SecurityGuardrailCategory;
  severity: SecurityGuardrailSeverity;
  title: string;
  detail: string;
  blocking: boolean;
  source?: string | null;
}

export interface SecurityPortfolioFit {
  score: number;
  targetGapPct: number;
  currentSleevePct: number;
  targetPct: number;
  heldWeightPct: number;
  duplicateExposurePct: number;
  accountFitScore: number;
  taxFitScore: number;
  fxFitScore: number;
  liquidityFitScore: number;
  summary: string;
  strengths: string[];
  concerns: string[];
  accountNotes: string[];
}

export interface SecurityDecisionAnalysis {
  context: SecurityDecisionContext;
  decision: SecurityDecisionSummary;
  verdict: SecurityDecisionVerdict;
  summaryLabel: string;
  guardrails: SecurityGuardrail[];
  blocked: boolean;
  fit: SecurityPortfolioFit;
}
