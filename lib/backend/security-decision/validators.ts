import type { HoldingPosition, PreferenceProfile } from "@/lib/backend/models";
import {
  getHoldingEconomicAssetClass as getProjectHoldingEconomicAssetClass,
  inferEconomicAssetClass as inferProjectEconomicAssetClass,
} from "@/lib/backend/security-economic-exposure";

export function formatPercent(value: number, digits = 1) {
  return `${round(value, digits)}%`;
}

export function round(value: number, digits = 0) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

export const getHoldingEconomicAssetClass = getProjectHoldingEconomicAssetClass;

export const inferEconomicAssetClass = inferProjectEconomicAssetClass;

export function buildEconomicExposureNote(args: {
  holding: HoldingPosition;
  economicAssetClass: string;
  symbol: string;
  exchange?: string | null;
  currency?: string | null;
}) {
  const listing = [
    args.symbol,
    args.exchange,
    args.currency,
  ]
    .filter(Boolean)
    .join(" · ");
  if (args.economicAssetClass === args.holding.assetClass) {
    return `经济暴露按 ${args.economicAssetClass} 评估，交易身份仍保留 ${listing}。`;
  }

  return `交易身份仍保留 ${listing}，但配置/目标适配按底层经济暴露 ${args.economicAssetClass} 评估，而不是按 ${args.holding.assetClass} 或交易币种简单归类。`;
}

export function buildCandidateEconomicExposureNote(args: {
  symbol: string;
  exchange?: string | null;
  currency?: string | null;
  economicAssetClass: string;
}) {
  const listing = [
    args.symbol,
    args.exchange,
    args.currency,
  ]
    .filter(Boolean)
    .join(" · ");
  return `这是候选标的口径：交易身份保留 ${listing}，组合适配按底层经济暴露 ${args.economicAssetClass} 评估；当前 0% 只代表尚未持有，不代表无法分析。`;
}

export function buildPreferenceFitNotes(args: {
  profile: PreferenceProfile;
  sector: string | null | undefined;
  economicAssetClass: string;
  isHeld: boolean;
}) {
  const factors = args.profile.preferenceFactors;
  const sector = args.sector?.trim();
  const preferredSectors = factors.sectorTilts.preferredSectors;
  const avoidedSectors = factors.sectorTilts.avoidedSectors;
  const notes: string[] = [];
  const blockers: string[] = [];
  let score = 62;

  if (sector) {
    const isPreferred = preferredSectors.some(
      (item) => item.trim().toLowerCase() === sector.toLowerCase(),
    );
    const isAvoided = avoidedSectors.some(
      (item) => item.trim().toLowerCase() === sector.toLowerCase(),
    );
    if (isPreferred) {
      notes.push(`行业偏好匹配：你的偏好里包含 ${sector}。`);
      score += 18;
    } else if (isAvoided) {
      notes.push(`行业偏好冲突：你的规避列表里包含 ${sector}。`);
      blockers.push(`行业偏好冲突：${sector} 在你的规避列表里。`);
      score -= 25;
    } else {
      notes.push(`行业偏好中性：${sector} 没有被列为明确偏好或规避。`);
    }
  } else {
    notes.push("行业资料还不完整，偏好匹配只能先按资产类别判断。");
    score -= 8;
  }

  if (factors.behavior.riskCapacity === "high") {
    notes.push("风险容量偏高，可以容忍更高波动，但仍要控制单一标的集中度。");
    score += args.economicAssetClass.includes("Equity") ? 6 : 0;
  } else if (factors.behavior.riskCapacity === "low") {
    notes.push("风险容量偏低，新增或加仓前应更重视回撤和现金缓冲。");
    if (args.economicAssetClass.includes("Equity")) {
      blockers.push("风险容量偏低：新增权益类资产前需要更保守地确认回撤承受能力。");
    }
    score -= args.economicAssetClass.includes("Equity") ? 12 : 0;
  }

  if (factors.lifeGoals.homePurchase.enabled) {
    notes.push("你设置了买房目标，新增波动资产前应确认不会挤压首付或现金计划。");
    if (factors.lifeGoals.homePurchase.priority === "high") {
      blockers.push("买房目标优先级高：新增买入前需要先确认首付和现金计划。");
    }
    score -= 6;
  }

  if (!args.isHeld) {
    notes.push("当前未持有时，应把它当作新增候选标的，而不是现有仓位复盘。");
  }

  return {
    score: Math.max(25, Math.min(90, score)),
    summary: notes.join(" "),
    notes,
    blockers,
  };
}

export function getSecurityDecisionVerdict(args: {
  targetPct: number;
  gapPct: number;
  heldWeightPct: number;
  hasBlockers: boolean;
  hasEnoughMarketData: boolean;
}): "good-candidate" | "watch-only" | "weak-fit" | "review-existing" | "needs-more-data" {
  if (!args.hasEnoughMarketData) {
    return "needs-more-data";
  }
  if (args.heldWeightPct >= 15) {
    return "review-existing";
  }
  if (args.targetPct <= 0 || args.gapPct <= -5) {
    return "weak-fit";
  }
  if (args.hasBlockers) {
    return "watch-only";
  }
  if (args.gapPct >= 5) {
    return "good-candidate";
  }
  return "watch-only";
}

export function getMarketDataConfidenceScore(args: {
  quoteProviderCount: number;
  freshHistoryPointCount: number;
  fallbackPointCount: number;
  stalePointCount: number;
}) {
  const hasAnyRealMarketData = args.quoteProviderCount > 0 || args.freshHistoryPointCount > 0;
  if (!hasAnyRealMarketData) {
    return 45;
  }

  const baseScore = args.freshHistoryPointCount >= 5 ? 70 : 62;
  const historyDepthBonus = Math.min(args.freshHistoryPointCount, 25);
  const providerBonus = args.quoteProviderCount > 0 ? 8 : 0;
  const penalty = args.fallbackPointCount * 8 + args.stalePointCount * 4;

  return Math.max(35, Math.min(90, baseScore + historyDepthBonus + providerBonus - penalty));
}
