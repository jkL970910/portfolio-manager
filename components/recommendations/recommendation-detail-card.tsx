"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Info } from "lucide-react";
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
  expanded?: boolean;
  onToggle?: () => void;
};

type DecisionStep = {
  kind: string;
  variant: "success" | "warning";
  text: string;
  shortTag: string;
};

type HelpTerm = {
  label: string;
  detail: string;
};

function getShortDecisionTag(language: DisplayLanguage, text: string, variant: "success" | "warning") {
  const normalized = text.toLowerCase();

  if (text.includes("账户") || normalized.includes("account")) {
    return pick(language, "找对账户", "Right account");
  }
  if (text.includes("风险") || text.includes("集中") || normalized.includes("risk") || normalized.includes("concentration")) {
    return pick(language, "分散风险", "Spread risk");
  }
  if (text.includes("标的") || text.includes("候选") || normalized.includes("security") || normalized.includes("candidate")) {
    return pick(language, "挑主标的", "Pick the lead");
  }
  if (text.includes("FX") || text.includes("币种") || normalized.includes("fx") || normalized.includes("currency")) {
    return pick(language, "少交换汇成本", "Limit FX drag");
  }
  if (text.includes("目标") || text.includes("缺口") || normalized.includes("target") || normalized.includes("gap")) {
    return pick(language, "先补缺口", "Close the gap");
  }

  return variant === "success"
    ? pick(language, "这点在给它加分", "This helps the idea")
    : pick(language, "这点让别的路掉下去", "This weakens alternatives");
}

function getHelpTerms(language: DisplayLanguage): HelpTerm[] {
  return [
    {
      label: pick(language, "为什么它加分", "Why this adds confidence"),
      detail: pick(
        language,
        "表示这一条是在帮当前建议排到前面，也就是系统为什么觉得它更顺手。",
        "This is one of the reasons the current path ranks higher."
      )
    },
    {
      label: pick(language, "为什么别的路被压下去", "Why other paths drop"),
      detail: pick(
        language,
        "表示系统把别的方案往后排，通常是因为风险更高、账户不顺手，或者额外成本更重。",
        "This explains why competing paths rank lower, usually because of higher risk, weaker account fit, or extra cost."
      )
    },
    {
      label: pick(language, "账户顺手度", "Account fit"),
      detail: pick(
        language,
        "看这笔钱放进哪个账户更顺手，会一起考虑账户类型、额度和放置效率。",
        "Shows which account is the best home for the contribution."
      )
    },
    {
      label: pick(language, "换汇成本", "FX friction"),
      detail: pick(
        language,
        "看跨币种交易会不会多出明显换汇成本。成本越高，这条路越容易被系统往后放。",
        "Shows whether cross-currency conversion adds noticeable drag."
      )
    }
  ];
}

function groupConstraints(
  constraints: RecommendationDetailCardProps["priority"]["constraints"],
  language: DisplayLanguage
) {
  const confirmed = constraints.filter((item) => item.variant !== "warning");
  const watch = constraints.filter((item) => item.variant === "warning");

  return [
    {
      id: "confirmed",
      title: pick(language, "这条路为什么站得住", "Why this path holds up"),
      description: pick(
        language,
        "这些点说明这条建议不是碰巧排在前面，而是真的比较顺手。",
        "These checks explain why this path ranks well instead of landing there by accident."
      ),
      items: confirmed
    },
    {
      id: "watch",
      title: pick(language, "执行前要留意什么", "What to watch before acting"),
      description: pick(
        language,
        "这些不一定会拦住你，但执行前最好先知道。",
        "These do not always block the idea, but they are the first things to keep in mind."
      ),
      items: watch
    }
  ].filter((group) => group.items.length > 0);
}

