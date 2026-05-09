import { apiSuccess } from "@/lib/backend/contracts";
import type {
  MarketSentimentRating,
  MarketPulseFgiLevel,
  MarketPulseQuadrant,
  MarketPulseVixLevel,
  MarketSentimentSnapshot,
} from "@/lib/backend/models";
import { getRepositories } from "@/lib/backend/repositories/factory";
import {
  getSecurityHistoricalSeries,
  getSecurityQuote,
} from "@/lib/market-data/service";

export type MobileMarketSentimentData = {
  id: string;
  title: string;
  score: number;
  rating: MarketSentimentRating;
  ratingLabel: string;
  fgiLabel: string;
  fgiSourceMode: "cnn" | "derived";
  fgiScore: number;
  fgiChange: number;
  fgiLevel: MarketPulseFgiLevel;
  fgiLevelLabel: string;
  vixValue: number | null;
  vixChange: number | null;
  vixLevel: MarketPulseVixLevel | null;
  vixLevelLabel: string;
  scoreChange: number;
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
  indexPerformances: MobileMarketIndexPerformanceData[];
  macroIndicators: MobileMarketPulseIndicatorData[];
};

export type MobileMarketIndexPerformanceData = {
  id: "dow" | "sp500" | "nasdaq";
  label: string;
  value: string;
  changePct: number | null;
  changeLabel: string;
  points: number[];
  sourceLabel: string;
};

export type MobileMarketPulseIndicatorData = {
  id: string;
  label: string;
  value: string;
  changeLabel: string;
  levelLabel: string;
  detail: string;
  sourceLabel: string;
  asOf: string;
  score: number | null;
};

const DEFAULT_PROVIDER = "loo-market-pulse-vix-live";
const DEFAULT_INDEX_NAME = "US Market Pulse";
const DEFAULT_TTL_MS = 12 * 60 * 60 * 1000;
const MARKET_INDEXES = [
  { id: "dow" as const, label: "道琼", symbol: "^DJI" },
  { id: "sp500" as const, label: "标普500", symbol: "^GSPC" },
  { id: "nasdaq" as const, label: "纳指", symbol: "^IXIC" },
];

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

function getDerivedMarketPulseInputs(now: Date) {
  const day = Math.floor(now.getTime() / 86_400_000);
  const momentum = clampScore(52 + Math.sin(day / 5) * 18);
  const volatility = clampScore(48 + Math.cos(day / 7) * 16);
  const credit = clampScore(50 + Math.sin(day / 11) * 12);
  const safeHaven = clampScore(50 + Math.cos(day / 13) * 10);
  const score = clampScore(
    momentum * 0.35 + volatility * 0.3 + credit * 0.2 + safeHaven * 0.15,
  );
  const fgiScore = clampScore(
    momentum * 0.55 + credit * 0.25 + safeHaven * 0.2,
  );
  const vixValue = Math.round((20 + Math.cos(day / 7) * 7) * 100) / 100;

  return {
    momentum,
    volatility,
    credit,
    safeHaven,
    score,
    fgiScore,
    vixValue,
  };
}

type LiveVixInput = {
  value: number;
  previousValue: number | null;
  asOf: string;
  provider: string;
  sourceLabel: string;
  points: number[];
};

type LiveFgiInput = {
  score: number;
  previousClose: number | null;
  asOf: string;
  provider: "cnn-fear-and-greed";
  sourceLabel: "CNN Fear & Greed";
  sourceUrl: string;
};

type LiveMarketPulseIndicatorInput = MobileMarketPulseIndicatorData & {
  componentScore?: number;
};

