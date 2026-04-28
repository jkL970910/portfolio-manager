import { apiSuccess } from "@/lib/backend/contracts";
import { PortfolioAnalysisRun } from "@/lib/backend/models";
import { getRepositories } from "@/lib/backend/repositories/factory";

const SCOPE_LABELS: Record<PortfolioAnalysisRun["scope"], string> = {
  security: "标的快扫",
  portfolio: "组合快扫",
  account: "账户快扫",
  "recommendation-run": "推荐解释"
};

export interface MobilePortfolioAnalysisHistoryItem {
  id: string;
  scope: PortfolioAnalysisRun["scope"];
  scopeLabel: string;
  title: string;
  detail: string;
  generatedAt: string;
  sourceMode: PortfolioAnalysisRun["sourceMode"];
}

function getSummaryTitle(result: Record<string, unknown>) {
  const summary = result.summary;
  if (summary && typeof summary === "object" && "title" in summary) {
    const title = (summary as { title?: unknown }).title;
    if (typeof title === "string" && title.trim()) {
      return title.trim();
    }
  }
  return "AI 快扫记录";
}

function getSummaryThesis(result: Record<string, unknown>) {
  const summary = result.summary;
  if (summary && typeof summary === "object" && "thesis" in summary) {
    const thesis = (summary as { thesis?: unknown }).thesis;
    if (typeof thesis === "string" && thesis.trim()) {
      return thesis.trim();
    }
  }
  return "这条记录来自本地组合、账户、持仓和行情缓存。";
}

export function mapAnalysisRunForMobile(run: PortfolioAnalysisRun): MobilePortfolioAnalysisHistoryItem {
  return {
    id: run.id,
    scope: run.scope,
    scopeLabel: SCOPE_LABELS[run.scope],
    title: getSummaryTitle(run.result),
    detail: getSummaryThesis(run.result),
    generatedAt: run.generatedAt,
    sourceMode: run.sourceMode
  };
}

export async function getMobileAnalysisHistory(userId: string, limit = 5) {
  const repositories = getRepositories();
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 20);
  const runs = await repositories.analysisRuns.listRecentByUserId(userId, safeLimit);
  return apiSuccess({
    items: runs.map(mapAnalysisRunForMobile)
  }, "database");
}
