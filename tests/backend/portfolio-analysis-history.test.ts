import assert from "node:assert/strict";
import test from "node:test";
import type { PortfolioAnalysisRun } from "@/lib/backend/models";
import { mapAnalysisRunForMobile } from "@/lib/backend/portfolio-analysis-history";

test("analysis history maps saved analyzer runs to compact mobile rows", () => {
  const run: PortfolioAnalysisRun = {
    id: "analysis_1",
    userId: "user_test",
    scope: "account",
    mode: "quick",
    targetKey: "account:acct_tfsa",
    request: { scope: "account", accountId: "acct_tfsa" },
    result: {
      summary: {
        title: "TFSA AI 账户快扫",
        thesis: "账户内适配和全组合目标参考需要分开看。"
      },
      internalOnly: "not part of the compact mobile row"
    },
    sourceMode: "local",
    generatedAt: "2026-04-28T16:00:00.000Z",
    expiresAt: "2026-04-28T16:15:00.000Z",
    createdAt: "2026-04-28T16:00:00.000Z"
  };

  const item = mapAnalysisRunForMobile(run);

  assert.equal(item.scopeLabel, "账户快扫");
  assert.equal(item.title, "TFSA AI 账户快扫");
  assert.equal(item.detail, "账户内适配和全组合目标参考需要分开看。");
  assert.equal(item.generatedAt, run.generatedAt);
});
