import assert from "node:assert/strict";
import test from "node:test";
import {
  getMobileDailyIntelligenceView,
  mapDailyIntelligenceItemToRecommendationBrief,
  mapExternalResearchDocumentForDailyIntelligence,
} from "@/lib/backend/mobile-daily-intelligence";
import { mockRepositories } from "@/lib/backend/repositories/mock-repositories";

test("daily intelligence maps persisted research documents into mobile-safe cards", async () => {
  const now = new Date("2026-04-30T15:00:00.000Z");
  const document = await mockRepositories.externalResearchDocuments.create({
    userId: "daily_intel_user_1",
    providerDocumentId: "doc_vfv_market_1",
    sourceType: "market-data",
    providerId: "market-data",
    sourceName: "本地缓存行情",
    title: "VFV listing 缓存行情快照",
    summary: "VFV TSX CAD 的缓存行情可用。",
    url: null,
    publishedAt: "2026-04-30T00:00:00.000Z",
    capturedAt: now.toISOString(),
    expiresAt: "2099-05-01T15:00:00.000Z",
    language: "zh",
    security: {
      securityId: "sec_vfv_cad",
      symbol: "VFV",
      exchange: "TSX",
      currency: "CAD",
      name: "Vanguard S&P 500 Index ETF",
      provider: "market-data",
      securityType: "ETF",
    },
    underlyingId: null,
    confidence: "high",
    sentiment: "neutral",
    relevanceScore: 78,
    sourceReliability: 82,
    keyPoints: ["最近缓存收盘价可用。"],
    riskFlags: ["缓存行情仍需人工复核。"],
    tags: ["market-data", "listing-identity"],
    rawPayload: {},
  });

  const item = mapExternalResearchDocumentForDailyIntelligence(document);

  assert.equal(item.sourceLabel, "缓存行情情报");
  assert.equal(item.identity.securityId, "sec_vfv_cad");
  assert.equal(item.identity.symbol, "VFV");
  assert.equal(item.identity.exchange, "TSX");
  assert.equal(item.identity.currency, "CAD");
  assert.ok(item.actions.some((action) => action.type === "view-security"));

  const brief = mapDailyIntelligenceItemToRecommendationBrief(item);
  assert.equal(brief.identity.securityId, "sec_vfv_cad");
  assert.equal(brief.confidence, "high");
  assert.equal(brief.relevanceScore, 78);
  assert.equal(brief.sourceReliability, 82);
});

test("daily intelligence maps profile documents into institutional cards", async () => {
  const now = new Date("2026-05-03T18:00:00.000Z");
  const document = await mockRepositories.externalResearchDocuments.create({
    userId: "daily_intel_profile_user",
    providerDocumentId: "alpha-vantage-profile:RKLB:NASDAQ:USD",
    sourceType: "institutional",
    providerId: "alpha-vantage-profile",
    sourceName: "Alpha Vantage 标的资料",
    title: "Rocket Lab USA Inc. 基本资料快照",
    summary: "资产类型：Common Stock；行业板块：Technology；地区：USA。",
    url: null,
    publishedAt: "2026-03-31T00:00:00.000Z",
    capturedAt: now.toISOString(),
    expiresAt: "2099-05-04T18:00:00.000Z",
    language: "zh",
    security: {
      securityId: "sec_rklb_us",
      symbol: "RKLB",
      exchange: "NASDAQ",
      currency: "USD",
      name: "Rocket Lab USA Inc.",
      provider: "alpha-vantage-profile",
      securityType: "Common Stock",
    },
    underlyingId: null,
    confidence: "high",
    sentiment: "neutral",
    relevanceScore: 78,
    sourceReliability: 76,
    keyPoints: ["资产类型：Common Stock", "行业板块：Technology", "地区：USA"],
    riskFlags: ["OVERVIEW 只提供公司基本资料快照，不代表实时买卖建议。"],
    tags: ["profile", "alpha-vantage", "company-overview"],
    rawPayload: {},
  });

  const item = mapExternalResearchDocumentForDailyIntelligence(document);

  assert.equal(item.sourceLabel, "缓存机构资料");
  assert.equal(item.identity.securityId, "sec_rklb_us");
  assert.equal(item.identity.symbol, "RKLB");
  assert.equal(item.identity.exchange, "NASDAQ");
  assert.equal(item.identity.currency, "USD");
  assert.ok(item.reason.includes("RKLB · NASDAQ · USD"));
  assert.equal(item.sources[0]?.title, "Alpha Vantage 标的资料");
  assert.equal(item.sources[0]?.sourceType, "institutional");

  const brief = mapDailyIntelligenceItemToRecommendationBrief(item);
  assert.equal(brief.identity.securityId, "sec_rklb_us");
  assert.equal(brief.sourceLabel, "缓存机构资料");
  assert.equal(brief.confidence, "high");
  assert.equal(brief.sourceReliability, 76);
  assert.ok(
    brief.sources.some((source) => source.sourceType === "institutional"),
  );
});

