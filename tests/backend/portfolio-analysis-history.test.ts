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
  assert.equal(item.sourceLabel, "本地快扫");
  assert.equal(item.disclaimer, "仅用于研究学习，不构成投资建议。");
});

test("analysis history exposes cached-external result details for mobile drilldown", () => {
  const run: PortfolioAnalysisRun = {
    id: "analysis_external_1",
    userId: "user_test",
    scope: "security",
    mode: "quick",
    targetKey: "security:quick:security:VFV:TSX:CAD:_",
    request: {
      scope: "security",
      security: { symbol: "VFV", exchange: "TSX", currency: "CAD" }
    },
    result: {
      summary: {
        title: "VFV 缓存外部研究",
        thesis: "缓存行情覆盖 0 条 VFV 价格历史。"
      },
      scorecards: [
        {
          label: "缓存资料覆盖",
          score: 20,
          rationale: "本地缓存资料不足。"
        }
      ],
      risks: [
        {
          severity: "medium",
          title: "缓存资料限制",
          detail: "缓存行情为空；不能把该结果当成实时市场研究。"
        }
      ],
      actionItems: [
        {
          priority: "P1",
          title: "确认缓存资料是否足够新",
          detail: "需要实时资料前先确认 provider 和成本策略。"
        }
      ],
      sources: [
        {
          title: "Local cached security price history",
          sourceType: "market-data"
        }
      ],
      disclaimer: {
        zh: "仅用于研究学习，不构成投资建议。"
      }
    },
    sourceMode: "cached-external",
    generatedAt: "2026-04-28T19:50:33.000Z",
    expiresAt: "2026-04-29T01:50:33.000Z",
    createdAt: "2026-04-28T19:50:33.000Z"
  };

  const item = mapAnalysisRunForMobile(run);

  assert.equal(item.sourceLabel, "缓存外部研究");
  assert.equal(item.scorecards[0]?.label, "缓存资料覆盖");
  assert.equal(item.risks[0]?.title, "缓存资料限制");
  assert.equal(item.actionItems[0]?.priority, "P1");
  assert.equal(item.sources[0]?.sourceType, "market-data");
  assert.match(item.disclaimer, /不构成投资建议/);
});
