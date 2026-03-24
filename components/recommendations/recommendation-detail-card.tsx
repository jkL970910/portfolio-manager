"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { pick, type DisplayLanguage } from "@/lib/i18n/ui";

type RecommendationDetailCardProps = {
  language: DisplayLanguage;
  index: number;
  priority: {
    id: string;
    assetClass: string;
    description: string;
    amount: string;
    account: string;
    security: string;
    tickers: string;
    accountFit: string;
    scoreline: string;
    gapSummary: string;
    alternatives: string[];
    whyThis: string[];
    whyNot: string[];
    constraints: {
      label: string;
      detail: string;
      variant: "success" | "warning" | "neutral";
    }[];
    execution: {
      label: string;
      value: string;
    }[];
  };
};

export function RecommendationDetailCard({ language, index, priority }: RecommendationDetailCardProps) {
  const [isTraceExpanded, setIsTraceExpanded] = useState(false);

  const decisionTrace = useMemo(
    () => [
      ...priority.whyThis.map((item) => ({
        kind: pick(language, "选择这条路径", "Choose this path"),
        variant: "success" as const,
        text: item
      })),
      ...priority.whyNot.map((item) => ({
        kind: pick(language, "压低其他方案", "De-prioritize alternatives"),
        variant: "warning" as const,
        text: item
      }))
    ],
    [language, priority.whyNot, priority.whyThis]
  );

  const shouldCollapseTrace = decisionTrace.length > 3;
  const visibleTrace = shouldCollapseTrace && !isTraceExpanded
    ? decisionTrace.slice(0, 3)
    : decisionTrace;

  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-5 px-6 py-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Badge variant="primary">#{index + 1}</Badge>
              <h3 className="text-lg font-semibold text-[color:var(--foreground)]">{priority.assetClass}</h3>
            </div>
            <p className="max-w-3xl text-sm leading-7 text-[color:var(--muted-foreground)]">{priority.description}</p>
          </div>
          <div className="rounded-[24px] border border-white/55 bg-white/40 px-5 py-4 text-right backdrop-blur-md">
            <p className="text-sm text-[color:var(--muted-foreground)]">{pick(language, "建议金额", "Suggested amount")}</p>
            <p className="mt-2 text-2xl font-semibold text-[color:var(--foreground)]">{priority.amount}</p>
            <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">{priority.account}</p>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          <MetricBlock
            label={pick(language, "主表达标的", "Lead security")}
            value={priority.security}
            detail={priority.gapSummary}
          />
          <MetricBlock
            label={pick(language, "Ticker 备选", "Ticker alternatives")}
            value={priority.tickers}
            detail={priority.accountFit}
          />
          <MetricBlock
            label={pick(language, "综合评分", "Score line")}
            value={priority.scoreline}
            detail={pick(
              language,
              "这些分数用于解释当前建议，不是执行保证。",
              "These scores explain the current recommendation and are not execution guarantees."
            )}
          />
        </div>

        <div className="rounded-[24px] border border-white/55 bg-white/36 p-4 backdrop-blur-md">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-[color:var(--foreground)]">{pick(language, "决策轨迹", "Decision trace")}</p>
              <p className="text-sm leading-7 text-[color:var(--muted-foreground)]">
                {pick(
                  language,
                  "把为什么选择这条路径、为什么压低其他方案收成一条单一解释链，避免左右两栏同时竞争注意力。",
                  "A single explanation chain that captures why this path won and why alternatives were pushed down."
                )}
              </p>
            </div>
            {shouldCollapseTrace ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsTraceExpanded((current) => !current)}
                className="shrink-0"
              >
                {isTraceExpanded
                  ? pick(language, "收起决策轨迹", "Collapse decision trace")
                  : pick(language, "展开完整决策轨迹", "Show full decision trace")}
              </Button>
            ) : null}
          </div>
          <div className="mt-4 space-y-3">
            {visibleTrace.map((step, traceIndex) => (
              <div
                key={`${priority.id}-trace-${traceIndex}`}
                className="rounded-[22px] border border-white/55 bg-white/44 px-4 py-3 backdrop-blur-md"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/65 bg-white/82 text-xs font-semibold text-[color:var(--foreground)]">
                      {traceIndex + 1}
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-[color:var(--foreground)]">{step.kind}</p>
                      <p className="text-sm leading-7 text-[color:var(--muted-foreground)]">{step.text}</p>
                    </div>
                  </div>
                  <Badge variant={step.variant}>
                    {step.variant === "success"
                      ? pick(language, "支持", "Support")
                      : pick(language, "约束", "Constraint")}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
          {shouldCollapseTrace && !isTraceExpanded ? (
            <p className="mt-3 text-xs uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
              {pick(language, `已显示前 3 步，共 ${decisionTrace.length} 步`, `Showing the first 3 of ${decisionTrace.length} steps`)}
            </p>
          ) : null}
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-3 rounded-[24px] border border-white/55 bg-white/36 p-4 backdrop-blur-md">
            <p className="text-sm font-semibold text-[color:var(--foreground)]">{pick(language, "约束轨迹", "Constraint trace")}</p>
            {priority.constraints.map((constraint, constraintIndex) => (
              <div key={`${priority.id}-constraint-${constraintIndex}`} className="rounded-[22px] border border-white/55 bg-white/44 px-4 py-3 backdrop-blur-md">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-[color:var(--foreground)]">{constraint.label}</p>
                  <Badge variant={constraint.variant}>
                    {constraint.variant === "success"
                      ? pick(language, "已满足", "Satisfied")
                      : constraint.variant === "warning"
                        ? pick(language, "有惩罚", "Penalized")
                        : pick(language, "中性", "Neutral")}
                  </Badge>
                </div>
                <p className="mt-2 text-sm leading-7 text-[color:var(--muted-foreground)]">{constraint.detail}</p>
              </div>
            ))}
          </div>

          <div className="space-y-3 rounded-[24px] border border-white/55 bg-white/36 p-4 backdrop-blur-md">
            <p className="text-sm font-semibold text-[color:var(--foreground)]">{pick(language, "执行细节", "Execution detail")}</p>
            {priority.execution.map((item, executionIndex) => (
              <div key={`${priority.id}-execution-${executionIndex}`} className="rounded-[22px] border border-white/55 bg-white/44 px-4 py-3 backdrop-blur-md">
                <p className="text-sm text-[color:var(--muted-foreground)]">{item.label}</p>
                <p className="mt-2 text-sm font-semibold text-[color:var(--foreground)]">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[24px] border border-white/55 bg-white/34 p-4 text-sm text-[color:var(--muted-foreground)] backdrop-blur-md">
          <p className="font-medium text-[color:var(--foreground)]">{pick(language, "备选标的说明", "Alternative security note")}</p>
          <p className="mt-2 leading-7">{priority.alternatives.join(" · ")}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function MetricBlock({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-[24px] border border-white/55 bg-white/36 p-4 backdrop-blur-md">
      <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">{label}</p>
      <p className="mt-3 font-semibold text-[color:var(--foreground)]">{value}</p>
      <p className="mt-2 text-sm leading-7 text-[color:var(--muted-foreground)]">{detail}</p>
    </div>
  );
}
