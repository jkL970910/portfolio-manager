import { apiSuccess } from "@/lib/backend/contracts";
import type {
  MarketSentimentRating,
  MarketPulseFgiLevel,
  MarketPulseQuadrant,
  MarketPulseVixLevel,
  MarketSentimentSnapshot,
} from "@/lib/backend/models";
import { getRepositories } from "@/lib/backend/repositories/factory";

export type MobileMarketSentimentData = {
  id: string;
  title: string;
  score: number;
  rating: MarketSentimentRating;
  ratingLabel: string;
  fgiScore: number;
  fgiLevel: MarketPulseFgiLevel;
  fgiLevelLabel: string;
  vixValue: number | null;
  vixLevel: MarketPulseVixLevel | null;
  vixLevelLabel: string;
  quadrant: MarketPulseQuadrant | null;
  quadrantLabel: string;
  strategyLabel: string;
  strategyDetail: string;
  buySignal: MarketSentimentSnapshot["buySignal"];
  buySignalLabel: string;
  summary: string;
  riskNote: string;
  asOf: string;
  freshnessLabel: string;
  sourceLabel: string;
  sourceMode: MarketSentimentSnapshot["sourceMode"];
  components: MarketSentimentSnapshot["components"];
};

const DEFAULT_PROVIDER = "derived-us-market-sentiment";
const DEFAULT_INDEX_NAME = "US Market Pulse";
const DEFAULT_TTL_MS = 12 * 60 * 60 * 1000;

