import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mapMarketDataRefreshRunForMobile } from "@/lib/backend/market-data-refresh-runs";

const baseRun = {
  id: "11111111-1111-4111-8111-111111111111",
  scope: "portfolio-quotes",
  status: "success",
  triggeredBy: "manual",
  workerId: null,
  sampledSymbolCount: 12,
  refreshedHoldingCount: 10,
  missingQuoteCount: 0,
  historyPointCount: 8,
  snapshotRecorded: true,
  fxRateLabel: "1 USD = 1.37 CAD",
  fxAsOf: "2026-04-29",
  fxSource: "stored",
  fxFreshness: "fresh",
  providerStatusJson: {},
  errorMessage: null,
  startedAt: new Date("2026-04-29T10:00:00.000Z"),
  finishedAt: new Date("2026-04-29T10:00:01.250Z"),
  createdAt: new Date("2026-04-29T10:00:00.000Z"),
};

describe("market data refresh run mobile mapping", () => {
  it("maps successful manual refreshes to Chinese mobile status labels", () => {
    const item = mapMarketDataRefreshRunForMobile(baseRun);

    assert.equal(item.scopeLabel, "组合行情");
    assert.equal(item.statusLabel, "刷新成功");
    assert.equal(item.triggerLabel, "手动刷新");
    assert.equal(item.fxFreshnessLabel, "FX 新鲜");
    assert.equal(item.durationMs, 1250);
    assert.equal(item.providerStatusLabel, "本次刷新没有记录 provider 错误。");
  });

  it("keeps skipped worker quota reasons visible for Settings QA", () => {
    const item = mapMarketDataRefreshRunForMobile({
      ...baseRun,
      status: "skipped",
      triggeredBy: "worker",
      missingQuoteCount: 0,
      snapshotRecorded: false,
      fxRateLabel: null,
      fxAsOf: null,
      fxSource: null,
      fxFreshness: null,
      errorMessage: "Skipped because estimated symbols would exceed quota.",
      finishedAt: new Date("2026-04-29T10:00:00.100Z"),
    });

    assert.equal(item.statusLabel, "已跳过");
    assert.equal(item.triggerLabel, "后台任务");
    assert.equal(
      item.providerStatusLabel,
      "Skipped because estimated symbols would exceed quota.",
    );
  });

  it("surfaces active provider retry-after limits", () => {
    const item = mapMarketDataRefreshRunForMobile({
      ...baseRun,
      status: "partial",
      missingQuoteCount: 3,
      providerStatusJson: {
        providerLimits: [
          {
            provider: "twelve-data",
            limited: true,
            reason: "API credits exhausted.",
            retryAfterSeconds: 600,
            limitedUntil: "2026-04-29T10:10:00.000Z",
            recordedAt: "2026-04-29T10:00:00.000Z",
          },
        ],
      },
    });

    assert.equal(item.providerLimits.length, 1);
    assert.equal(
      item.providerStatusLabel,
      "twelve-data 已限流，约 600 秒后重试",
    );
  });
});