test("daily intelligence endpoint combines documents and saved analysis without live fetch", async () => {
  const now = new Date("2026-04-30T16:00:00.000Z");
  await mockRepositories.externalResearchDocuments.create({
    userId: "daily_intel_user_2",
    providerDocumentId: "doc_xbb_market_1",
    sourceType: "market-data",
    providerId: "market-data",
    sourceName: "本地缓存行情",
    title: "XBB listing 缓存行情快照",
    summary: "XBB TSX CAD 的缓存行情可用。",
    url: null,
    publishedAt: "2026-04-30T00:00:00.000Z",
    capturedAt: now.toISOString(),
    expiresAt: "2099-05-01T16:00:00.000Z",
    language: "zh",
    security: {
      securityId: "sec_xbb_cad",
      symbol: "XBB",
      exchange: "TSX",
      currency: "CAD",
    },
    underlyingId: null,
    confidence: "medium",
    sentiment: "neutral",
    relevanceScore: 65,
    sourceReliability: 82,
    keyPoints: ["缓存价格历史可用。"],
    riskFlags: [],
    tags: ["market-data"],
    rawPayload: {},
  });
  await mockRepositories.analysisRuns.create({
    userId: "daily_intel_user_2",
    scope: "security",
    mode: "quick",
    targetKey: "security:quick:security:AMZN:NASDAQ:USD:_",
    request: {
      scope: "security",
      security: { symbol: "AMZN", exchange: "NASDAQ", currency: "USD" },
    },
    result: {
      identity: { symbol: "AMZN", exchange: "NASDAQ", currency: "USD" },
      summary: {
        title: "AMZN 智能快扫",
        thesis: "本地分析指出该标的需要结合风险偏好复核。",
      },
      sources: [{ title: "Portfolio data", sourceType: "portfolio-data" }],
    },
    sourceMode: "local",
    generatedAt: "2026-04-30T15:45:00.000Z",
    expiresAt: "2099-05-01T15:45:00.000Z",
  });

  const response = await getMobileDailyIntelligenceView(
    "daily_intel_user_2",
    8,
  );

  assert.equal(response.data.policy.manualTriggerOnly, true);
  assert.equal(response.data.policy.scheduledOverviewEnabled, false);
  assert.equal(response.data.policy.securityManualRefreshEnabled, true);
  assert.match(response.data.policy.disclaimer, /不会触发实时新闻/);
  assert.ok(response.data.items.length >= 3);
  assert.ok(
    response.data.items.some((item) => item.id.startsWith("sentiment:")),
  );
  assert.ok(
    response.data.items.some((item) => item.id.startsWith("sentiment-risk:")),
  );
  assert.ok(
    response.data.items.some((item) =>
      item.id.startsWith("sentiment-indexes:"),
    ),
  );
  assert.ok(
    response.data.items.some((item) => item.id.startsWith("sentiment-macro:")),
  );
  assert.ok(response.data.items.some((item) => item.title.includes("XBB")));
  assert.ok(response.data.items.some((item) => item.title.includes("AMZN")));
});

