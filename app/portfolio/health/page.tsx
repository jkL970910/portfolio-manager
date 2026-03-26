import { ArrowLeft, ArrowRight } from "lucide-react";
import { requireViewer } from "@/lib/auth/session";
import { getPortfolioView } from "@/lib/backend/services";
import { AppShell } from "@/components/layout/app-shell";
import { RadarPreviewCard } from "@/components/charts/radar-preview";
import { HealthDimensionCard } from "@/components/portfolio/health-dimension-card";
import { HealthActionQueue } from "@/components/portfolio/health-action-queue";
import { HealthDrilldownCard } from "@/components/portfolio/health-drilldown-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/section-heading";
import { pick } from "@/lib/i18n/ui";

export default async function PortfolioHealthPage({
  searchParams
}: {
  searchParams?: Promise<{ account?: string }>;
}) {
  const viewer = await requireViewer();
  const language = viewer.displayLanguage;
  const { data } = await getPortfolioView(viewer.id);
  const filters = (await searchParams) ?? {};
  const activeAccount = filters.account ? data.accountContexts.find((account) => account.id === filters.account) ?? null : null;
  const health = activeAccount?.healthDetail ?? data.healthScore;
  const backHref = activeAccount ? `/portfolio?account=${activeAccount.id}` : "/portfolio";

  return (
    <AppShell
      viewer={viewer}
      title={activeAccount ? pick(language, `${activeAccount.name} 哪里需要先修`, `${activeAccount.name} health`) : pick(language, "组合哪里需要先修", "Portfolio health")}
      description={activeAccount
        ? pick(language, "这一页只看当前账户，不再看整个组合。先看这个账户自己哪里失衡，再决定要不要继续加钱。", "This page is focused on the current account only. See what is out of shape here before deciding whether to keep funding it.")
        : pick(language, "这一页把组合问题拆开讲清楚，帮你判断下一步先修哪里。", "This page breaks the portfolio into clear problem areas so you can decide what to fix first.")}
    >
      <Card className="overflow-hidden bg-[linear-gradient(135deg,rgba(255,255,255,0.68),rgba(246,218,230,0.52),rgba(221,232,255,0.46))]">
        <CardContent className="grid gap-6 px-6 py-6 md:grid-cols-[1.1fr_0.9fr] md:items-center">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Button href={backHref} variant="secondary" leadingIcon={<ArrowLeft className="h-4 w-4" />}>
                {pick(language, "返回组合页", "Back to portfolio")}
              </Button>
              <div className="inline-flex rounded-full border border-white/60 bg-white/44 px-4 py-2 text-sm font-medium text-[color:var(--foreground)] backdrop-blur-md">
                {activeAccount ? pick(language, "账户问题总览", "Account health overview") : pick(language, "组合问题总览", "Portfolio health overview")}
              </div>
            </div>
            <div className="space-y-3">
              <h2 className="text-[30px] font-semibold tracking-[-0.04em] text-[color:var(--foreground)]">
                {activeAccount
                  ? pick(language, `先看 ${activeAccount.name} 现在哪里最不顺，再决定要不要继续往这里加钱。`, `See what is most out of shape inside ${activeAccount.name} before adding more money here.`)
                  : pick(language, "先看组合哪里失衡，再决定推荐值不值得执行。", "Inspect what is out of shape before deciding whether the recommendation path is worth following.")}
              </h2>
              <p className="max-w-3xl text-sm leading-7 text-[color:var(--muted-foreground)]">
                {activeAccount
                  ? pick(language, "这里不会再把别的账户混在一起。你看到的分数、问题和下一步动作，都是只针对这个账户。", "Nothing else is mixed in here. The score, problems, and next actions on this page are all specific to this account.")
                  : pick(language, "这里不是只给一个分数，而是直接告诉你：问题在哪、如果先不管会怎样、下一步先修什么。", "This page does not stop at a score. It tells you what is off, what happens if you ignore it, and what to fix first.")}
              </p>
            </div>
          </div>
          <RadarPreviewCard
            title={activeAccount ? pick(language, `${activeAccount.name} 现在大概是什么状态`, `How ${activeAccount.name} looks right now`) : pick(language, "现在整体大概是什么状态", "Current overall shape")}
            status={`${health.score}/100 · ${health.status}`}
            description={pick(
              language,
              `你现在最稳的一块是 ${health.strongestDimension}，最该先修的是 ${health.weakestDimension}。`,
              `Your strongest area is ${health.strongestDimension}, and the first one to fix is ${health.weakestDimension}.`
            )}
            data={health.radar}
            href={backHref}
            ctaLabel={pick(language, "返回组合页", "Back to portfolio")}
          />
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-6">
          <SectionHeading
            title={pick(language, "先看整体，再看先做什么", "Overall picture and next actions")}
            description={pick(language, "先确认整体状态，再从最值得先做的几件事开始。", "Start with the overall state, then work through the actions that matter most.")}
          />
          <Card>
            <CardContent className="grid gap-4 px-6 py-6 sm:grid-cols-2">
              <div className="rounded-[24px] border border-white/55 bg-white/38 p-5 backdrop-blur-md">
                <p className="text-sm text-[color:var(--muted-foreground)]">{pick(language, "整体状态", "Overall state")}</p>
                <p className="mt-2 text-4xl font-semibold text-[color:var(--foreground)]">{health.score}</p>
                <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">{health.status}</p>
              </div>
              <div className="rounded-[24px] border border-white/55 bg-white/38 p-5 backdrop-blur-md">
                <p className="text-sm text-[color:var(--muted-foreground)]">{pick(language, "现在最该先修哪一块", "First area to fix")}</p>
                <p className="mt-2 text-lg font-semibold text-[color:var(--foreground)]">{health.weakestDimension}</p>
                <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
                  {pick(language, "先把这一块拉回来，后面其它问题会更好处理。", "Bring this back first and the rest becomes easier to manage.")}
                </p>
              </div>
            </CardContent>
          </Card>
          <HealthActionQueue title={pick(language, "优先行动队列", "Priority action queue")} items={health.actionQueue} />
          <Card>
            <CardContent className="space-y-3 px-6 py-6">
              {health.highlights.map((highlight, index) => (
                <div key={`health-highlight-${index}`} className="rounded-[24px] border border-white/55 bg-white/36 p-4 text-sm leading-7 text-[color:var(--muted-foreground)] backdrop-blur-md">
                  {highlight}
                </div>
              ))}
              <Button href="/recommendations" className="w-full" trailingIcon={<ArrowRight className="h-4 w-4" />}>
                {activeAccount ? pick(language, "带着这个账户的问题去看推荐页", "Take this account context into recommendations") : pick(language, "带着这些问题去看推荐页", "Take these problems into recommendations")}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <SectionHeading
            title={pick(language, "把问题一块块拆开看", "Break the problem down")}
            description={pick(language, "每张卡都会告诉你：问题在哪、如果不管会怎样、下一步先做什么。", "Each card explains what is off, what happens if you leave it alone, and what to do next.")}
          />
          {health.dimensions.map((dimension) => (
            <HealthDimensionCard
              key={dimension.id}
              dimension={dimension}
              summaryLabel={pick(language, "一句话理解", "Plain-language summary")}
              driversLabel={pick(language, "问题在哪里", "What is driving this")}
              consequencesLabel={pick(language, "如果不处理", "If you leave it alone")}
              actionsLabel={pick(language, "现在先做什么", "What to do next")}
            />
          ))}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <HealthDrilldownCard
          title={pick(language, "按账户拆开看", "Account drill-down")}
          description={pick(language, "这里不是让你检查每个账号，而是先看哪一类账户最容易把组合带偏。", "This section shows which account type is most likely to pull the portfolio off course.")}
          items={health.accountDrilldown}
          openLabel={pick(language, "去组合页看看", "See it in portfolio")}
          driversLabel={pick(language, "先看这些事实", "What the system sees")}
          actionsLabel={pick(language, "现在先做这些", "What to do first")}
          scenarioLabel={pick(language, "如果下一笔投这么多（规划基准 CAD）", "If the next contribution is this size (planning-base CAD)")}
        />
        <HealthDrilldownCard
          title={pick(language, "按持仓拆开看", "Holding drill-down")}
          description={pick(language, "这里不是看涨跌，而是看哪笔仓位最容易让整个组合变得更偏。", "This section focuses on which holding can skew the portfolio most, not which one moved the most.")}
          items={health.holdingDrilldown}
          openLabel={pick(language, "打开这笔持仓详情", "Open holding detail")}
          driversLabel={pick(language, "先看这些事实", "What the system sees")}
          actionsLabel={pick(language, "现在先做这些", "What to do first")}
          scenarioLabel={pick(language, "如果下一笔投这么多（规划基准 CAD）", "If the next contribution is this size (planning-base CAD)")}
        />
      </div>
    </AppShell>
  );
}