export function RecommendationDetailCard({
  language,
  index,
  priority,
  expanded,
  onToggle
}: RecommendationDetailCardProps) {
  const [internalExpanded, setInternalExpanded] = useState(false);
  const [isTraceExpanded, setIsTraceExpanded] = useState(false);

  const isExpanded = expanded ?? internalExpanded;
  const handleToggle = onToggle ?? (() => setInternalExpanded((current) => !current));

  const decisionTrace = useMemo<DecisionStep[]>(
    () => [
      ...priority.whyThis.map((item) => ({
        kind: pick(language, "系统为什么先选这条路", "Why this path came first"),
        variant: "success" as const,
        text: item,
        shortTag: getShortDecisionTag(language, item, "success")
      })),
      ...priority.whyNot.map((item) => ({
        kind: pick(language, "系统为什么没先选别的", "Why other paths were not first"),
        variant: "warning" as const,
        text: item,
        shortTag: getShortDecisionTag(language, item, "warning")
      }))
    ],
    [language, priority.whyNot, priority.whyThis]
  );

  const helpTerms = useMemo(() => getHelpTerms(language), [language]);
  const constraintGroups = useMemo(() => groupConstraints(priority.constraints, language), [language, priority.constraints]);
  const shouldCollapseTrace = decisionTrace.length > 3;
  const visibleTrace = shouldCollapseTrace && !isTraceExpanded ? decisionTrace.slice(0, 3) : decisionTrace;

  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-4 px-5 py-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 flex-1 space-y-4">
            <div className="flex flex-wrap items-start gap-3">
              <Badge variant="primary">#{index + 1}</Badge>
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-semibold text-[color:var(--foreground)]">{priority.assetClass}</h3>
                  <Badge variant="neutral">{priority.security}</Badge>
                </div>
                <p className="text-sm leading-7 text-[color:var(--muted-foreground)]">{priority.description}</p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
              <SummaryBlock label={pick(language, "准备买什么", "Lead security")} value={priority.security} />
              <SummaryBlock label={pick(language, "这笔是在补什么", "Allocation gap")} value={priority.gapSummary} />
              <SummaryBlock label={pick(language, "放进哪个账户更顺手", "Best account home")} value={priority.accountFit} />
              <SummaryBlock label={pick(language, "系统怎么看这条建议", "How the system rates it")} value={priority.scoreline} />
            </div>
          </div>

          <div className="w-full rounded-[24px] border border-white/55 bg-white/40 p-4 text-right backdrop-blur-md sm:w-[248px]">
            <p className="text-sm text-[color:var(--muted-foreground)]">{pick(language, "这笔建议投多少", "Suggested amount")}</p>
            <p className="mt-2 text-3xl font-semibold text-[color:var(--foreground)]">{priority.amount}</p>
            <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">{priority.account}</p>
            <Button
              type="button"
              variant="secondary"
              onClick={handleToggle}
              className="mt-4 w-full justify-between"
              trailingIcon={isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            >
              {isExpanded
                ? pick(language, "收起这条建议的细节", "Hide recommendation detail")
                : pick(language, "看这条建议是怎么来的", "Show recommendation detail")}
            </Button>
          </div>
        </div>

        {isExpanded ? (
          <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <DetailBlock
                  label={pick(language, "这次优先买它", "Lead security")}
                  value={priority.security}
                  detail={priority.gapSummary}
                />
                <DetailBlock
                  label={pick(language, "还有哪些可选标的", "Ticker alternatives")}
                  value={priority.tickers}
                  detail={priority.alternatives.join(" · ")}
                />
              </div>

              <div className="rounded-[24px] border border-white/55 bg-white/36 p-4 backdrop-blur-md">
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-[color:var(--foreground)]">{pick(language, "系统是怎么想到这条路的", "How the system got here")}</p>
                      <p className="text-sm leading-7 text-[color:var(--muted-foreground)]">
                        {pick(
                          language,
                          "这一段把“为什么先选它、为什么别的没排到前面”串成一条解释链，顺着看就能知道系统怎么想的。",
                          "This section turns the recommendation into one readable chain so you can see how the system got here."
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
                          ? pick(language, "收起这段解释", "Collapse this explanation")
                          : pick(language, "展开完整解释", "Show the full explanation")}
                      </Button>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {helpTerms.map((term) => (
                      <HelpChip key={term.label} label={term.label} detail={term.detail} />
                    ))}
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {visibleTrace.map((step, traceIndex) => (
                    <div
                      key={`${priority.id}-trace-${traceIndex}`}
                      className="rounded-[22px] border border-white/55 bg-white/44 px-4 py-3 backdrop-blur-md"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/70 text-sm font-semibold text-[color:var(--foreground)]">
                            {traceIndex + 1}
                          </div>
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold text-[color:var(--foreground)]">{step.kind}</p>
                              <Badge variant={step.variant === "success" ? "success" : "warning"}>{step.shortTag}</Badge>
                            </div>
                            <p className="text-sm leading-7 text-[color:var(--muted-foreground)]">{step.text}</p>
                          </div>
                        </div>
                        <Badge variant={step.variant === "success" ? "success" : "warning"}>
                          {step.variant === "success"
                            ? pick(language, "在加分", "Adds confidence")
                            : pick(language, "在压低别的路", "Pushes alternatives down")}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {constraintGroups.map((group) => (
                <div key={`${priority.id}-${group.id}`} className="rounded-[24px] border border-white/55 bg-white/36 p-4 backdrop-blur-md">
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-[color:var(--foreground)]">{group.title}</p>
                    <p className="text-sm leading-7 text-[color:var(--muted-foreground)]">{group.description}</p>
                  </div>
                  <div className="mt-4 space-y-3">
                    {group.items.map((constraint) => (
                      <div
                        key={`${priority.id}-${group.id}-${constraint.label}`}
                        className="rounded-[20px] border border-white/55 bg-white/42 px-4 py-3 backdrop-blur-md"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-[color:var(--foreground)]">{constraint.label}</p>
                            <p className="mt-1 text-sm leading-7 text-[color:var(--muted-foreground)]">{constraint.detail}</p>
                          </div>
                          <Badge variant={constraint.variant}>
                            {constraint.variant === "success"
                              ? pick(language, "看起来没问题", "Looks good")
                              : constraint.variant === "warning"
                                ? pick(language, "这里要留意", "Watch this")
                                : pick(language, "顺手补充", "Extra context")}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <div className="rounded-[24px] border border-white/55 bg-white/36 p-4 backdrop-blur-md">
                <p className="text-sm font-semibold text-[color:var(--foreground)]">{pick(language, "如果你真的要执行，先看这些", "Before you act, check this")}</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {priority.execution.map((item) => (
                    <DetailBlock key={`${priority.id}-${item.label}`} label={item.label} value={item.value} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function SummaryBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[20px] border border-white/55 bg-white/36 px-4 py-3 backdrop-blur-md">
      <p className="text-sm text-[color:var(--muted-foreground)]">{label}</p>
      <p className="mt-2 font-semibold text-[color:var(--foreground)]">{value}</p>
    </div>
  );
}

function DetailBlock({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-[20px] border border-white/55 bg-white/36 px-4 py-3 backdrop-blur-md">
      <p className="text-sm text-[color:var(--muted-foreground)]">{label}</p>
      <p className="mt-2 font-semibold text-[color:var(--foreground)]">{value}</p>
      {detail ? <p className="mt-2 text-sm leading-7 text-[color:var(--muted-foreground)]">{detail}</p> : null}
    </div>
  );
}

function HelpChip({ label, detail }: HelpTerm) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="inline-flex items-center gap-1 rounded-full border border-white/55 bg-white/44 px-3 py-1.5 text-xs font-medium text-[color:var(--foreground)] backdrop-blur-md"
      >
        <Info className="h-3.5 w-3.5 text-[color:var(--primary)]" />
        {label}
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-20 mt-2 w-64 rounded-[18px] border border-white/55 bg-white/92 p-3 text-xs leading-6 text-[color:var(--muted-foreground)] shadow-[var(--shadow-card)] backdrop-blur-md">
          {detail}
        </div>
      ) : null}
    </div>
  );
}