function formatSignedPercent(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "--";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function formatSignedBasisPoints(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "--";
  const basisPoints = value * 100;
  const sign = basisPoints > 0 ? "+" : "";
  return `${sign}${basisPoints.toFixed(0)} bp`;
}

function normalizeVixPressureScore(value: number | null) {
  if (value == null || !Number.isFinite(value)) return null;
  return clampScore(((value - 12) / 28) * 100);
}

function normalizeCreditPressureScore(value: number | null) {
  if (value == null || !Number.isFinite(value)) return null;
  return clampScore(((value - 2.5) / 5.5) * 100);
}

function normalizeRatePressureScore(value: number | null) {
  if (value == null || !Number.isFinite(value)) return null;
  return clampScore(((value - 3) / 2.5) * 100);
}

function getCreditPressureLevel(value: number) {
  if (value < 3.5) return "低压力";
  if (value < 5) return "正常偏紧";
  if (value < 7) return "风险升温";
  return "信用压力高";
}

function getRatePressureLevel(value: number) {
  if (value < 3.5) return "低利率压力";
  if (value < 4.25) return "中性";
  if (value < 5) return "估值承压";
  return "高利率压力";
}

function getRealRateLevel(value: number) {
  if (value < 1) return "实际利率低";
  if (value < 2) return "实际利率中性";
  return "实际利率偏高";
}

function getYieldCurveLevel(value: number) {
  if (value < -0.25) return "倒挂";
  if (value < 0.25) return "接近平坦";
  return "正斜率";
}

function toRiskOnScore(pressureScore: number | null) {
  return pressureScore == null ? null : 100 - pressureScore;
}

function weightedAverage(
  items: Array<{ score: number | null; weight: number }>,
  fallback: number,
) {
  const valid = items.filter(
    (item) => item.score != null && Number.isFinite(item.score),
  ) as Array<{ score: number; weight: number }>;
  const totalWeight = valid.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight <= 0) return fallback;
  return clampScore(
    valid.reduce((sum, item) => sum + item.score * item.weight, 0) /
      totalWeight,
  );
}

function isMarketPulseIndicator(
  value: unknown,
): value is MobileMarketPulseIndicatorData {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const item = value as Partial<MobileMarketPulseIndicatorData>;
  return (
    typeof item.id === "string" &&
    typeof item.label === "string" &&
    typeof item.value === "string" &&
    typeof item.changeLabel === "string" &&
    typeof item.levelLabel === "string" &&
    typeof item.detail === "string" &&
    typeof item.sourceLabel === "string" &&
    typeof item.asOf === "string" &&
    (typeof item.score === "number" || item.score === null)
  );
}

async function getLiveIndexPerformance(
  index: (typeof MARKET_INDEXES)[number],
): Promise<MobileMarketIndexPerformanceData | null> {
  const [quoteResponse, historyResponse] = await Promise.all([
    getSecurityQuote(index.symbol, { currency: "USD" }).catch(() => null),
    getSecurityHistoricalSeries(index.symbol, { currency: "USD" }).catch(
      () => ({ results: [] }),
    ),
  ]);
  const quote = quoteResponse?.result;
  const rawPoints = historyResponse.results
    .filter((point) => Number.isFinite(point.close) && point.close > 0)
    .slice(-7)
    .map((point) => point.close);
  const latest = quote && quote.price > 0 ? quote.price : rawPoints.at(-1);
  if (!latest || !Number.isFinite(latest) || latest <= 0) {
    return null;
  }
  const previous = rawPoints.length >= 2 ? rawPoints.at(-2) : null;
  const changePct =
    previous && previous > 0
      ? Math.round(((latest - previous) / previous) * 10_000) / 100
      : null;
  const points = [...rawPoints.slice(0, -1), latest].slice(-7);

  return {
    id: index.id,
    label: index.label,
    value: latest.toLocaleString("en-US", {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    }),
    changePct,
    changeLabel: formatSignedPercent(changePct),
    points,
    sourceLabel:
      quote?.provider === "yahoo-finance" ? "Yahoo Finance" : "行情缓存",
  };
}

