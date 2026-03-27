import type { Route } from "next";
import { ArrowRight, Info, ShieldCheck } from "lucide-react";
import { requireViewer } from "@/lib/auth/session";
import { getRecommendationView } from "@/lib/backend/services";
import { AppShell } from "@/components/layout/app-shell";
import { RecommendationRunPanel } from "@/components/recommendations/recommendation-run-panel";
import { StickyRail } from "@/components/layout/sticky-rail";
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
  const confidenceReasons = [
    ...data.explainer.slice(0, 2),
    pick(
      language,
      `当前系统把握度是 ${data.engine.confidence}。你可以把它理解成：这条建议和你现在的目标、账户和限制大体是对得上的。`,
      `Current confidence is ${data.engine.confidence}. Read that as: this path still lines up with your goals, accounts, and active constraints reasonably well.`
    )
  ];
  const confidenceWatchouts = [
    pick(
      language,
      "这不是收益保证。它只是告诉你：按当前信息来看，这条路比较说得通。",
      "This is not a return guarantee. It only means the path looks reasonable given what the system knows now."
    ),
    ...data.notes
  ];

  return (
    <AppShell
      viewer={viewer}
      title={pick(language, "Loo皇藏宝路线", "Recommendations")}
      description={pick(language, "这里把 Loo皇审核下一笔钱怎么走的理由摊开给你看。输入、账户顺序和提醒都会一起摆出来。", "This page carries the full funding path. Inputs, rationale, account placement, and risk notes stay visible.")}
    >
      <Card className="overflow-hidden bg-[linear-gradient(135deg,rgba(255,255,255,0.68),rgba(246,218,230,0.52),rgba(221,232,255,0.46))]">
        <CardContent className="grid gap-6 px-6 py-6 md:grid-cols-[1.2fr_0.8fr] md:items-center">
          <div className="space-y-4">
            <Badge variant="primary">{pick(language, "Loo皇审核台", "Recommendation desk")}</Badge>
            <div className="space-y-3">
              <h2 className="text-[30px] font-semibold tracking-[-0.04em] text-[color:var(--foreground)]">
                {pick(language, "先把条件摆在台面上，再看 Loo皇想让下一笔钱怎么走。", "Show the assumptions first, then decide where the next contribution should go.")}
              </h2>
              <p className="max-w-3xl text-sm leading-7 text-[color:var(--muted-foreground)]">
                {pick(language, "这里不玩黑箱。目标配置、账户顺序、备选标的和 Loo皇的审核理由都会一起摆出来，方便你自己判断值不值得照做。", "This surface avoids black-box output. Target allocation, account order, ticker candidates, and rationale stay visible so you can judge the plan directly.")}
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <RecommendationSignal title={pick(language, "Loo皇先看什么", "Inputs")} detail={pick(language, "你的目标、账户、投入金额和偏好。", "Targets, accounts, amount, and preferences")} />
            <RecommendationSignal title={pick(language, "Loo皇最后会告诉你什么", "Outputs")} detail={pick(language, "先买哪类资产、放哪个账户、为什么这么做。", "Asset priorities, account fit, and rationale")} />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[390px_minmax(0,1fr)] 2xl:grid-cols-[420px_minmax(0,1fr)]">
        <StickyRail>
          <SectionHeading
            title={pick(language, "这次 Loo皇是按什么看的", "What this recommendation is based on")}
            description={pick(language, "先把你现在的偏好、账户顺序和投入金额摆出来，这样你更容易看懂 Loo皇为什么这么分配。", "Show the current preferences, account order, and amount first so the recommendation is easier to understand.")}
          />
          <Card>
            <CardContent className="space-y-3 px-6 py-5">
              <p className="text-sm font-semibold text-[color:var(--foreground)]">
                {pick(language, "第一次看这页，先看这三块", "If this is your first pass, start with these three")}
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  pick(language, "先看这次准备投多少钱。", "Start with the amount you plan to invest."),
                  pick(language, "再看 Loo皇先让你补哪一类资产。", "Then check which sleeve the system wants to top up first."),
                  pick(language, "最后看 Loo皇为什么点这条路、哪些地方还要你自己判断。", "Finish by reading why this path won and what still needs your judgment.")
                ].map((tip) => (
                  <div key={tip} className="rounded-[20px] border border-white/55 bg-white/34 p-4 text-sm leading-7 text-[color:var(--muted-foreground)] backdrop-blur-md">
                    {tip}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
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
                  <div
                    key={input.label}
                    className={
                      input.tone === "warning"
                        ? "rounded-[24px] border border-[rgba(240,166,121,0.32)] bg-[linear-gradient(135deg,rgba(255,255,255,0.78),rgba(255,239,224,0.46),rgba(255,255,255,0.38))] p-4 backdrop-blur-md"
                        : input.tone === "muted"
                          ? "rounded-[24px] border border-white/45 bg-white/24 p-4 opacity-80 backdrop-blur-md"
                          : "rounded-[24px] border border-white/55 bg-white/34 p-4 backdrop-blur-md"
                    }
                  >
                    <p className="text-sm text-[color:var(--muted-foreground)]">{input.label}</p>
                    <p className="mt-2 font-semibold">{input.value}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{pick(language, "Loo皇大致怎么想", "How the system is thinking")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-[24px] border border-white/55 bg-white/34 p-4 backdrop-blur-md">
                  <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">{pick(language, "现在用的是哪套规则", "Which rule set is being used")}</p>
                  <p className="mt-2 font-semibold">{data.engine.version}</p>
                </div>
                <div className="rounded-[24px] border border-white/55 bg-white/34 p-4 backdrop-blur-md">
                  <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">{pick(language, "这次 Loo皇先想补什么", "What the system is fixing first")}</p>
                  <p className="mt-2 font-semibold">{data.engine.objective}</p>
                </div>
                <div className="rounded-[24px] border border-white/55 bg-white/34 p-4 backdrop-blur-md">
                  <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">{pick(language, "这条路现在有多站得住", "How reasonable this path looks right now")}</p>
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
        </StickyRail>

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
                <CardTitle>{pick(language, "这条路有多站得住", "How reliable this looks")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-[24px] border border-white/55 bg-white/36 p-4 backdrop-blur-md">
                  <div className="flex items-center gap-2 font-medium">
                    <ShieldCheck className="h-4 w-4 text-[color:var(--success)]" />
                    {pick(language, `Loo皇当前把握度：${data.engine.confidence}`, `Confidence: ${data.engine.confidence}`)}
                  </div>
                  <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
                    {pick(language, "这个数字只是在说：按你现在给的信息，Loo皇觉得这条路大体说得通。它不是收益保证，也不是必须照做的命令。", "This only means the recommendation broadly makes sense given the information available today. It is not a return guarantee or an execution command.")}
                  </p>
                </div>
                <div className="rounded-[24px] border border-white/55 bg-white/34 p-4 backdrop-blur-md">
                  <p className="text-sm font-semibold text-[color:var(--foreground)]">
                    {pick(language, "为什么 Loo皇觉得这条路还算站得住", "Why the system thinks this path is reasonably solid")}
                  </p>
                  <div className="mt-3 space-y-3">
                    {confidenceReasons.map((reason) => (
                      <div key={reason} className="rounded-[20px] border border-white/55 bg-white/42 p-4 text-sm leading-7 text-[color:var(--muted-foreground)]">
                        {reason}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-[24px] border border-[rgba(240,143,178,0.22)] bg-[linear-gradient(135deg,rgba(255,255,255,0.78),rgba(245,214,235,0.26),rgba(255,239,224,0.2))] p-4 backdrop-blur-md">
                  <p className="text-sm font-semibold text-[color:var(--foreground)]">
                    {pick(language, "哪些地方 Loo皇还要你自己再判断", "What still needs your own judgment")}
                  </p>
                  <div className="mt-3 space-y-3">
                    {confidenceWatchouts.map((note) => (
                      <div key={note} className="rounded-[20px] border border-white/55 bg-white/46 p-4 text-sm leading-7 text-[color:var(--muted-foreground)]">
                        {note}
                      </div>
                    ))}
                  </div>
                </div>
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
                  {pick(language, "这页是在帮你看懂 Loo皇为什么这样审核下一笔钱，不是在替你自动下单。你可以先看明白，再决定要不要照着做。", "This page helps you think through the next contribution. It does not trade automatically for you.")}
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
