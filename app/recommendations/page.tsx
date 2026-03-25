import type { Route } from "next";
import { ArrowRight, Info, ShieldCheck } from "lucide-react";
import { requireViewer } from "@/lib/auth/session";
import { getRecommendationView } from "@/lib/backend/services";
import { AppShell } from "@/components/layout/app-shell";
import { RecommendationRunPanel } from "@/components/recommendations/recommendation-run-panel";
import { RecommendationPriorityStack } from "@/components/recommendations/recommendation-priority-stack";
import { ScenarioCompareCard } from "@/components/recommendations/scenario-compare-card";
import { EmptyStatePanel } from "@/components/ui/empty-state-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/section-heading";
import { pick } from "@/lib/i18n/ui";

export default async function RecommendationsPage() {
  const viewer = await requireViewer();
  const language = viewer.displayLanguage;
  const { data } = await getRecommendationView(viewer.id);

  return (
    <AppShell
      viewer={viewer}
      title={pick(language, "藏宝路线", "Recommendations")}
      description={pick(language, "推荐页负责给出更完整的资金配置路径。输入、理由、账户放置和风险说明都保持可见。", "This page carries the full funding path. Inputs, rationale, account placement, and risk notes stay visible.")}
    >
      <Card className="overflow-hidden bg-[linear-gradient(135deg,rgba(255,255,255,0.68),rgba(246,218,230,0.52),rgba(221,232,255,0.46))]">
        <CardContent className="grid gap-6 px-6 py-6 md:grid-cols-[1.2fr_0.8fr] md:items-center">
          <div className="space-y-4">
            <Badge variant="primary">{pick(language, "Loo 的藏宝路线", "Loo's recommendation desk")}</Badge>
            <div className="space-y-3">
              <h2 className="text-[30px] font-semibold tracking-[-0.04em] text-[color:var(--foreground)]">
                {pick(language, "先把假设摆在台面上，再给出下一笔钱怎么走。", "Show the assumptions first, then decide where the next contribution should go.")}
              </h2>
              <p className="max-w-3xl text-sm leading-7 text-[color:var(--muted-foreground)]">
                {pick(language, "这里不追求黑箱式结论。目标配置、账户优先级、ticker 备选和说明会一起出现，方便你判断这条路线值不值得采纳。", "This surface avoids black-box output. Target allocation, account order, ticker candidates, and rationale stay visible so you can judge the plan directly.")}
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <RecommendationSignal title={pick(language, "系统先看什么", "Inputs")} detail={pick(language, "你的目标、账户、投入金额和偏好。", "Targets, accounts, amount, and preferences")} />
            <RecommendationSignal title={pick(language, "最后会给你什么", "Outputs")} detail={pick(language, "先买哪类资产、放哪个账户、为什么这么做。", "Asset priorities, account fit, and rationale")} />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-6 xl:sticky xl:top-28 xl:self-start">
          <SectionHeading
            title={pick(language, "这次推荐是按什么算的", "What this recommendation is based on")}
            description={pick(language, "先把你现在的偏好、账户顺序和投入金额摆出来，这样你更容易看懂系统为什么这么分配。", "Show the current preferences, account order, and amount first so the recommendation is easier to understand.")}
          />
          <Card>
            <CardHeader>
              <CardTitle>{pick(language, "这次准备投入多少", "Planned contribution")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-[24px] border border-white/55 bg-white/38 p-4 backdrop-blur-md">
                  <p className="text-sm text-[color:var(--muted-foreground)]">{pick(language, "这次打算投入", "Planned amount")}</p>
                <p className="mt-2 text-3xl font-semibold">{data.contributionAmount}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {data.inputs.map((input) => (
                  <div key={input.label} className="rounded-[24px] border border-white/55 bg-white/34 p-4 backdrop-blur-md">
                    <p className="text-sm text-[color:var(--muted-foreground)]">{input.label}</p>
                    <p className="mt-2 font-semibold">{input.value}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{pick(language, "系统大致怎么想", "How the system is thinking")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-[24px] border border-white/55 bg-white/34 p-4 backdrop-blur-md">
                  <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">{pick(language, "引擎版本", "Engine version")}</p>
                  <p className="mt-2 font-semibold">{data.engine.version}</p>
                </div>
                <div className="rounded-[24px] border border-white/55 bg-white/34 p-4 backdrop-blur-md">
                  <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">{pick(language, "主要目标", "Primary goal")}</p>
                  <p className="mt-2 font-semibold">{data.engine.objective}</p>
                </div>
                <div className="rounded-[24px] border border-white/55 bg-white/34 p-4 backdrop-blur-md">
                  <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">{pick(language, "置信度", "Confidence")}</p>
                  <p className="mt-2 font-semibold">{data.engine.confidence}</p>
                </div>
              </div>
              {data.explainer.map((point) => (
                <div key={point} className="rounded-[24px] border border-white/55 bg-white/34 p-4 text-sm leading-7 text-[color:var(--muted-foreground)] backdrop-blur-md">
                  {point}
                </div>
              ))}
            </CardContent>
          </Card>
          <RecommendationRunPanel initialContributionAmount={data.run.contributionAmountCad || 5000} language={language} />
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{pick(language, "资金配置优先级", "Ranked Funding Priorities")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {data.priorities.length > 0 ? (
                <RecommendationPriorityStack language={language} priorities={data.priorities} />
              ) : null}
              {data.priorities.length === 0 ? (
                <EmptyStatePanel
                  title={pick(language, "还没有推荐结果", "No recommendation run is available yet")}
                  text={pick(language, "先保存偏好、导入持仓，再生成第一条资金配置建议。", "Save your preferences, import holdings, then generate the first funding plan.")}
                />
              ) : null}
            </CardContent>
          </Card>
          {data.scenarios.length > 0 ? (
            <ScenarioCompareCard language={language} scenarios={data.scenarios} />
          ) : null}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>{pick(language, "这条建议有多稳", "How reliable this looks")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-[24px] border border-white/55 bg-white/36 p-4 backdrop-blur-md">
                  <div className="flex items-center gap-2 font-medium">
                    <ShieldCheck className="h-4 w-4 text-[color:var(--success)]" />
                    {pick(language, `系统把握度：${data.engine.confidence}`, `Confidence: ${data.engine.confidence}`)}
                  </div>
                  <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
                    {pick(language, "这个分数只是告诉你：系统觉得这条建议现在有多站得住脚。它不是收益保证，也不是必须照做的命令。", "This reflects how solid the current recommendation looks. It is not a return guarantee or an execution command.")}
                  </p>
                </div>
                {data.notes.map((note) => (
                  <div key={note} className="rounded-[24px] border border-white/55 bg-white/34 p-4 text-sm leading-7 text-[color:var(--muted-foreground)] backdrop-blur-md">
                    {note}
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>{pick(language, "看完以后做什么", "What to do next")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <ActionRow label={pick(language, "回组合页对照着看", "Review this in portfolio")} href="/portfolio" />
                <ActionRow label={pick(language, "如果不满意，就去改偏好", "Adjust your preferences")} href="/settings" />
                <ActionRow label={pick(language, "回首页看整体变化", "Back to the dashboard")} href="/dashboard" />
              </CardContent>
            </Card>
          </div>
          <Card className="border-white/55 bg-[linear-gradient(135deg,rgba(240,143,178,0.14),rgba(111,141,246,0.1),rgba(255,255,255,0.26))]">
            <CardContent className="flex items-center justify-between gap-4 px-6 py-5">
              <div className="flex items-start gap-3">
                <Info className="mt-0.5 h-5 w-5 text-[color:var(--primary)]" />
                <p className="text-sm text-[color:var(--muted-foreground)]">
                  {pick(language, "这页是在帮你把下一笔钱怎么投想清楚，不是在替你自动下单。你可以先看懂，再决定要不要照着做。", "This page helps you think through the next contribution. It does not trade automatically for you.")}
                </p>
              </div>
              <Button href="/portfolio" variant="secondary">
                {pick(language, "前往组合页复核", "Review in portfolio")}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

function ActionRow({ label, href }: { label: string; href: Route }) {
  return (
    <Button href={href} variant="ghost" className="w-full justify-between">
      {label}
      <ArrowRight className="h-4 w-4" />
    </Button>
  );
}

function RecommendationSignal({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-[24px] border border-white/55 bg-white/44 p-4 backdrop-blur-md">
      <p className="text-sm font-medium text-[color:var(--muted-foreground)]">{title}</p>
      <p className="mt-3 text-base font-semibold text-[color:var(--foreground)]">{detail}</p>
    </div>
  );
}