async function getFredLatest(seriesId: string): Promise<{
  value: number;
  previousValue: number | null;
  date: string;
} | null> {
  const response = await fetch(
    `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${encodeURIComponent(seriesId)}`,
    {
      cache: "no-store",
      headers: {
        Accept: "text/csv,*/*;q=0.8",
        "User-Agent":
          "Mozilla/5.0 (compatible; PortfolioManager/1.0; +https://localhost)",
      },
    },
  ).catch(() => null);
  if (!response?.ok) return null;
  const csv = await response.text().catch(() => "");
  const rows = csv
    .trim()
    .split(/\r?\n/)
    .slice(1)
    .map((line) => {
      const [date, rawValue] = line.split(",");
      const value = Number(rawValue);
      return { date, value };
    })
    .filter(
      (row) =>
        row.date &&
        Number.isFinite(row.value) &&
        row.value > -100 &&
        row.value < 1000,
    );
  const latest = rows.at(-1);
  if (!latest) return null;
  return {
    value: latest.value,
    previousValue: rows.at(-2)?.value ?? null,
    date: latest.date,
  };
}

async function getFredPercentIndicator(input: {
  id: string;
  label: string;
  seriesId: string;
  detail: string;
  level: (value: number) => string;
  score?: (value: number) => number | null;
}): Promise<LiveMarketPulseIndicatorInput | null> {
  const latest = await getFredLatest(input.seriesId);
  if (!latest) return null;
  const change =
    latest.previousValue == null ? null : latest.value - latest.previousValue;
  const score = input.score?.(latest.value) ?? null;
  return {
    id: input.id,
    label: input.label,
    value: `${latest.value.toFixed(2)}%`,
    changeLabel: formatSignedBasisPoints(change),
    levelLabel: input.level(latest.value),
    detail: input.detail,
    sourceLabel: `FRED ${input.seriesId}`,
    asOf: latest.date,
    score,
    componentScore: score ?? undefined,
  };
}

async function getMarketEtfIndicator(input: {
  id: string;
  label: string;
  symbol: string;
  detail: string;
}): Promise<LiveMarketPulseIndicatorInput | null> {
  const [quoteResponse, historyResponse] = await Promise.all([
    getSecurityQuote(input.symbol, { currency: "USD" }).catch(() => null),
    getSecurityHistoricalSeries(input.symbol, { currency: "USD" }).catch(
      () => ({ results: [] }),
    ),
  ]);
  const quote = quoteResponse?.result;
  if (!quote || quote.provider === "fallback" || quote.price <= 0) return null;
  const points = historyResponse.results
    .filter((point) => Number.isFinite(point.close) && point.close > 0)
    .sort((left, right) => left.date.localeCompare(right.date))
    .map((point) => point.close);
  const previous = points.at(-2) ?? points.at(-1) ?? null;
  const changePct =
    previous && previous > 0
      ? Math.round(((quote.price - previous) / previous) * 10_000) / 100
      : null;

  return {
    id: input.id,
    label: input.label,
    value: quote.price.toLocaleString("en-US", {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    }),
    changeLabel: formatSignedPercent(changePct),
    levelLabel: input.symbol,
    detail: input.detail,
    sourceLabel:
      quote.provider === "yahoo-finance" ? "Yahoo Finance" : quote.provider,
    asOf: quote.timestamp.slice(0, 10),
    score: null,
  };
}

async function getLiveMarketPulseIndicators(): Promise<
  LiveMarketPulseIndicatorInput[]
