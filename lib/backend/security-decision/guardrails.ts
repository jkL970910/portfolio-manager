import type {
  SecurityDecisionContext,
  SecurityGuardrail,
} from "@/lib/backend/security-decision/types";
import { formatPercent } from "@/lib/backend/security-decision/validators";

function hasCompleteIdentity(context: SecurityDecisionContext) {
  return Boolean(
    context.identity.symbol.trim() &&
      context.identity.exchange?.trim() &&
      context.identity.currency?.trim(),
  );
}

export function evaluateHardGuardrails(context: SecurityDecisionContext): SecurityGuardrail[] {
  const guardrails: SecurityGuardrail[] = [];
  if (!hasCompleteIdentity(context)) {
    guardrails.push({
      id: "identity-incomplete",
      category: "identity",
      severity: "high",
      title: "标的身份不完整",
      detail: "继续分析前需要补全 symbol、exchange、currency，避免混用同 ticker 的 CAD/US 版本。",
      blocking: true,
      source: "security-identity",
    });
  }

  if (!context.hasEnoughMarketData) {
    guardrails.push({
      id: "thin-price-history",
      category: "freshness",
      severity: "medium",
      title: "价格历史样本偏少",
      detail: "缓存价格历史不足 5 个交易日，结论只能作为初筛，不能作为下单前价格依据。",
      blocking: true,
      source: "market-data-cache",
    });
  }

  return guardrails;
}

export function evaluateSoftGuardrails(context: SecurityDecisionContext): SecurityGuardrail[] {
  const guardrails: SecurityGuardrail[] = [];

  if (context.heldWeightPct >= 15) {
    guardrails.push({
      id: "single-security-concentration",
      category: "duplicate-exposure",
      severity: "high",
      title: "单一标的权重偏高",
      detail: `${context.normalizedSymbol} 当前约占组合 ${formatPercent(context.heldWeightPct)}，新增前应先复核集中度和同类资产重复度。`,
      blocking: false,
      source: "portfolio-holdings",
    });
  }

  for (const blocker of context.preferenceFit.blockers) {
    guardrails.push({
      id: `preference-${guardrails.length + 1}`,
      category: "preference-conflict",
      severity: "medium",
      title: "偏好护栏",
      detail: blocker,
      blocking: false,
      source: "preference-factors-v2",
    });
  }

  if (
    context.identity.currency === "USD" &&
    context.profile.preferenceFactors.taxStrategy.usdFundingPath === "avoid"
  ) {
    guardrails.push({
      id: "usd-funding-avoid",
      category: "tax-account-mismatch",
      severity: "medium",
      title: "USD 路径需要复核",
      detail: "你的 USD 路径偏好为避免。买入前需要确认换汇、税务和账户位置是否值得。",
      blocking: false,
      source: "preference-factors-v2",
    });
  }

  if (
    context.profile.preferenceFactors.liquidity.liquidityNeed === "high" ||
    context.profile.preferenceFactors.liquidity.cashDuringUncertainty === "high"
  ) {
    guardrails.push({
      id: "liquidity-priority-high",
      category: "liquidity",
      severity: "medium",
      title: "现金流优先级较高",
      detail: "你设置了较高流动性/不确定期现金需求，新增买入前应确认不会挤压现金缓冲。",
      blocking: false,
      source: "preference-factors-v2",
    });
  }

  if (context.targetPct <= 0) {
    guardrails.push({
      id: "missing-target-sleeve",
      category: "portfolio-fit",
      severity: "medium",
      title: "目标配置缺口不明确",
      detail: `当前偏好里没有为 ${context.economicAssetClass} 设置明确目标，适合先补齐偏好或只作为观察项。`,
      blocking: false,
      source: "preference-profile",
    });
  }

  return guardrails;
}

export function evaluateSecurityGuardrails(context: SecurityDecisionContext) {
  const hard = evaluateHardGuardrails(context);
  const soft = evaluateSoftGuardrails(context);
  const guardrails = [...hard, ...soft];
  return {
    hard,
    soft,
    guardrails,
    blocked: hard.some((item) => item.blocking),
  };
}