function clampScore(value: number) {
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function getMarketSentimentRating(score: number): MarketSentimentRating {
  if (score <= 24) return "extreme-fear";
  if (score <= 44) return "fear";
  if (score <= 55) return "neutral";
  if (score <= 75) return "greed";
  return "extreme-greed";
}

function getBuySignal(rating: MarketSentimentRating) {
  switch (rating) {
    case "extreme-fear":
    case "fear":
      return "accumulate" as const;
    case "greed":
    case "extreme-greed":
      return "caution" as const;
    default:
      return "neutral" as const;
  }
}

export function getFgiLevel(score: number): MarketPulseFgiLevel {
  if (score <= 24) return "fear";
  if (score <= 75) return "neutral";
  return "greed";
}

export function getVixLevel(vixValue: number): MarketPulseVixLevel {
  if (vixValue < 15) return "low";
  if (vixValue <= 25) return "normal";
  return "high";
}

export function getMarketSentimentRatingLabel(rating: MarketSentimentRating) {
  switch (rating) {
    case "extreme-fear":
      return "极度恐惧";
    case "fear":
      return "恐惧";
    case "neutral":
      return "中性";
    case "greed":
      return "贪婪";
    case "extreme-greed":
      return "极度贪婪";
  }
}

function getBuySignalLabel(signal: MarketSentimentSnapshot["buySignal"]) {
  switch (signal) {
    case "accumulate":
      return "适合分批观察";
    case "caution":
      return "避免追高";
    case "neutral":
      return "按计划执行";
  }
}

function getFgiLevelLabel(level: MarketPulseFgiLevel) {
  switch (level) {
    case "fear":
      return "恐惧";
    case "neutral":
      return "中性";
    case "greed":
      return "贪婪";
  }
}

function getVixLevelLabel(level: MarketPulseVixLevel | null) {
  switch (level) {
    case "low":
      return "低波动";
    case "normal":
      return "中性波动";
    case "high":
      return "高波动";
    default:
      return "波动待确认";
  }
}

function getMarketPulseDecision(
  vixLevel: MarketPulseVixLevel,
  fgiLevel: MarketPulseFgiLevel,
): {
  quadrant: MarketPulseQuadrant;
  quadrantLabel: string;
  strategyLabel: string;
  strategyDetail: string;
} {
  const matrix: Record<
    MarketPulseVixLevel,
    Record<
      MarketPulseFgiLevel,
      {
        quadrant: MarketPulseQuadrant;
        quadrantLabel: string;
        strategyLabel: string;
        strategyDetail: string;
      }
    >
  > = {
    low: {
      fear: {
        quadrant: "A",
        quadrantLabel: "低波动恐惧",
        strategyLabel: "低位观察",
        strategyDetail:
          "情绪偏冷但波动不高，适合把长期候选放入观察或小额分批，不适合一次性重仓。",
      },
      neutral: {
        quadrant: "B",
        quadrantLabel: "低波动中性",
        strategyLabel: "健康定投",
        strategyDetail:
          "波动较低且情绪中性，按目标配置和现金计划执行，不需要过度择时。",
      },
      greed: {
        quadrant: "C",
        quadrantLabel: "低波动贪婪",
        strategyLabel: "谨慎追高",
        strategyDetail:
          "市场较热但波动暂低，符合目标缺口时可分批，避免因为上涨情绪一次性追高。",
      },
    },
    normal: {
      fear: {
        quadrant: "D",
        quadrantLabel: "中波动恐惧",
        strategyLabel: "分批布局",
        strategyDetail:
          "恐惧情绪出现但波动仍可控，长期目标缺口明显时可以分批，不要试图猜最低点。",
      },
      neutral: {
        quadrant: "E",
        quadrantLabel: "均衡震荡",
        strategyLabel: "中性定投",
        strategyDetail:
          "市场处在常规区间，今日买入主要看目标配置、偏好、账户和标的质量。",
      },
      greed: {
        quadrant: "F",
        quadrantLabel: "中波动贪婪",
        strategyLabel: "控制仓位",
        strategyDetail:
          "情绪偏热且波动正常，新增买入应控制仓位，优先补目标缺口而不是追热门。",
      },
    },
    high: {
      fear: {
        quadrant: "G",
        quadrantLabel: "高波动恐惧",
        strategyLabel: "小额分批",
        strategyDetail:
          "恐慌和高波动共振，可能出现机会，但需要更小仓位和更长分批节奏。",
      },
      neutral: {
        quadrant: "H",
        quadrantLabel: "高波动中性",
        strategyLabel: "等待确认",
        strategyDetail:
          "波动较高但情绪未极端，适合降低操作频率，等待价格和数据确认。",
      },
      greed: {
        quadrant: "I",
        quadrantLabel: "高波动贪婪",
        strategyLabel: "防追高",
        strategyDetail:
          "高波动叠加贪婪，短期回撤风险较高，除非目标缺口明显，否则优先控制风险。",
      },
    },
  };

  return matrix[vixLevel][fgiLevel];
}

function getSummary(rating: MarketSentimentRating, score: number) {
  const label = getMarketSentimentRatingLabel(rating);
  switch (rating) {
    case "extreme-fear":
      return `美股市场脉搏为${label}（${score}/100），恐慌较高，适合把长期候选放入分批观察。`;
    case "fear":
      return `美股市场脉搏为${label}（${score}/100），风险偏好偏弱，新增买入更适合分批而不是一次性重仓。`;
    case "neutral":
      return `美股市场脉搏为${label}（${score}/100），今日买入判断应主要看目标配置、偏好和标的质量。`;
    case "greed":
      return `美股市场脉搏为${label}（${score}/100），风险偏好偏热，新增买入需要更注意价格和仓位。`;
    case "extreme-greed":
      return `美股市场脉搏为${label}（${score}/100），追涨风险较高，除非目标缺口明显，否则更适合等待或小额分批。`;
  }
}

function getRiskNote(rating: MarketSentimentRating) {
  switch (rating) {
    case "extreme-fear":
    case "fear":
      return "恐惧指数不是自动买入信号；仍要确认现金需求、目标配置和标的基本面。";
    case "greed":
    case "extreme-greed":
      return "贪婪指数不是自动卖出信号；它主要提醒新增买入不要追高。";
    case "neutral":
      return "市场脉搏中性时，不应因为指数本身改变长期配置计划。";
  }
}

export function buildDerivedMarketSentimentSnapshot(
  now = new Date(),
): Omit<MarketSentimentSnapshot, "id" | "createdAt" | "updatedAt"> {
  const day = Math.floor(now.getTime() / 86_400_000);
  const momentum = clampScore(52 + Math.sin(day / 5) * 18);
  const volatility = clampScore(48 + Math.cos(day / 7) * 16);
  const credit = clampScore(50 + Math.sin(day / 11) * 12);
  const safeHaven = clampScore(50 + Math.cos(day / 13) * 10);
  const score = clampScore(
    momentum * 0.35 + volatility * 0.3 + credit * 0.2 + safeHaven * 0.15,
  );
  const rating = getMarketSentimentRating(score);
  const fgiLevel = getFgiLevel(score);
  const vixValue = Math.round((20 + Math.cos(day / 7) * 7) * 100) / 100;
  const vixLevel = getVixLevel(vixValue);
  const decision = getMarketPulseDecision(vixLevel, fgiLevel);
  const buySignal = getBuySignal(rating);
  const expiresAt = new Date(now.getTime() + DEFAULT_TTL_MS);

  return {
    provider: DEFAULT_PROVIDER,
    indexName: "US Market Pulse",
    score,
    rating,
    fgiScore: score,
    fgiLevel,
    vixValue,
    vixLevel,
    quadrant: decision.quadrant,
    quadrantLabel: decision.quadrantLabel,
    strategyLabel: decision.strategyLabel,
    strategyDetail: decision.strategyDetail,
    asOf: now.toISOString(),
    sourceMode: "derived",
    sourceUrl: null,
    components: [
      {
        id: "momentum",
        label: "市场动量",
        score: momentum,
        detail: "第一版用缓存/派生市场脉搏占位；后续可替换为 SPY 均线等真实组件。",
      },
      {
        id: "volatility",
        label: "VIX 波动率",
        score: volatility,
        detail: `当前 VIX 参考值 ${vixValue.toFixed(2)}，归类为${getVixLevelLabel(vixLevel)}。真实 VIX provider 接入后会替换。`,
      },
      {
        id: "credit-risk",
        label: "信用风险偏好",
        score: credit,
        detail: "第一版代表高收益债/信用风险偏好方向。",
      },
      {
        id: "safe-haven",
        label: "避险需求",
        score: safeHaven,
        detail: "第一版代表债券/黄金等避险需求方向。",
      },
    ],
    summary: `${getSummary(rating, score)} 当前矩阵为象限 ${decision.quadrant}：${decision.quadrantLabel}。`,
    buySignal,
    riskNote: `${decision.strategyDetail} ${getRiskNote(rating)}`,
    rawPayload: {
      providerVersion: "market-pulse-derived-v2",
      note: "Deterministic VIX + FGI matrix placeholder until CNN/VIX providers are enabled.",
    },
    expiresAt: expiresAt.toISOString(),
  };
}

export function mapMarketSentimentForMobile(
  snapshot: MarketSentimentSnapshot,
): MobileMarketSentimentData {
  return {
    id: snapshot.id,
    title: snapshot.indexName,
    score: snapshot.score,
    rating: snapshot.rating,
    ratingLabel: getMarketSentimentRatingLabel(snapshot.rating),
    fgiScore: snapshot.fgiScore,
    fgiLevel: snapshot.fgiLevel,
    fgiLevelLabel: getFgiLevelLabel(snapshot.fgiLevel),
    vixValue: snapshot.vixValue,
    vixLevel: snapshot.vixLevel,
    vixLevelLabel: getVixLevelLabel(snapshot.vixLevel),
    quadrant: snapshot.quadrant,
    quadrantLabel: snapshot.quadrantLabel ?? "矩阵待确认",
    strategyLabel: snapshot.strategyLabel,
    strategyDetail: snapshot.strategyDetail,
    buySignal: snapshot.buySignal,
    buySignalLabel: getBuySignalLabel(snapshot.buySignal),
    summary: snapshot.summary,
    riskNote: snapshot.riskNote,
    asOf: snapshot.asOf,
    freshnessLabel: `更新 ${snapshot.asOf.slice(0, 10)} · 过期 ${snapshot.expiresAt.slice(0, 10)}`,
    sourceLabel:
      snapshot.sourceMode === "derived"
        ? "派生市场脉搏"
        : snapshot.sourceMode === "cached-external"
          ? "缓存外部指数"
          : "手动市场脉搏",
    sourceMode: snapshot.sourceMode,
    components: snapshot.components,
  };
}

export async function getOrCreateLatestMarketSentiment(now = new Date()) {
  const repositories = getRepositories();
  const existing = await repositories.marketSentimentSnapshots.getLatest({
    now,
    provider: DEFAULT_PROVIDER,
    indexName: DEFAULT_INDEX_NAME,
  });
  if (existing) {
    return existing;
  }

  return repositories.marketSentimentSnapshots.create(
    buildDerivedMarketSentimentSnapshot(now),
  );
}

export async function getMobileMarketSentimentView() {
  const snapshot = await getOrCreateLatestMarketSentiment();
  return apiSuccess(mapMarketSentimentForMobile(snapshot), "database");
}
