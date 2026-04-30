import assert from "node:assert/strict";
import test from "node:test";
import type { RecommendationsData } from "@/lib/contracts";
import { mapRecommendationIntelligenceRefs } from "@/lib/backend/mobile-views";

function brief(
  id: string,
  symbol: string,
  exchange: string,
  currency: string,
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
    identity: { symbol, exchange, currency },
    sources: [],
  };
}

test("recommendation intelligence refs attach only unambiguous symbol matches", () => {
  const refs = mapRecommendationIntelligenceRefs(
    { security: "NVDA - NVIDIA", tickers: "NVDA, VOO" },
    [
      brief("brief_nvda", "NVDA", "NASDAQ", "USD"),
      brief("brief_xef", "XEF", "TSX", "CAD"),
    ],
  );

  assert.equal(refs.length, 1);
  assert.equal(refs[0]?.id, "brief_nvda");
  assert.equal(refs[0]?.scope, "listing");
  assert.equal(refs[0]?.listingLabel, "NVDA · NASDAQ · USD");
});

test("recommendation intelligence refs downgrade ambiguous CAD and US listings to underlying context", () => {
  const refs = mapRecommendationIntelligenceRefs(
    { security: "AMZN - Amazon", tickers: "AMZN" },
    [
      brief("brief_amzn_us", "AMZN", "NASDAQ", "USD"),
      brief("brief_amzn_cad", "AMZN", "NEO", "CAD"),
    ],
  );

  assert.equal(refs.length, 2);
  assert.equal(refs[0]?.scope, "underlying");
  assert.equal(refs[0]?.scopeLabel, "底层资产情报");
  assert.equal(refs[1]?.scope, "underlying");
});
