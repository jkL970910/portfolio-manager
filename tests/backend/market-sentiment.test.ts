import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDerivedMarketSentimentSnapshot,
  getFgiLevel,
  getMarketSentimentRating,
  getVixLevel,
  mapMarketSentimentForMobile,
} from "@/lib/backend/market-sentiment";

test("market sentiment rating buckets match fear and greed semantics", () => {
  assert.equal(getMarketSentimentRating(10), "extreme-fear");
  assert.equal(getMarketSentimentRating(35), "fear");
  assert.equal(getMarketSentimentRating(50), "neutral");
  assert.equal(getMarketSentimentRating(70), "greed");
  assert.equal(getMarketSentimentRating(90), "extreme-greed");
});

test("market pulse VIX and FGI buckets support a 3x3 decision matrix", () => {
  assert.equal(getVixLevel(12), "low");
  assert.equal(getVixLevel(19.31), "normal");
  assert.equal(getVixLevel(31), "high");
  assert.equal(getFgiLevel(20), "fear");
  assert.equal(getFgiLevel(66), "neutral");
  assert.equal(getFgiLevel(82), "greed");
});

test("derived market sentiment snapshot is cacheable and user-facing", () => {
  const snapshot = {
    id: "sentiment_1",
    createdAt: "2026-05-05T12:00:00.000Z",
    updatedAt: "2026-05-05T12:00:00.000Z",
    ...buildDerivedMarketSentimentSnapshot(
      new Date("2026-05-05T12:00:00.000Z"),
    ),
  };
  const view = mapMarketSentimentForMobile(snapshot);

  assert.equal(snapshot.provider, "derived-us-market-sentiment");
  assert.equal(snapshot.indexName, "US Market Pulse");
  assert.ok(snapshot.score >= 0 && snapshot.score <= 100);
  assert.ok(snapshot.fgiScore >= 0 && snapshot.fgiScore <= 100);
  assert.ok(snapshot.vixValue != null);
  assert.ok(snapshot.quadrant);
  assert.match(snapshot.strategyLabel, /定投|观察|追高|仓位|确认|分批/);
  assert.ok(snapshot.components.length >= 4);
  assert.match(view.summary, /美股市场脉搏/);
  assert.match(view.quadrantLabel, /波动|震荡/);
  assert.match(view.riskNote, /不是自动|不应因为指数本身/);
});
