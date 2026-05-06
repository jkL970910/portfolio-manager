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
  sourceLabel: string;
  scorecards: {
    label: string;
    score: number;
    rationale: string;
  }[];
  risks: {
    severity: string;
    title: string;
    detail: string;
  }[];
  actionItems: {
    priority: string;
    title: string;
    detail: string;
  }[];
  sources: {
    title: string;
    sourceType: string;
    date?: string;
    url?: string;
  }[];
  disclaimer: string;
}

function getSummaryTitle(result: Record<string, unknown>) {
  const summary = result.summary;
  if (summary && typeof summary === "object" && "title" in summary) {
    const title = (summary as { title?: unknown }).title;
    if (typeof title === "string" && title.trim()) {
      return title.trim();
    }
  }
  return "智能快扫记录";
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

function getSourceLabel(sourceMode: PortfolioAnalysisRun["sourceMode"]) {
  switch (sourceMode) {
    case "cached-external":
      return "缓存外部研究";
    case "live-external":
      return "实时外部研究";
    default:
      return "本地快扫";
  }
}

function mapScorecards(result: Record<string, unknown>) {
  const raw = result.scorecards;
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.slice(0, 6).map((item) => {
    const value = item && typeof item === "object"
      ? item as Record<string, unknown>
      : {};
    return {
      label: typeof value.label === "string" ? value.label : "评分",
      score: typeof value.score === "number" ? value.score : 0,
      rationale: typeof value.rationale === "string" ? value.rationale : ""
    };
  });
}

function mapRisks(result: Record<string, unknown>) {
  const raw = result.risks;
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.slice(0, 6).map((item) => {
    const value = item && typeof item === "object"
      ? item as Record<string, unknown>
      : {};
    return {
      severity: typeof value.severity === "string" ? value.severity : "info",
      title: typeof value.title === "string" ? value.title : "风险提示",
      detail: typeof value.detail === "string" ? value.detail : ""
    };
  });
}

function mapActionItems(result: Record<string, unknown>) {
  const raw = result.actionItems;
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.slice(0, 6).map((item) => {
    const value = item && typeof item === "object"
      ? item as Record<string, unknown>
      : {};
    return {
      priority: typeof value.priority === "string" ? value.priority : "P2",
      title: typeof value.title === "string" ? value.title : "后续动作",
      detail: typeof value.detail === "string" ? value.detail : ""
    };
  });
}

function mapSources(result: Record<string, unknown>) {
  const raw = result.sources;
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.slice(0, 8).map((item) => {
    const value = item && typeof item === "object"
      ? item as Record<string, unknown>
      : {};
    return {
      title: typeof value.title === "string" ? value.title : "来源",
      sourceType: typeof value.sourceType === "string"
        ? value.sourceType
        : "portfolio-data",
      date: typeof value.date === "string" ? value.date : undefined,
      url: typeof value.url === "string" ? value.url : undefined
    };
  });
}

function getDisclaimer(result: Record<string, unknown>) {
  const disclaimer = result.disclaimer;
  if (disclaimer && typeof disclaimer === "object" && "zh" in disclaimer) {
    const zh = (disclaimer as { zh?: unknown }).zh;
    if (typeof zh === "string" && zh.trim()) {
      return zh.trim();
    }
  }

  return "仅用于研究学习，不构成投资建议。";
}

export function mapAnalysisRunForMobile(run: PortfolioAnalysisRun): MobilePortfolioAnalysisHistoryItem {
  return {
    id: run.id,
    scope: run.scope,
    scopeLabel: SCOPE_LABELS[run.scope],
    title: getSummaryTitle(run.result),
    detail: getSummaryThesis(run.result),
    generatedAt: run.generatedAt,
    sourceMode: run.sourceMode,
    sourceLabel: getSourceLabel(run.sourceMode),
    scorecards: mapScorecards(run.result),
    risks: mapRisks(run.result),
    actionItems: mapActionItems(run.result),
    sources: mapSources(run.result),
    disclaimer: getDisclaimer(run.result)
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
