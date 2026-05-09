import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDerivedMarketSentimentSnapshot,
  getFgiLevel,
  getMarketSentimentRating,
  getVixLevel,
  mapMarketSentimentForMobile,
  parseCnnFgiPayload,
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
  assert.ok(snapshot.components.length >= 2);
  assert.equal(
    snapshot.components.some((item) => item.id === "credit-risk"),
    false,
  );
  assert.equal(
    snapshot.components.some((item) => item.id === "safe-haven"),
    false,
  );
  assert.match(view.summary, /美股市场脉搏/);
  assert.match(view.quadrantLabel, /波动|震荡/);
  assert.match(view.riskNote, /不是自动|不应因为指数本身/);
  assert.equal(typeof view.fgiChange, "number");
  assert.equal(typeof view.scoreChange, "number");
  assert.equal(typeof view.vixChange, "number");
});

test("CNN FGI payload parser only accepts graphdata-shaped scores", () => {
  assert.deepEqual(parseCnnFgiPayload({}), null);
  assert.deepEqual(
    parseCnnFgiPayload({
      fear_and_greed: {
        score: "not-a-score",
        previous_close: 66,
        timestamp: "2026-05-08T19:59:34+00:00",
      },
    }),
    null,
  );

  const parsed = parseCnnFgiPayload({
    fear_and_greed: {
      score: 67.2,
      previous_close: 67.6285714285714,
      timestamp: "2026-05-08T19:59:34+00:00",
    },
  });

  assert.equal(parsed?.score, 67);
  assert.equal(parsed?.previousClose, 68);
  assert.equal(parsed?.provider, "cnn-fear-and-greed");
  assert.equal(parsed?.asOf, "2026-05-08T19:59:34.000Z");
});

test("live FGI snapshots label official CNN data without breaking legacy fields", () => {
  const snapshot = {
    id: "sentiment_cnn",
    createdAt: "2026-05-08T20:00:00.000Z",
    updatedAt: "2026-05-08T20:00:00.000Z",
    ...buildDerivedMarketSentimentSnapshot(
      new Date("2026-05-08T20:00:00.000Z"),
      {
        liveFgi: {
          score: 67,
          previousClose: 68,
          asOf: "2026-05-08T19:59:34.000Z",
          provider: "cnn-fear-and-greed",
          sourceLabel: "CNN Fear & Greed",
          sourceUrl: "https://www.cnn.com/markets/fear-and-greed",
        },
      },
    ),
  };
  const view = mapMarketSentimentForMobile(snapshot);

  assert.equal(snapshot.fgiScore, 67);
  assert.equal(view.fgiLabel, "CNN FGI");
  assert.equal(view.fgiSourceMode, "cnn");
  assert.equal(view.fgiChange, -1);
  assert.equal(snapshot.components[0]?.label, "CNN FGI");
  assert.equal(snapshot.components[0]?.score, 67);
});

test("market pulse uses real macro indicators without placeholder components", () => {
  const snapshot = {
    id: "sentiment_macro",
    createdAt: "2026-05-08T20:00:00.000Z",
    updatedAt: "2026-05-08T20:00:00.000Z",
    ...buildDerivedMarketSentimentSnapshot(
      new Date("2026-05-08T20:00:00.000Z"),
      {
        liveFgi: {
          score: 67,
          previousClose: 68,
          asOf: "2026-05-08T19:59:34.000Z",
          provider: "cnn-fear-and-greed",
          sourceLabel: "CNN Fear & Greed",
          sourceUrl: "https://www.cnn.com/markets/fear-and-greed",
        },
        liveIndicators: [
          {
            id: "credit-pressure",
            label: "信用压力",
            value: "2.79%",
            changeLabel: "+4 bp",
            levelLabel: "低压力",
            detail: "高收益债利差。",
            sourceLabel: "FRED BAMLH0A0HYM2",
            asOf: "2026-05-07",
            score: 5,
          },
          {
            id: "rate-pressure",
            label: "利率压力",
            value: "4.41%",
            changeLabel: "+5 bp",
            levelLabel: "估值承压",
            detail: "美国10年期国债收益率。",
            sourceLabel: "FRED DGS10",
            asOf: "2026-05-07",
            score: 56,
          },
        ],
      },
    ),
  };
  const view = mapMarketSentimentForMobile(snapshot);

  assert.ok(snapshot.components.some((item) => item.id === "credit-pressure"));
  assert.ok(snapshot.components.some((item) => item.id === "rate-pressure"));
  assert.equal(
    snapshot.components.some((item) => item.id === "credit-risk"),
    false,
  );
  assert.equal(
    snapshot.components.some((item) => item.id === "safe-haven"),
    false,
  );
  assert.equal(view.macroIndicators.length, 2);
  assert.equal(view.macroIndicators[0]?.sourceLabel, "FRED BAMLH0A0HYM2");
});
