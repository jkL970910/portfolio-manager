import type {
  AccountType,
  CurrencyCode,
  RecommendationRun,
} from "@/lib/backend/models";
import type { RecommendationAction } from "@/lib/backend/recommendation-v3/core-universe";

export type CandidateBriefSource =
  | "core_pool"
  | "watchlist"
  | "existing_holding"
  | "manual";

export type CandidateBrief = {
  identity: {
    securityId?: string | null;
    symbol: string;
    name: string;
    exchange?: string | null;
    currency?: CurrencyCode | null;
  };
  source: CandidateBriefSource;
  decision: {
    action: RecommendationAction;
    matchScore: number;
    recommendedAmountCad: number;
    targetAccount: AccountType;
  };
  portfolioImpact: {
    gapResolved: {
      beforePct: number | null;
      afterPct: number | null;
    };
  };
  badges: string[];
  primaryBlocker: string | null;
  rejectionReason: string | null;
  dailyBriefId: string | null;
};

type CandidateBriefDailyDocument = {
  id: string;
  identity?: {
    securityId?: string | null;
    symbol?: string | null;
    exchange?: string | null;
    currency?: string | null;
  } | null;
};

export function buildCandidateBrief(
  item: RecommendationRun["items"][number],
  options: {
    dailyBriefDocuments?: CandidateBriefDailyDocument[];
  } = {},
): CandidateBrief {
  const matchScore = Math.round(
    ((item.securityScore ?? 0) * 0.45 +
      (item.accountFitScore ?? 0) * 0.3 +
      (item.taxFitScore ?? 0) * 0.25) *
      10,
  ) / 10;
  const fxPenalty = item.fxFrictionPenaltyBps ?? 0;
  const concentrationPct = item.rationale?.existingHoldingWeightPct ?? null;
  const isWatchlist = item.rationale?.watchlistMatched ?? false;
  const source: CandidateBriefSource = isWatchlist
    ? "watchlist"
    : item.rationale?.existingHoldingId
      ? "existing_holding"
      : "core_pool";
  const primaryBlocker =
    concentrationPct != null && concentrationPct >= 20
      ? "当前相关持仓已经偏重"
      : fxPenalty >= 100
        ? "换汇摩擦偏高"
        : null;
  const action: RecommendationAction = primaryBlocker
    ? "avoid"
    : fxPenalty > 0 || concentrationPct != null && concentrationPct >= 12
      ? "dca"
      : "lump_sum";
  const badges = [
    item.assetClass,
    isWatchlist ? "囤货清单命中" : "核心池候选",
    fxPenalty > 0 ? "注意换汇" : "账户顺手",
    item.allocationGapBeforePct != null
      ? `缺口 ${item.allocationGapBeforePct.toFixed(1)}%`
      : null,
  ].filter((badge): badge is string => Boolean(badge));

  return {
    identity: {
      securityId: item.securityId ?? null,
      symbol: item.securitySymbol ?? item.tickerOptions[0] ?? "",
      name:
        item.securityName ??
        item.securitySymbol ??
        item.tickerOptions[0] ??
        "待确认标的",
      exchange: item.securityExchange ?? null,
      currency: item.securityCurrency ?? null,
    },
    source,
    decision: {
      action,
      matchScore,
      recommendedAmountCad: item.amountCad,
      targetAccount: item.targetAccountType,
    },
    portfolioImpact: {
      gapResolved: {
        beforePct: item.allocationGapBeforePct ?? null,
        afterPct: item.allocationGapAfterPct ?? null,
      },
    },
    badges,
    primaryBlocker,
    rejectionReason: primaryBlocker,
    dailyBriefId: findDailyBriefId(item, options.dailyBriefDocuments ?? []),
  };
}

function findDailyBriefId(
  item: RecommendationRun["items"][number],
  documents: CandidateBriefDailyDocument[],
) {
  const symbol = item.securitySymbol?.trim().toUpperCase();
  if (!symbol) {
    return null;
  }
  const exchange = item.securityExchange?.trim().toUpperCase() ?? null;
  const currency = item.securityCurrency ?? null;
  return (
    documents.find((document) => {
      if (item.securityId && document.identity?.securityId === item.securityId) {
        return true;
      }
      return (
        document.identity?.symbol?.trim().toUpperCase() === symbol &&
        (!exchange ||
          document.identity?.exchange?.trim().toUpperCase() === exchange) &&
        (!currency || document.identity?.currency === currency)
      );
    })?.id ?? null
  );
}
