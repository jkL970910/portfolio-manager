import assert from "node:assert/strict";
import test from "node:test";
import { getMobileDataFreshnessPolicy } from "@/lib/backend/data-freshness-policy";

function clearFreshnessEnv() {
  delete process.env.MARKET_DATA_QUOTE_CACHE_TTL_SECONDS;
  delete process.env.MARKET_DATA_FX_CACHE_TTL_SECONDS;
  delete process.env.MARKET_DATA_RESOLVE_CACHE_TTL_SECONDS;
}

test("mobile data freshness policy exposes worker-owned cache boundaries", () => {
  clearFreshnessEnv();

  const policy = getMobileDataFreshnessPolicy();
  const quote = policy.items.find((item) => item.id === "quote");
  const fx = policy.items.find((item) => item.id === "fx");
  const history = policy.items.find((item) => item.id === "history");
  const external = policy.items.find(
    (item) => item.id === "external-intelligence",
  );

  assert.equal(policy.summary.quoteTtlLabel, "30 分钟");
  assert.equal(policy.summary.fxTtlLabel, "12 小时");
  assert.equal(policy.summary.historyTtlLabel, "30 分钟");
  assert.equal(policy.summary.externalIntelligenceTtlLabel, "6 小时");
  assert.match(policy.summary.workerBoundaryLabel, /worker\/cache/);
  assert.equal(quote?.workerTarget, true);
  assert.equal(fx?.workerTarget, true);
  assert.equal(history?.workerTarget, true);
  assert.equal(external?.workerTarget, true);
  assert.match(fx?.staleBehaviorLabel ?? "", /原始交易币种/);
  assert.match(history?.sourceLabel ?? "", /symbol \+ exchange \+ currency/);
  assert.match(external?.userActionLabel ?? "", /页面加载不得自动付费抓取/);
});

test("mobile data freshness policy follows market-data ttl env overrides", () => {
  process.env.MARKET_DATA_QUOTE_CACHE_TTL_SECONDS = "900";
  process.env.MARKET_DATA_FX_CACHE_TTL_SECONDS = "3600";

  const policy = getMobileDataFreshnessPolicy();

  assert.equal(policy.summary.quoteTtlLabel, "15 分钟");
  assert.equal(policy.summary.historyTtlLabel, "15 分钟");
  assert.equal(policy.summary.fxTtlLabel, "1 小时");

  clearFreshnessEnv();
});
