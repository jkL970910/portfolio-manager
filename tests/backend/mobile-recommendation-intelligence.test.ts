import assert from "node:assert/strict";
import test from "node:test";
import type { RecommendationsData } from "@/lib/contracts";
import {
  buildRecommendationV3Overlay,
  mapRecommendationIntelligenceRefs,
} from "@/lib/backend/mobile-views";

function brief(
  id: string,
  symbol: string,
  exchange: string,
  currency: string,
  securityId?: string,
): RecommendationsData["intelligenceBriefs"][number] {
  return {
    id,
    title: `${symbol} cached brief`,
    detail: "Cached context",
    sourceLabel: "缓存外部情报",
    sourceMode: "cached-external",
    freshnessLabel: "行情 2026-04-30",
    generatedAt: "2026-04-30T12:00:00.000Z",
    symbols: [symbol, exchange, currency],
    identity: { securityId, symbol, exchange, currency },
    sources: [],
  };
}

function priority(
  overrides: Partial<RecommendationsData["priorities"][number]> = {},
): RecommendationsData["priorities"][number] {
  return {
    id: "priority_us_equity",
    assetClass: "US Equity",
    description: "补足 US Equity 缺口",
    amount: "CA$2,500",
    account: "RRSP",
    security: "VFV - Vanguard S&P 500",
    securityId: "sec_vfv_cad",
    securitySymbol: "VFV",
    securityExchange: "TSX",
    securityCurrency: "CAD",
    tickers: "VFV, XUU",
    accountFit: "RRSP 顺手",
    scoreline: "",
    gapSummary: "",
    alternatives: [],
    intelligenceRefs: [],
    whyThis: [],
    whyNot: [],
    constraints: [],
    execution: [],
    v3Overlay: {
      baselineScore: 74,
      externalInsightScore: null,
      preferenceFitScore: 82,
      finalScore: 75.2,
      confidenceLabel: "V2.1 规则评分，等待缓存外部情报校准",
      sourceMode: "local",
      signals: ["行业/风格偏好命中"],
      riskFlags: [],
      explanation: "base",
    },
    ...overrides,
  };
}

test("recommendation intelligence refs prefer exact security identity matches", () => {
  const refs = mapRecommendationIntelligenceRefs(
    {
      security: "NVDA - NVIDIA",
      securityId: "sec_nvda_us",
      securitySymbol: "NVDA",
      securityExchange: "NASDAQ",
      securityCurrency: "USD",
      tickers: "NVDA, VOO",
    },
    [
      brief("brief_nvda_us", "NVDA", "NASDAQ", "USD", "sec_nvda_us"),
      brief("brief_nvda_cad", "NVDA", "NEO", "CAD", "sec_nvda_cad"),
    ],
  );

  assert.equal(refs.length, 1);
  assert.equal(refs[0]?.id, "brief_nvda_us");
  assert.equal(refs[0]?.scope, "listing");
  assert.equal(refs[0]?.listingLabel, "NVDA · NASDAQ · USD");
});

test("recommendation intelligence refs use underlying context when identity is unresolved", () => {
  const refs = mapRecommendationIntelligenceRefs(
    {
      security: "AMZN - Amazon",
      securitySymbol: "AMZN",
      tickers: "AMZN",
    },
    [
      brief("brief_amzn_us", "AMZN", "NASDAQ", "USD", "sec_amzn_us"),
      brief("brief_amzn_cad", "AMZN", "NEO", "CAD", "sec_amzn_cad"),
    ],
  );

  assert.equal(refs.length, 2);
  assert.equal(refs[0]?.scope, "underlying");
  assert.equal(refs[0]?.scopeLabel, "底层资产情报");
  assert.equal(refs[1]?.scope, "underlying");
});

test("recommendation intelligence refs can fall back to exact listing identity", () => {
  const refs = mapRecommendationIntelligenceRefs(
    {
      security: "VFV - Vanguard S&P 500",
      securitySymbol: "VFV",
      securityExchange: "TSX",
      securityCurrency: "CAD",
      tickers: "VFV",
    },
    [
      brief("brief_vfv_cad", "VFV", "TSX", "CAD"),
      brief("brief_vfv_us", "VFV", "NYSE", "USD"),
    ],
  );

  assert.equal(refs.length, 1);
  assert.equal(refs[0]?.id, "brief_vfv_cad");
  assert.equal(refs[0]?.scope, "listing");
});

test("recommendation V3 overlay weights cached external intelligence explicitly", () => {
  const briefs = [
    brief("brief_vfv_cad", "VFV", "TSX", "CAD", "sec_vfv_cad"),
  ];
  const refs = mapRecommendationIntelligenceRefs(priority(), briefs);
  const overlay = buildRecommendationV3Overlay(priority(), refs, briefs);

  assert.ok(overlay);
  assert.equal(overlay.sourceMode, "cached-external");
  assert.ok(overlay.externalInsightScore !== null);
  assert.ok(overlay.externalInsightScore > 0);
  assert.ok(overlay.finalScore > 0);
  assert.match(overlay.explanation, /V3 最终分/);
  assert.ok(overlay.signals.some((signal) => signal.includes("当前 listing")));
});

test("recommendation V3 overlay uses persisted document evidence scores", () => {
  const documentBrief: RecommendationsData["intelligenceBriefs"][number] = {
    ...brief("doc_xbb_cad", "XBB", "TSX", "CAD", "sec_xbb_cad"),
    generatedAt: new Date().toISOString(),
    confidence: "high",
    relevanceScore: 78,
    sourceReliability: 82,
    riskFlags: ["缓存行情仍需要人工复核"],
  };
  const candidate = priority({
    security: "XBB - iShares Core Canadian Universe Bond Index ETF",
    securityId: "sec_xbb_cad",
    securitySymbol: "XBB",
    securityExchange: "TSX",
    securityCurrency: "CAD",
    tickers: "XBB",
    v3Overlay: {
      baselineScore: 66,
      externalInsightScore: null,
      preferenceFitScore: 70,
      finalScore: 67,
      confidenceLabel: "V2.1 规则评分，等待缓存外部情报校准",
      sourceMode: "local",
      signals: [],
      riskFlags: [],
      explanation: "base",
    },
  });
  const refs = mapRecommendationIntelligenceRefs(candidate, [documentBrief]);
  const overlay = buildRecommendationV3Overlay(candidate, refs, [documentBrief]);

  assert.ok(overlay);
  assert.equal(overlay.externalInsightScore, 81.6);
  assert.equal(overlay.finalScore, 68.9);
  assert.ok(
    overlay.riskFlags.some((flag) => flag.includes("缓存行情仍需要人工复核")),
  );
});

test("recommendation V3 overlay keeps metadata uncertainty visible before live intelligence", () => {
  const candidate = priority({
    v3Overlay: {
      baselineScore: 66,
      externalInsightScore: null,
      preferenceFitScore: 70,
      finalScore: 67,
      confidenceLabel: "V2.1 规则评分，等待缓存外部情报校准",
      sourceMode: "local",
      signals: [],
      riskFlags: ["标的属性仍是低置信推断，真实 ETF/company metadata 接入后需要复核。"],
      explanation: "base",
    },
  });
  const overlay = buildRecommendationV3Overlay(candidate, [], []);

  assert.ok(overlay);
  assert.ok(
    overlay.riskFlags.some((flag) => flag.includes("低置信推断")),
  );
  assert.equal(overlay.sourceMode, "local");
});