test("daily intelligence hides local fallback cards when external news exists", async () => {
  const now = new Date("2026-05-15T13:00:00.000Z");
  await mockRepositories.externalResearchDocuments.create({
    userId: "daily_intel_news_user",
    providerDocumentId: "alpha-vantage-news:macro:test",
    sourceType: "news",
    providerId: "alpha-vantage-news",
    sourceName: "Alpha Vantage News",
    title: "Markets digest fresh inflation data",
    summary: "Major indexes reacted to updated inflation and rate expectations.",
    url: "https://example.com/markets-inflation",
    publishedAt: "2026-05-15T12:00:00.000Z",
    capturedAt: now.toISOString(),
    expiresAt: "2099-05-16T13:00:00.000Z",
    language: "en",
    security: null,
    underlyingId: null,
    confidence: "high",
    sentiment: "neutral",
    relevanceScore: 76,
    sourceReliability: 74,
    keyPoints: ["Inflation data changed rate expectations."],
    riskFlags: ["News is background information, not a trading signal."],
    tags: ["news", "alpha-vantage", "macro"],
    rawPayload: {},
  });
  await mockRepositories.analysisRuns.create({
    userId: "daily_intel_news_user",
    scope: "security",
    mode: "quick",
    targetKey: "security:quick:security:AMZN:NASDAQ:USD:_",
    request: {
      scope: "security",
      security: { symbol: "AMZN", exchange: "NASDAQ", currency: "USD" },
    },
    result: {
      identity: { symbol: "AMZN", exchange: "NASDAQ", currency: "USD" },
      summary: {
        title: "AMZN 本地快扫",
        thesis: "本地分析不应在真实新闻存在时抢占秘闻卡片。",
      },
      sources: [{ title: "Portfolio data", sourceType: "portfolio-data" }],
    },
    sourceMode: "local",
    generatedAt: "2026-05-15T12:30:00.000Z",
    expiresAt: "2099-05-16T12:30:00.000Z",
  });

  const response = await getMobileDailyIntelligenceView(
    "daily_intel_news_user",
    8,
  );

  assert.ok(response.data.items.length >= 1);
  assert.ok(response.data.items.every((item) => !item.id.startsWith("sentiment:")));
  assert.ok(
    response.data.items.every((item) => !item.id.startsWith("analysis:")),
  );
  assert.ok(response.data.items.some((item) => item.sourceType === "news"));
});

test("daily intelligence shares global overview news across users", async () => {
  const now = new Date("2026-05-25T13:00:00.000Z");
  await mockRepositories.externalResearchDocuments.createGlobal({
    providerDocumentId: "alpha-vantage-news:macro:shared",
    sourceType: "news",
    providerId: "alpha-vantage-news",
    sourceName: "Alpha Vantage News",
    title: "Global markets weigh rate expectations",
    summary: "A shared market news item should be read by every user.",
    url: "https://example.com/global-markets",
    publishedAt: "2026-05-25T12:00:00.000Z",
    capturedAt: now.toISOString(),
    expiresAt: "2099-05-26T13:00:00.000Z",
    language: "en",
    security: null,
    underlyingId: null,
    confidence: "high",
    sentiment: "neutral",
    relevanceScore: 82,
    sourceReliability: 74,
    keyPoints: ["Rate expectations changed across markets."],
    riskFlags: ["News is background information, not a trading signal."],
    tags: ["news", "alpha-vantage", "macro"],
    rawPayload: {},
  });

  const firstUser = await getMobileDailyIntelligenceView(
    "daily_intel_global_user_1",
    8,
  );
  const secondUser = await getMobileDailyIntelligenceView(
    "daily_intel_global_user_2",
    8,
  );

  assert.ok(
    firstUser.data.items.some((item) =>
      item.title.includes("Global markets"),
    ),
  );
  assert.ok(
    secondUser.data.items.some((item) =>
      item.title.includes("Global markets"),
    ),
  );
  assert.ok(
    firstUser.data.items.every((item) => !item.id.startsWith("sentiment:")),
  );
  assert.ok(
    secondUser.data.items.every((item) => !item.id.startsWith("sentiment:")),
  );
});

test("daily intelligence returns at least three market pulse cards without research cache", async () => {
  await mockRepositories.externalResearchDocuments.createGlobal({
    providerDocumentId: "alpha-vantage-news:macro:expired",
    sourceType: "news",
    providerId: "alpha-vantage-news",
    sourceName: "Expired Global News",
    title: "Expired global macro news",
    summary: "Expired news should not suppress market pulse fallback.",
    url: "https://example.com/expired",
    publishedAt: "2026-05-20T12:00:00.000Z",
    capturedAt: "2026-05-20T13:00:00.000Z",
    expiresAt: "2026-05-21T13:00:00.000Z",
    language: "en",
    security: null,
    underlyingId: null,
    confidence: "high",
    sentiment: "neutral",
    relevanceScore: 99,
    sourceReliability: 74,
    keyPoints: ["Expired point."],
    riskFlags: [],
    tags: ["news", "macro"],
    rawPayload: {},
  });
  const response = await getMobileDailyIntelligenceView(
    "daily_intel_empty_user",
    8,
    new Date("2100-05-22T13:00:00.000Z"),
  );

  assert.ok(response.data.items.length >= 3);
  assert.ok(
    response.data.items.some((item) => item.id.startsWith("sentiment:")),
  );
  assert.ok(
    response.data.items.some((item) => item.id.startsWith("sentiment-risk:")),
  );
  assert.ok(
    response.data.items.some((item) =>
      item.id.startsWith("sentiment-indexes:"),
    ),
  );
  assert.ok(
    response.data.items.some((item) => item.id.startsWith("sentiment-macro:")),
  );
});
