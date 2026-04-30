import { z } from "zod";

import { apiSuccess } from "@/lib/backend/contracts";
import type { PreferenceFactors } from "@/lib/backend/models";
import type { PreferenceFactorsDraftRequestPayload } from "@/lib/backend/payload-schemas";
import {
  DEFAULT_PREFERENCE_FACTORS,
  normalizePreferenceFactors,
} from "@/lib/backend/preference-factors";
import {
  recordLooMinisterUsage,
  resolveLooMinisterSettings,
} from "@/lib/backend/loo-minister-settings";

const draftSchema = z.object({
  preferenceFactors: z.unknown(),
  summary: z.string().trim().min(1).max(600),
  rationale: z.array(z.string().trim().min(1).max(360)).max(8).default([]),
  assumptions: z.array(z.string().trim().min(1).max(360)).max(8).default([]),
});

function hasAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword.toLowerCase()));
}

function localDraft(input: PreferenceFactorsDraftRequestPayload) {
  const text = input.narrative.trim().toLowerCase();
  const base = normalizePreferenceFactors(
    input.currentPreferenceFactors ?? DEFAULT_PREFERENCE_FACTORS,
  );
  const preferredSectors = new Set(base.sectorTilts.preferredSectors);
  const avoidedSectors = new Set(base.sectorTilts.avoidedSectors);
  const styleTilts = new Set(base.sectorTilts.styleTilts);
  const themes = new Set(base.sectorTilts.thematicInterests);

  if (hasAny(text, ["科技", "tech", "technology", "ai", "人工智能"])) {
    preferredSectors.add("Technology");
    themes.add("AI infrastructure");
  }
  if (hasAny(text, ["能源", "energy", "oil", "gas"])) {
    preferredSectors.add("Energy");
  }
  if (hasAny(text, ["成长", "growth", "激进", "aggressive"])) {
    styleTilts.add("Growth");
  }
  if (hasAny(text, ["质量", "quality", "盈利", "profitability"])) {
    styleTilts.add("Quality");
  }
  if (hasAny(text, ["分红", "dividend", "income"])) {
    styleTilts.add("Dividend");
  }
  if (hasAny(text, ["不想碰烟草", "烟草", "tobacco"])) {
    avoidedSectors.add("Tobacco");
  }

  const wantsHome = hasAny(text, ["买房", "首付", "房子", "home", "house"]);
  const wantsTax = hasAny(text, ["税", "tax", "rrsp", "tfsa", "fhsa"]);
  const wantsUsd = hasAny(text, ["usd", "美元", "美股"]);
  const wantsLiquidity = hasAny(text, ["现金", "流动性", "应急", "liquidity", "cash"]);
  const aggressive = hasAny(text, ["激进", "aggressive", "高风险", "high risk"]);
  const conservative = hasAny(text, ["保守", "稳健", "conservative", "低风险"]);

  const preferenceFactors: PreferenceFactors = normalizePreferenceFactors({
    ...base,
    behavior: {
      ...base.behavior,
      riskCapacity: aggressive ? "high" : conservative ? "low" : base.behavior.riskCapacity,
      volatilityComfort: aggressive
        ? "high"
        : conservative
          ? "low"
          : base.behavior.volatilityComfort,
      concentrationTolerance: aggressive
        ? "high"
        : conservative
          ? "low"
          : base.behavior.concentrationTolerance,
      leverageAllowed: false,
      optionsAllowed: false,
      cryptoAllowed: base.behavior.cryptoAllowed && !conservative,
    },
    sectorTilts: {
      preferredSectors: [...preferredSectors],
      avoidedSectors: [...avoidedSectors],
      styleTilts: [...styleTilts],
      thematicInterests: [...themes],
    },
    lifeGoals: {
      ...base.lifeGoals,
      homePurchase: {
        enabled: wantsHome || base.lifeGoals.homePurchase.enabled,
        horizonYears: wantsHome ? (hasAny(text, ["两年", "2年", "2 years"]) ? 2 : 5) : base.lifeGoals.homePurchase.horizonYears,
        downPaymentTargetCad: wantsHome
          ? (base.lifeGoals.homePurchase.downPaymentTargetCad ?? 150000)
          : base.lifeGoals.homePurchase.downPaymentTargetCad,
        priority: wantsHome ? "high" : base.lifeGoals.homePurchase.priority,
      },
      emergencyFundTargetCad: wantsLiquidity
        ? (base.lifeGoals.emergencyFundTargetCad ?? 30000)
        : base.lifeGoals.emergencyFundTargetCad,
    },
    taxStrategy: {
      ...base.taxStrategy,
      rrspDeductionPriority: wantsTax ? "high" : base.taxStrategy.rrspDeductionPriority,
      tfsaGrowthPriority: aggressive ? "high" : base.taxStrategy.tfsaGrowthPriority,
      fhsaHomeGoalPriority: wantsHome ? "high" : base.taxStrategy.fhsaHomeGoalPriority,
      taxableTaxSensitivity: wantsTax ? "high" : base.taxStrategy.taxableTaxSensitivity,
      usdFundingPath: wantsUsd ? "available" : base.taxStrategy.usdFundingPath,
    },
    liquidity: {
      ...base.liquidity,
      liquidityNeed: wantsLiquidity || wantsHome ? "high" : base.liquidity.liquidityNeed,
      cashDuringUncertainty:
        wantsLiquidity || wantsHome ? "high" : base.liquidity.cashDuringUncertainty,
    },
  });

  return {
    preferenceFactors,
    summary: `大臣根据描述生成草稿：${preferenceFactors.behavior.riskCapacity === "high" ? "风险容量偏高" : preferenceFactors.behavior.riskCapacity === "low" ? "风险容量偏低" : "风险容量中等"}；偏好 ${preferenceFactors.sectorTilts.preferredSectors.slice(0, 3).join("、") || "暂无特定行业"}；${preferenceFactors.lifeGoals.homePurchase.enabled ? "包含买房目标" : "未开启买房目标"}。`,
    rationale: [
      aggressive
        ? "描述中出现激进/高风险倾向，因此提高风险容量和波动舒适度。"
        : conservative
          ? "描述中出现稳健/低风险倾向，因此降低风险容量和集中度容忍。"
          : "未检测到极端风险倾向，保留中性或现有风险设置。",
      preferredSectors.size > 0
        ? `识别到行业/主题倾向：${[...preferredSectors].join("、")}。`
        : "未识别到明确行业倾向。",
      wantsHome
        ? "识别到买房/首付目标，因此开启 FHSA/流动性相关参数。"
        : "未识别到明确买房目标。",
      wantsTax ? "识别到税务优化诉求，因此提高税务敏感度。" : "税务参数维持默认或现有设置。",
    ],
    assumptions: [
      "这是草稿，不会自动保存；需要用户确认。",
      "V2.1 只会轻量使用这些参数调整候选排序和解释。",
      "V3 才会进一步结合外部信息、真实税务和生活目标资金桶。",
    ],
    sourceMode: "local" as const,
    providerStatus: "local-deterministic",
  };
}

