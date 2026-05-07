import assert from "node:assert/strict";
import test from "node:test";
import { formatFxRateLabel } from "@/lib/market-data/fx";

test("FX labels expose rate freshness date and source without provider jargon", () => {
  assert.equal(
    formatFxRateLabel({
      rate: 1.3725,
      rateDate: "2026-05-07",
      source: "twelve-data",
      freshness: "fresh",
    }),
    "USD/CAD 1.3725 · 最新 · 日期 2026-05-07 · 来源 twelve-data",
  );
});

test("FX fallback label is explicit when no provider rate is available", () => {
  assert.equal(
    formatFxRateLabel({
      rate: 1.38,
      rateDate: null,
      source: "fallback-static",
      freshness: "fallback",
    }),
    "USD/CAD 1.3800 · 保守兜底 · 日期 暂无 · 来源 本地保守兜底",
  );
});