> {
  const results = await Promise.allSettled([
    getFredPercentIndicator({
      id: "credit-pressure",
      label: "信用压力",
      seriesId: "BAMLH0A0HYM2",
      level: getCreditPressureLevel,
      score: normalizeCreditPressureScore,
      detail: "高收益债利差；扩大代表信用风险和经济压力上升。",
    }),
    getFredPercentIndicator({
      id: "rate-pressure",
      label: "利率压力",
      seriesId: "DGS10",
      level: getRatePressureLevel,
      score: normalizeRatePressureScore,
      detail: "美国10年期国债收益率；偏高时成长股和房贷计划更承压。",
    }),
    getFredPercentIndicator({
      id: "real-rate",
      label: "实际利率",
      seriesId: "DFII10",
      level: getRealRateLevel,
      detail: "10年期通胀保值国债实际收益率；衡量真实贴现率压力。",
    }),
    getFredPercentIndicator({
      id: "yield-curve",
      label: "收益率曲线",
      seriesId: "T10Y2Y",
      level: getYieldCurveLevel,
      detail: "10年-2年美债利差；倒挂或平坦常代表增长预期偏弱。",
    }),
    getMarketEtfIndicator({
      id: "hyg",
      label: "高收益债ETF",
      symbol: "HYG",
      detail: "信用风险资产代理；上涨通常代表风险偏好改善。",
    }),
    getMarketEtfIndicator({
      id: "lqd",
      label: "投资级债ETF",
      symbol: "LQD",
      detail: "高质量信用债代理；用于观察信用和利率共同影响。",
    }),
    getMarketEtfIndicator({
      id: "tlt",
      label: "长期美债ETF",
      symbol: "TLT",
      detail: "长久期美债代理；上涨通常代表利率下行或避险需求增加。",
    }),
    getMarketEtfIndicator({
      id: "gld",
      label: "黄金ETF",
      symbol: "GLD",
      detail: "黄金避险/实际利率敏感资产代理。",
    }),
    getMarketEtfIndicator({
      id: "uup",
      label: "美元ETF",
      symbol: "UUP",
      detail: "美元强弱代理；美元走强会影响非美资产和商品。",
    }),
  ]);
  return results.flatMap((result) =>
    result.status === "fulfilled" && result.value ? [result.value] : [],
  );
}

async function getLiveVixInput(): Promise<LiveVixInput | null> {
  const [quoteResponse, historyResponse] = await Promise.all([
    getSecurityQuote("^VIX", { currency: "USD" }).catch(() => null),
    getSecurityHistoricalSeries("^VIX", { currency: "USD" }).catch(() => ({
      results: [],
    })),
  ]);
  const quote = quoteResponse?.result;
  if (!quote || quote.provider === "fallback" || quote.price <= 0) {
    return null;
  }

  const points = historyResponse.results
    .filter((point) => Number.isFinite(point.close) && point.close > 0)
    .sort((left, right) => left.date.localeCompare(right.date))
    .map((point) => point.close);
  const lastHistoryPoint = points.at(-1) ?? null;
  const previousValue =
    lastHistoryPoint != null &&
    Math.abs(lastHistoryPoint - quote.price) / quote.price > 0.001
      ? lastHistoryPoint
      : (points.at(-2) ?? null);

  return {
    value: Math.round(quote.price * 100) / 100,
    previousValue:
      previousValue == null ? null : Math.round(previousValue * 100) / 100,
    asOf: quote.timestamp,
    provider: quote.provider,
    sourceLabel:
      quote.provider === "yahoo-finance" ? "Yahoo Finance" : quote.provider,
    points: [...points.slice(0, -1), quote.price].slice(-30),
  };
}

type CnnFearGreedPayload = {
  fear_and_greed?: {
    score?: unknown;
    previous_close?: unknown;
    timestamp?: unknown;
  };
};

const CNN_FGI_PAGE_URL = "https://www.cnn.com/markets/fear-and-greed";
const CNN_FGI_GRAPH_URL =
  "https://production.dataviz.cnn.io/index/fearandgreed/graphdata";
const CNN_FGI_HEADERS = {
  Accept: "application/json,text/plain,*/*",
  "Accept-Language": "en-US,en;q=0.9",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
};

export function parseCnnFgiPayload(
  payload: CnnFearGreedPayload,
): LiveFgiInput | null {
  const source = payload.fear_and_greed;
  const rawScore = Number(source?.score);
  if (!Number.isFinite(rawScore) || rawScore < 0 || rawScore > 100) {
    return null;
  }
  const rawPreviousClose = Number(source?.previous_close);
  const timestamp =
    typeof source?.timestamp === "string" && source.timestamp
      ? source.timestamp
      : new Date().toISOString();

  return {
    score: clampScore(rawScore),
    previousClose:
      Number.isFinite(rawPreviousClose) &&
      rawPreviousClose >= 0 &&
      rawPreviousClose <= 100
        ? clampScore(rawPreviousClose)
        : null,
    asOf: new Date(timestamp).toISOString(),
    provider: "cnn-fear-and-greed",
    sourceLabel: "CNN Fear & Greed",
    sourceUrl: CNN_FGI_PAGE_URL,
  };
}

