import type { AccountType } from "@/lib/backend/models";
import type {
  SecurityDecisionContext,
  SecurityPortfolioFit,
} from "@/lib/backend/security-decision/types";
import { formatPercent, sum } from "@/lib/backend/security-decision/validators";

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function preferredAccountScore(context: SecurityDecisionContext) {
  if (context.matchingHoldings.length === 0) {
    return 62;
  }

  const preferred = new Set(context.profile.accountFundingPriority);
  const preferredTypes = context.accountTypes.filter((type) => preferred.has(type));
  return clampScore(55 + preferredTypes.length * 18);
}

function taxFitScore(context: SecurityDecisionContext) {
  let score = 70;
  if (!context.profile.taxAwarePlacement) {
    return score - 5;
  }

  const types = new Set<AccountType>(context.accountTypes);
  if (context.identity.currency === "USD" && types.has("TFSA")) {
    score -= 18;
  }
  if (context.identity.currency === "USD" && types.has("RRSP")) {
    score += 10;
  }
  if (context.identity.currency === "CAD" && types.has("TFSA")) {
    score += 6;
  }

  return clampScore(score);
}

function fxFitScore(context: SecurityDecisionContext) {
  if (context.identity.currency !== "USD") {
    return 78;
  }

  const path = context.profile.preferenceFactors.taxStrategy.usdFundingPath;
  if (path === "available") return 76;
  if (path === "avoid") return 42;
  return 58;
}

function liquidityFitScore(context: SecurityDecisionContext) {
  const liquidity = context.profile.preferenceFactors.liquidity;
  let score = 70;
  if (liquidity.liquidityNeed === "high") score -= 18;
  if (liquidity.cashDuringUncertainty === "high") score -= 12;
  if (context.profile.preferenceFactors.lifeGoals.homePurchase.priority === "high") score -= 10;
  return clampScore(score);
}

export function evaluateSecurityPortfolioFit(context: SecurityDecisionContext): SecurityPortfolioFit {
  const targetGapPct = context.targetPct - context.currentSleevePct;
  const duplicateExposurePct = context.heldWeightPct;
  const accountFitScore = preferredAccountScore(context);
  const taxScore = taxFitScore(context);
  const fxScore = fxFitScore(context);
  const liquidityScore = liquidityFitScore(context);
  const sleeveScore = context.targetPct <= 0
    ? 38
    : targetGapPct >= 5
      ? 82
      : targetGapPct <= -5
        ? 42
        : 66;
  const concentrationPenalty = Math.max(0, duplicateExposurePct - 12) * 2.5;
  const score = clampScore(
    sleeveScore * 0.35 +
      context.preferenceFit.score * 0.2 +
      accountFitScore * 0.15 +
      taxScore * 0.12 +
      fxScore * 0.1 +
      liquidityScore * 0.08 -
      concentrationPenalty,
  );

  const strengths = [
    targetGapPct >= 5
      ? `${context.economicAssetClass} 仍有约 ${formatPercent(targetGapPct)} 目标缺口。`
      : null,
    context.preferenceFit.score >= 70 ? "偏好因素整体匹配度较好。" : null,
    accountFitScore >= 70 ? "现有账户位置与账户优先级较匹配。" : null,
    taxScore >= 75 ? "账户/税务路径没有明显冲突。" : null,
  ].filter((item): item is string => Boolean(item));

  const concerns = [
    context.targetPct <= 0
      ? `偏好里没有为 ${context.economicAssetClass} 设置明确目标。`
      : null,
    targetGapPct <= -5
      ? `${context.economicAssetClass} 已高于目标约 ${formatPercent(Math.abs(targetGapPct))}。`
      : null,
    duplicateExposurePct >= 12
      ? `该标的/同身份持仓已有约 ${formatPercent(duplicateExposurePct)}，需要复核集中度。`
      : null,
    taxScore < 60 ? "账户/税务路径存在摩擦。" : null,
    fxScore < 60 ? "USD/CAD 资金路径需要先确认。" : null,
    liquidityScore < 60 ? "现金流或买房/应急资金目标会压低新增买入优先级。" : null,
  ].filter((item): item is string => Boolean(item));

  const accountNotes = context.accountTypes.length > 0
    ? [`当前匹配持仓账户：${context.accountTypes.join(" / ")}。`]
    : ["当前未持有；新增买入前需要先选择账户位置。"];

  return {
    score,
    targetGapPct,
    currentSleevePct: context.currentSleevePct,
    targetPct: context.targetPct,
    heldWeightPct: context.heldWeightPct,
    duplicateExposurePct,
    accountFitScore,
    taxFitScore: taxScore,
    fxFitScore: fxScore,
    liquidityFitScore: liquidityScore,
    summary: [
      `组合适配分 ${score}/100。`,
      `${context.economicAssetClass} 当前约 ${formatPercent(context.currentSleevePct)}，目标约 ${formatPercent(context.targetPct)}，差距 ${formatPercent(targetGapPct)}。`,
      context.matchingHoldings.length > 0
        ? `当前持仓约 ${formatPercent(context.heldWeightPct)}。`
        : "当前未持有，按新增候选标的评估。",
    ].join(" "),
    strengths: strengths.slice(0, 5),
    concerns: concerns.slice(0, 6),
    accountNotes,
  };
}