function extractOutputText(response: Record<string, unknown>) {
  if (typeof response.output_text === "string") return response.output_text;
  const output = response.output;
  if (!Array.isArray(output)) return null;
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const contentItem of content) {
      if (!contentItem || typeof contentItem !== "object") continue;
      const text = (contentItem as { text?: unknown }).text;
      if (typeof text === "string" && text.trim()) return text;
    }
  }
  return null;
}

function extractUsage(response: Record<string, unknown>) {
  const usage = response.usage;
  if (!usage || typeof usage !== "object") return {};
  const value = usage as Record<string, unknown>;
  return {
    inputTokens: typeof value.input_tokens === "number" ? value.input_tokens : null,
    outputTokens: typeof value.output_tokens === "number" ? value.output_tokens : null,
    totalTokens: typeof value.total_tokens === "number" ? value.total_tokens : null,
  };
}

async function externalDraft(
  input: PreferenceFactorsDraftRequestPayload,
  userId: string,
) {
  const settings = await resolveLooMinisterSettings(userId);
  if (
    settings.mode !== "gpt-5.5" ||
    !settings.providerEnabled ||
    !settings.apiKey
  ) {
    return null;
  }

  const response = await fetch(settings.endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${settings.apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "http://localhost:3000",
      "X-Title": "Loo Portfolio Manager",
    },
    body: JSON.stringify({
      model: settings.model,
      store:
        process.env.LOO_MINISTER_DISABLE_RESPONSE_STORAGE === "true"
          ? false
          : undefined,
      reasoning: { effort: settings.reasoningEffort },
      text:
        settings.provider === "openrouter-compatible"
          ? { format: { type: "json_object" } }
          : { verbosity: "low", format: { type: "json_object" } },
      input: [
        {
          role: "user",
          content: [
            "你是 Loo国大臣，任务是把用户的自然语言投资偏好转成 Preference Factors V2 草稿。",
            "只返回 JSON object，字段为 preferenceFactors, summary, rationale, assumptions。",
            "preferenceFactors 必须包含 behavior, sectorTilts, lifeGoals, taxStrategy, liquidity, externalInfo。",
            "不要返回投资建议；只做参数草稿。不要自动推荐具体买卖。",
            `当前参数：${JSON.stringify(input.currentPreferenceFactors ?? DEFAULT_PREFERENCE_FACTORS)}`,
            `用户描述：${input.narrative}`,
          ].join("\n"),
        },
      ],
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  if (!response.ok) {
    throw new Error(`Preference factor draft provider failed: ${response.status}`);
  }
  const outputText = extractOutputText(payload);
  if (!outputText) {
    throw new Error("Preference factor draft provider returned empty output.");
  }
  const parsed = draftSchema.parse(JSON.parse(outputText));
  const usage = extractUsage(payload);
  await recordLooMinisterUsage(userId, {
    page: "settings",
    mode: settings.mode,
    provider: `${settings.provider}-${settings.apiKeySource}`,
    model: settings.model,
    status: "success",
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    totalTokens: usage.totalTokens,
  });
  return {
    preferenceFactors: normalizePreferenceFactors(parsed.preferenceFactors),
    summary: parsed.summary,
    rationale: parsed.rationale,
    assumptions: parsed.assumptions,
    sourceMode: "gpt-5.5" as const,
    providerStatus: `${settings.provider}-${settings.apiKeySource}`,
  };
}

export async function createPreferenceFactorsDraft(
  userId: string,
  input: PreferenceFactorsDraftRequestPayload,
) {
  try {
    const external = await externalDraft(input, userId);
    if (external) {
      return apiSuccess(external, "service");
    }
  } catch (error) {
    await recordLooMinisterUsage(userId, {
      page: "settings",
      mode: "gpt-5.5",
      provider: "preference-factor-draft",
      model: "gpt-5.5",
      status: "fallback",
      errorMessage: error instanceof Error ? error.message.slice(0, 500) : String(error),
    });
  }

  return apiSuccess(localDraft(input), "service");
}
