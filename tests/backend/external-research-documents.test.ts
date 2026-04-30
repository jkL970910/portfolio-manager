import assert from "node:assert/strict";
import test from "node:test";
import {
  buildExternalResearchResultFromDocuments,
  ExternalResearchDocument,
  rankExternalResearchDocuments,
} from "@/lib/backend/external-research-documents";

function document(
  overrides: Partial<ExternalResearchDocument> = {},
): ExternalResearchDocument {
  return {
    id: "doc_vfv_news",
    sourceType: "news",
    providerId: "news",
    sourceName: "Test News",
    title: "VFV distribution update",
    summary: "A structured cached news item for VFV.",
    url: "https://example.com/vfv",
    publishedAt: "2026-04-30T10:00:00.000Z",
    capturedAt: "2026-04-30T10:10:00.000Z",
    expiresAt: "2026-05-01T10:00:00.000Z",
    language: "en",
    security: {
      securityId: "sec_vfv_cad",
      symbol: "VFV",
      exchange: "TSX",
      currency: "CAD",
      name: "Vanguard S&P 500 Index ETF",
    },
    confidence: "medium",
    sentiment: "neutral",
    relevanceScore: 80,
    sourceReliability: 85,
    keyPoints: ["费用和派息信息可作为 ETF 背景。"],
    riskFlags: ["这不是实时价格信号。"],
    tags: ["etf"],
    ...overrides,
  };
}

test("external research documents rank exact security identity above underlying context", () => {
  const ranked = rankExternalResearchDocuments(
    [
      document({
        id: "doc_underlying",
        security: null,
        underlyingId: "VANGUARD-SP-500",
        relevanceScore: 80,
      }),
      document({
        id: "doc_listing",
        security: {
          securityId: "sec_vfv_cad",
          symbol: "VFV",
          exchange: "TSX",
          currency: "CAD",
        },
        relevanceScore: 70,
      }),
    ],
    {
      scope: "security",
      mode: "quick",
      security: {
        securityId: "sec_vfv_cad",
        symbol: "VFV",
        exchange: "TSX",
        currency: "CAD",
      },
      cacheStrategy: "prefer-cache",
      maxCacheAgeSeconds: 21600,
      includeExternalResearch: true,
    },
    new Date("2026-04-30T12:00:00.000Z"),
  );

  assert.equal(ranked[0]?.id, "doc_listing");
  assert.equal(ranked[0]?.identityScope, "listing");
  assert.equal(ranked[1]?.identityScope, "underlying");
});

test("external research documents do not treat ticker-only data as listing evidence", () => {
  const ranked = rankExternalResearchDocuments(
    [
      document({
        security: {
          symbol: "VFV",
          name: "Vanguard S&P 500 Index ETF",
        },
      }),
    ],
    {
      scope: "security",
      mode: "quick",
      security: {
        symbol: "VFV",
        exchange: "TSX",
        currency: "CAD",
      },
      cacheStrategy: "prefer-cache",
      maxCacheAgeSeconds: 21600,
      includeExternalResearch: true,
    },
    new Date("2026-04-30T12:00:00.000Z"),
  );

  assert.equal(ranked[0]?.identityScope, "unresolved");
});

test("external research result excludes expired and unresolved documents from primary sources", () => {
  const result = buildExternalResearchResultFromDocuments(
    {
      userId: "user_casey",
      request: {
        scope: "security",
        mode: "quick",
        security: {
          securityId: "sec_vfv_cad",
          symbol: "VFV",
          exchange: "TSX",
          currency: "CAD",
        },
        cacheStrategy: "prefer-cache",
        maxCacheAgeSeconds: 21600,
        includeExternalResearch: true,
      },
      targetKey: "security:quick:security-id:sec_vfv_cad",
      allowedSources: [
        {
          id: "news",
          label: "新闻与公告",
          enabled: true,
          reason: "test",
        },
      ],
      now: new Date("2026-04-30T12:00:00.000Z"),
    },
    [
      document({ id: "doc_current" }),
      document({
        id: "doc_expired",
        expiresAt: "2026-04-29T12:00:00.000Z",
      }),
      document({
        id: "doc_unresolved",
        security: { symbol: "VFV" },
      }),
    ],
  );

  assert.equal(result.sources.length, 1);
  assert.match(result.summaryPoints.join("\n"), /VFV distribution update/);
  assert.ok(result.risks.some((risk) => risk.includes("已过期")));
  assert.ok(result.risks.some((risk) => risk.includes("缺少 securityId")));
});