export async function getLiveCnnFgiInput(): Promise<LiveFgiInput | null> {
  const pageResponse = await fetch(CNN_FGI_PAGE_URL, {
    cache: "no-store",
    headers: {
      ...CNN_FGI_HEADERS,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  }).catch(() => null);
  if (!pageResponse?.ok) {
    return null;
  }

  const cookies =
    typeof pageResponse.headers.getSetCookie === "function"
      ? pageResponse.headers.getSetCookie().join("; ")
      : (pageResponse.headers.get("set-cookie") ?? "");
  const graphResponse = await fetch(CNN_FGI_GRAPH_URL, {
    cache: "no-store",
    headers: {
      ...CNN_FGI_HEADERS,
      Cookie: cookies,
      Origin: "https://www.cnn.com",
      Referer: CNN_FGI_PAGE_URL,
      "Sec-Fetch-Dest": "empty",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Site": "same-site",
    },
  }).catch(() => null);
  if (!graphResponse?.ok) {
    return null;
  }
  const payload = (await graphResponse
    .json()
    .catch(() => null)) as CnnFearGreedPayload | null;
  return payload ? parseCnnFgiPayload(payload) : null;
}

async function getMarketIndexPerformances(
  snapshot: MarketSentimentSnapshot,
): Promise<MobileMarketIndexPerformanceData[]> {
  void snapshot;
  const liveResults = await Promise.allSettled(
    MARKET_INDEXES.map((index) => getLiveIndexPerformance(index)),
  );
  return liveResults.flatMap((result) =>
    result.status === "fulfilled" && result.value ? [result.value] : [],
  );
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
  options?: {
    liveVix?: LiveVixInput | null;
    liveFgi?: LiveFgiInput | null;
    liveIndicators?: LiveMarketPulseIndicatorInput[];
    provider?: string;
  },
): Omit<MarketSentimentSnapshot, "id" | "createdAt" | "updatedAt"> {
  const derivedInputs = getDerivedMarketPulseInputs(now);
  const { momentum, volatility, fgiScore } = derivedInputs;
  const liveVix = options?.liveVix ?? null;
  const liveFgi = options?.liveFgi ?? null;
  const liveIndicators = options?.liveIndicators ?? [];
  const creditPressure =
    liveIndicators.find((item) => item.id === "credit-pressure") ?? null;
  const ratePressure =
    liveIndicators.find((item) => item.id === "rate-pressure") ?? null;
  const effectiveFgiScore = liveFgi?.score ?? fgiScore;
  const vixValue = liveVix?.value ?? derivedInputs.vixValue;
  const vixPressureScore = normalizeVixPressureScore(vixValue);
  const score = weightedAverage(
    [
      { score: liveFgi?.score ?? null, weight: 0.4 },
      { score: toRiskOnScore(vixPressureScore), weight: 0.25 },
      { score: toRiskOnScore(creditPressure?.score ?? null), weight: 0.2 },
      { score: toRiskOnScore(ratePressure?.score ?? null), weight: 0.15 },
    ],
    derivedInputs.score,
  );
  const rating = getMarketSentimentRating(score);
  const fgiLevel = getFgiLevel(effectiveFgiScore);
  const vixLevel = getVixLevel(vixValue);
  const decision = getMarketPulseDecision(vixLevel, fgiLevel);
  const buySignal = getBuySignal(rating);
  const expiresAt = new Date(now.getTime() + DEFAULT_TTL_MS);

  return {
    provider:
      options?.provider ??
      (liveVix ? DEFAULT_PROVIDER : "derived-us-market-sentiment"),
    indexName: "US Market Pulse",
    score,
    rating,
    fgiScore: effectiveFgiScore,
    fgiLevel,
    vixValue,
    vixLevel,
    quadrant: decision.quadrant,
    quadrantLabel: decision.quadrantLabel,
    strategyLabel: decision.strategyLabel,
    strategyDetail: decision.strategyDetail,
    asOf: now.toISOString(),
    sourceMode: liveVix ? "cached-external" : "derived",
    sourceUrl: liveVix ? "https://finance.yahoo.com/quote/%5EVIX" : null,
    components: [
      {
        id: "momentum",
        label: liveFgi ? "CNN FGI" : "Loo 情绪分",
        score: liveFgi ? effectiveFgiScore : momentum,
        detail: liveFgi
          ? `CNN Fear & Greed 当前 ${effectiveFgiScore}/100，归类为${getFgiLevelLabel(fgiLevel)}。`
          : "CNN FGI 暂不可用时使用 Loo 派生情绪分，不伪装成官方指数。",
      },
      {
        id: "volatility",
        label: "VIX 波动率",
        score: vixPressureScore ?? volatility,
        detail: liveVix
          ? `真实 VIX ${vixValue.toFixed(2)}，来源 ${liveVix.sourceLabel}，归类为${getVixLevelLabel(vixLevel)}。`
          : `当前 VIX 参考值 ${vixValue.toFixed(2)}，归类为${getVixLevelLabel(vixLevel)}。真实 VIX provider 暂不可用时使用派生值。`,
      },
      ...(creditPressure?.score != null
        ? [
            {
              id: "credit-pressure",
              label: "信用压力",
              score: creditPressure.score,
              detail: `${creditPressure.value}，${creditPressure.levelLabel}。${creditPressure.detail}`,
            },
          ]
        : []),
      ...(ratePressure?.score != null
        ? [
            {
              id: "rate-pressure",
              label: "利率压力",
              score: ratePressure.score,
              detail: `${ratePressure.value}，${ratePressure.levelLabel}。${ratePressure.detail}`,
            },
          ]
        : []),
    ],
    summary: `${getSummary(rating, score)} 当前矩阵为象限 ${decision.quadrant}：${decision.quadrantLabel}。`,
    buySignal,
    riskNote: `${decision.strategyDetail} ${getRiskNote(rating)}`,
    rawPayload: {
      providerVersion: liveVix
        ? "market-pulse-vix-live-v1"
        : "market-pulse-derived-v2",
      vix: liveVix
        ? {
            sourceMode: "cached-external",
            provider: liveVix.provider,
            sourceLabel: liveVix.sourceLabel,
            asOf: liveVix.asOf,
            value: liveVix.value,
            previousValue: liveVix.previousValue,
            pointCount: liveVix.points.length,
          }
        : {
            sourceMode: "derived",
            provider: "derived-us-market-sentiment",
            value: vixValue,
          },
      fgi: {
        sourceMode: liveFgi ? "cached-external" : "derived",
        provider: liveFgi?.provider ?? "loo-derived-fgi",
        sourceLabel: liveFgi?.sourceLabel ?? "Loo 情绪分",
        sourceUrl: liveFgi?.sourceUrl ?? null,
        asOf: liveFgi?.asOf ?? null,
        score: effectiveFgiScore,
        previousClose: liveFgi?.previousClose ?? null,
        note: liveFgi
          ? "CNN Fear & Greed score was cached by the market-sentiment worker."
          : "FGI remains a Loo-derived sentiment score until a stable FGI provider is enabled.",
      },
      macroIndicators: liveIndicators,
    },
    expiresAt: expiresAt.toISOString(),
  };
}

export function mapMarketSentimentForMobile(
  snapshot: MarketSentimentSnapshot,
): MobileMarketSentimentData {
  const previous = getDerivedMarketPulseInputs(
    new Date(new Date(snapshot.asOf).getTime() - 86_400_000),
  );
  const rawPayload =
    snapshot.rawPayload &&
    typeof snapshot.rawPayload === "object" &&
    !Array.isArray(snapshot.rawPayload)
      ? (snapshot.rawPayload as {
          vix?: { previousValue?: unknown; sourceLabel?: unknown };
          fgi?: {
            sourceMode?: unknown;
            sourceLabel?: unknown;
            previousClose?: unknown;
          };
          macroIndicators?: unknown;
        })
      : null;
  const vixPreviousValue =
    typeof rawPayload?.vix?.previousValue === "number"
      ? rawPayload.vix.previousValue
      : null;
  const vixSourceLabel =
    typeof rawPayload?.vix?.sourceLabel === "string"
      ? rawPayload.vix.sourceLabel
      : null;
  const fgiSourceMode =
    rawPayload?.fgi?.sourceMode === "cached-external" ? "cnn" : "derived";
  const fgiPreviousClose =
    typeof rawPayload?.fgi?.previousClose === "number"
      ? rawPayload.fgi.previousClose
      : null;
  return {
    id: snapshot.id,
    title: snapshot.indexName,
    score: snapshot.score,
    rating: snapshot.rating,
    ratingLabel: getMarketSentimentRatingLabel(snapshot.rating),
    fgiLabel: fgiSourceMode === "cnn" ? "CNN FGI" : "Loo 情绪分",
    fgiSourceMode,
    fgiScore: snapshot.fgiScore,
    fgiChange:
      fgiPreviousClose != null
        ? Math.round((snapshot.fgiScore - fgiPreviousClose) * 100) / 100
        : snapshot.fgiScore - previous.fgiScore,
    fgiLevel: snapshot.fgiLevel,
    fgiLevelLabel: getFgiLevelLabel(snapshot.fgiLevel),
    vixValue: snapshot.vixValue,
    vixChange:
      snapshot.vixValue == null
        ? null
        : vixPreviousValue != null
          ? Math.round((snapshot.vixValue - vixPreviousValue) * 100) / 100
          : Math.round((snapshot.vixValue - previous.vixValue) * 100) / 100,
    vixLevel: snapshot.vixLevel,
    vixLevelLabel: getVixLevelLabel(snapshot.vixLevel),
    scoreChange: snapshot.score - previous.score,
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
          ? vixSourceLabel
            ? `真实 VIX · ${vixSourceLabel}`
            : "缓存外部指数"
          : "手动市场脉搏",
    sourceMode: snapshot.sourceMode,
    components: snapshot.components,
    indexPerformances: [],
    macroIndicators: Array.isArray(rawPayload?.macroIndicators)
      ? rawPayload.macroIndicators.flatMap((item) =>
          isMarketPulseIndicator(item) ? [item] : [],
        )
      : [],
  };
}

export async function mapMarketSentimentForMobileWithIndexes(
  snapshot: MarketSentimentSnapshot,
): Promise<MobileMarketSentimentData> {
  return {
    ...mapMarketSentimentForMobile(snapshot),
    indexPerformances: await getMarketIndexPerformances(snapshot),
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

  const [liveVix, liveFgi, liveIndicators] = await Promise.all([
    getLiveVixInput(),
    getLiveCnnFgiInput(),
    getLiveMarketPulseIndicators(),
  ]);
  return repositories.marketSentimentSnapshots.create(
    buildDerivedMarketSentimentSnapshot(now, {
      liveVix,
      liveFgi,
      liveIndicators,
      provider: DEFAULT_PROVIDER,
    }),
  );
}

export async function refreshMarketSentimentSnapshot(now = new Date()) {
  const repositories = getRepositories();
  const [liveVix, liveFgi, liveIndicators] = await Promise.all([
    getLiveVixInput(),
    getLiveCnnFgiInput(),
    getLiveMarketPulseIndicators(),
  ]);
  return repositories.marketSentimentSnapshots.create(
    buildDerivedMarketSentimentSnapshot(now, {
      liveVix,
      liveFgi,
      liveIndicators,
      provider: DEFAULT_PROVIDER,
    }),
  );
}

export async function getMobileMarketSentimentView() {
  const snapshot = await getOrCreateLatestMarketSentiment();
  return apiSuccess(
    await mapMarketSentimentForMobileWithIndexes(snapshot),
    "database",
  );
}
