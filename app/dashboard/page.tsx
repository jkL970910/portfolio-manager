import {
  AlertTriangle,
  ArrowRight,
  CircleDollarSign,
  MoveUpRight,
  ShieldCheck,
  TrendingUp
} from "lucide-react";
import Link from "next/link";
import { requireViewer } from "@/lib/auth/session";
import { getDashboardView } from "@/lib/backend/services";
import { AppShell } from "@/components/layout/app-shell";
import { MascotAsset } from "@/components/brand/mascot-asset";
import { RecommendationSummaryCard } from "@/components/dashboard/recommendation-summary-card";
import { DonutChartCard } from "@/components/charts/donut-chart";
import { LineChartCard } from "@/components/charts/line-chart";
import { RadarPreviewCard } from "@/components/charts/radar-preview";
import { SecurityMark } from "@/components/portfolio/security-mark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric-card";
import { SectionHeading } from "@/components/ui/section-heading";
import { StatBlock } from "@/components/ui/stat-block";
import { pick } from "@/lib/i18n/ui";

export default async function DashboardPage() {
  const viewer = await requireViewer();
  const language = viewer.displayLanguage;
  const { data } = await getDashboardView(viewer.id);
  const hasRecommendationRun = !data.recommendation.theme.startsWith("Complete import");
  const recommendationAlertTitle = hasRecommendationRun
    ? pick(language, "有几处值得先看", "A few things are worth looking at first")
    : pick(language, "还没有下一步建议", "No next-step recommendation yet");
  const recommendationAlertDetail = hasRecommendationRun
    ? pick(language, "系统看到你的组合里有几个缺口，下一笔钱先补哪里会更清楚。", "The system sees a few gaps in the portfolio and can now point to where new money likely helps most.")
    : pick(language, "先把持仓和偏好补齐，系统才能告诉你下一笔钱更适合先放哪里。", "Import holdings and save your preferences before the system can suggest where the next contribution should go.");

  return (
    <AppShell
      viewer={viewer}
      title={pick(language, "宝库总览", "Dashboard")}
      description={pick(language, "先看全局，再决定下一笔钱。这里汇总账户状态、组合偏离、消费节奏和当前藏宝路线。", "Start with the overview, then decide where the next contribution should go. This page brings together account status, allocation drift, spending rhythm, and the current recommendation path.")}
    >
      <Card className="overflow-hidden bg-[linear-gradient(135deg,rgba(255,255,255,0.72),rgba(248,223,233,0.56),rgba(224,235,255,0.5))] before:bg-[linear-gradient(180deg,rgba(255,255,255,0.48),rgba(255,255,255,0.12)_38%,rgba(255,255,255,0.02)_100%)]">
        <CardContent className="grid gap-6 px-6 py-6 md:grid-cols-[1.1fr_0.9fr] md:items-center">
          <div className="relative space-y-4">
            <div className="pointer-events-none absolute -left-16 top-[-72px] h-48 w-48 rounded-full bg-[radial-gradient(circle,rgba(240,143,178,0.22),rgba(240,143,178,0))] blur-2xl" />
            <div className="pointer-events-none absolute left-1/2 top-[-96px] h-44 w-44 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.34),rgba(255,255,255,0))] blur-2xl" />
            <Badge variant="primary">{pick(language, "Loo 的今日宝库巡检", "Daily portfolio check")}</Badge>
            <div className="space-y-3">
              <h2 className="text-[30px] font-semibold tracking-[-0.04em] text-[color:var(--foreground)]">
                {pick(language, "先看现在是什么情况，再决定下一笔钱往哪放。", "First see what is going on, then decide where the next dollar should go.")}
              </h2>
              <p className="max-w-3xl text-sm leading-7 text-[color:var(--muted-foreground)]">
                {pick(language, "这一页只放最重要的概览，不把细节全堆进来。你会先看到组合哪里偏了、账户还有多少空间、最近花钱节奏怎样，以及系统为什么开始偏向某条建议。", "This page keeps only the most important overview in view. You see where the portfolio is off target, how much room is left, how spending has been going, and why the system is leaning toward a certain suggestion.")}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button href="/recommendations" trailingIcon={<ArrowRight className="h-4 w-4" />}>
                打开藏宝路线
              </Button>
              <Button href="/import" variant="secondary">
                更新宝库数据
              </Button>
            </div>
          </div>
          <div className="relative grid gap-4 md:grid-cols-[240px_1fr] md:items-center">
            <div className="pointer-events-none absolute bottom-[-52px] right-[-28px] h-44 w-44 rounded-full bg-[radial-gradient(circle,rgba(139,168,255,0.18),rgba(139,168,255,0))] blur-2xl" />
            <div className="flex justify-center md:justify-start">
              <div className="space-y-3 pt-8">
                <MascotAsset name="dashboardSmirk" className="h-[220px] w-[200px]" sizes="200px" />
                <div className="max-w-[220px] rounded-[22px] border border-white/62 bg-[linear-gradient(180deg,rgba(255,255,255,0.78),rgba(255,248,251,0.64))] px-4 py-3 text-sm font-medium leading-6 text-[color:var(--foreground)] shadow-[0_14px_30px_rgba(110,103,130,0.07)] backdrop-blur-xl">
                  {hasRecommendationRun
                    ? pick(language, "今天先把最大的缺口补上，别急着追热点。", "Today, start with the biggest gap instead of chasing whatever looks hot.")
                    : pick(language, "先把数据和偏好补齐，下一步该怎么投才会更清楚。", "Fill in the data and preferences first so the next step becomes clearer.")}
                </div>
              </div>
            </div>
            <div className="grid gap-3">
              <WelcomeSignal title={pick(language, "今天先看这个", "Start here")} detail={hasRecommendationRun ? pick(language, "先补最明显的配置缺口", "Fill the clearest allocation gap first") : pick(language, "先完成导入和偏好设置", "Finish import and preferences first")} icon={<ShieldCheck className="h-4 w-4" />} />
              <WelcomeSignal title={pick(language, "节奏提醒", "Money rhythm")} detail={data.savingsPattern} icon={<TrendingUp className="h-4 w-4" />} />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {data.metrics.slice(0, 3).map((metric) => (
          <MetricCard key={metric.label} label={metric.label} value={metric.value} detail={metric.detail} icon={getMetricIcon(metric.label)} />
        ))}
        <RadarPreviewCard
          title={pick(language, "组合现在大概稳不稳", "How stable the portfolio looks right now")}
          status={`${data.healthScore.score}/100 · ${data.healthScore.status}`}
          description={pick(
            language,
            `现在做得最好的是 ${data.healthScore.strongestDimension}，最需要先修的是 ${data.healthScore.weakestDimension}。`,
            `Best area right now: ${data.healthScore.strongestDimension}. The area that needs attention first: ${data.healthScore.weakestDimension}.`
          )}
          data={data.healthPreview}
          href="/portfolio/health"
          ctaLabel={pick(language, "去看组合哪里需要先修", "See what needs attention first")}
        />
      </div>

      <Card className="border-white/50 bg-[linear-gradient(135deg,rgba(240,143,178,0.18),rgba(111,141,246,0.1),rgba(255,255,255,0.28))]">
        <CardContent className="flex flex-col gap-4 px-6 py-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-[color:var(--primary)]" />
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-semibold text-[color:var(--foreground)]">{recommendationAlertTitle}</span>
              <span className="text-[color:var(--muted-foreground)]">- {recommendationAlertDetail}</span>
            </div>
          </div>
          <Button href="/recommendations" variant="ghost" className="justify-start px-0 py-0 text-[color:var(--primary)] md:justify-end">
            {pick(language, "查看推荐", "View recommendations")} <ArrowRight className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <SectionHeading
          title={pick(language, "组合概览", "Portfolio overview")}
          description={pick(language, "先看账户里有多少钱、哪些资产偏了、哪些仓位最重，再决定要不要进入更深分析。", "Start with how the money is spread, which sleeves are off target, and which positions are doing most of the driving before opening deeper analysis.")}
        />
          <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle>{pick(language, "你的账户", "Your Accounts")}</CardTitle>
                <Button href="/portfolio" variant="ghost" className="h-auto px-0 py-0 text-[13px] text-[color:var(--primary)]">
                  {pick(language, "查看详情", "View details")} <MoveUpRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {data.accounts.map((account) => (
                <Link
                  key={account.id}
                  href={account.href}
                  className="group flex items-center justify-between rounded-[24px] border border-white/55 bg-white/36 p-4 backdrop-blur-md transition-[transform,background-color,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:scale-[1.01] hover:border-white/72 hover:bg-white/48 hover:shadow-[0_18px_34px_rgba(110,103,130,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{account.name}</p>
                      <span className="text-xs text-[color:var(--muted-foreground)]">- {account.caption}</span>
                    </div>
                    <p className="mt-1 text-[13px] text-[color:var(--muted-foreground)]">{account.room}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold">{account.value}</p>
                    <div className="mt-2 inline-flex items-center gap-2">
                      <Badge variant={account.badgeVariant}>{account.badge}</Badge>
                      <MoveUpRight className="h-3.5 w-3.5 text-[color:var(--muted-foreground)] transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                    </div>
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle>{pick(language, "哪些地方偏离目标最多", "Where the portfolio is furthest from target")}</CardTitle>
                <Button href="/portfolio" variant="ghost" className="h-auto px-0 py-0 text-[13px] text-[color:var(--primary)]">
                  {pick(language, "看完整拆解", "See the full breakdown")} <MoveUpRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.drift.map((item) => (
                <div key={item.assetClass} className="rounded-[24px] border border-white/55 bg-white/34 p-4 backdrop-blur-md">
                  <div className="flex items-center justify-between text-sm">
                    <p className="font-medium">{item.assetClass}</p>
                    <Badge variant={item.delta.startsWith("-") ? "warning" : "success"}>{item.delta}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">{pick(language, `当前 ${item.current}，目标 ${item.target}`, `Current ${item.current} vs target ${item.target}`)}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <DonutChartCard title={pick(language, "钱现在大致放在哪里", "Where the money roughly sits today")} description={pick(language, "先看你现在的资产分布，再理解系统为什么偏向某条建议。", "See the current mix first, then it becomes easier to understand why the system leans toward a specific path.")} data={data.assetMix} />
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle>{pick(language, "核心持仓", "Top Holdings")}</CardTitle>
                <Button href="/portfolio" variant="ghost" className="h-auto px-0 py-0 text-[13px] text-[color:var(--primary)]">
                  {pick(language, "查看全部", "View all")} <MoveUpRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.topHoldings.map((holding) => (
                <div
                  key={holding.id}
                  className="flex items-center justify-between gap-4 rounded-[24px] border border-white/55 bg-white/36 p-4 backdrop-blur-md"
                >
                  <div className="flex items-start gap-3">
                    <SecurityMark symbol={holding.symbol} />
                    <div>
                      <p className="font-medium">
                        {holding.symbol}
                        {holding.name.trim().toUpperCase() === holding.symbol.trim().toUpperCase() ? null : (
                          <span className="text-sm text-[color:var(--muted-foreground)]"> {holding.name}</span>
                        )}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <Link
                          href={holding.href}
                          className="group inline-flex items-center gap-1 rounded-full border border-white/72 bg-white/74 px-3 py-1.5 text-xs font-medium text-[color:var(--primary)] transition-[background-color,border-color,box-shadow] duration-200 hover:border-white hover:bg-white hover:shadow-[0_10px_20px_rgba(110,103,130,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]"
                        >
                          {pick(language, "持仓详情", "Holding detail")}
                          <MoveUpRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                        </Link>
                        <Link
                          href={holding.securityHref}
                          className="inline-flex items-center rounded-full border border-[rgba(240,143,178,0.35)] bg-[rgba(255,255,255,0.72)] px-3 py-1.5 text-xs font-medium text-[color:var(--foreground)] transition-[background-color,border-color] duration-200 hover:border-[rgba(240,143,178,0.55)] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]"
                        >
                          {pick(language, "标的资料", "Security page")}
                        </Link>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-[color:var(--muted-foreground)]">
                        <span>{holding.account}</span>
                        <span>-</span>
                        <span>{holding.lastPrice}</span>
                        <Badge variant={holding.freshnessVariant}>
                          {holding.freshnessVariant === "success"
                            ? pick(language, "新鲜", "Fresh")
                            : holding.freshnessVariant === "warning"
                              ? pick(language, "偏旧", "Aging")
                              : pick(language, "未知", "Unknown")}
                        </Badge>
                      </div>
                      <p className="mt-1 text-[13px] text-[color:var(--muted-foreground)]">{holding.lastUpdated}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{holding.weight}</p>
                    <p className="text-sm text-[color:var(--muted-foreground)]">{pick(language, "约占整个组合", "Of total portfolio")}</p>
                    <p className="text-sm text-[color:var(--muted-foreground)]">{holding.value}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <LineChartCard title={pick(language, "净资产走势", "Net Worth Trend")} description={pick(language, "过去 6 个月的增长轨迹。", "6-month growth trajectory")} data={data.netWorthTrend} dataKey="value" color="#f08fb2" />
          <Card>
            <CardHeader>
              <CardTitle>{pick(language, "月度消费快照", "Monthly Spending Snapshot")}</CardTitle>
              <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">{data.spendingMonthLabel}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <StatBlock icon={<CircleDollarSign className="h-4 w-4" />} label={pick(language, "最高消费分类", "Top Spending Category")} value={data.spendingCategories[0]?.value ?? "$0"} />
                <StatBlock icon={<TrendingUp className="h-4 w-4" />} label={pick(language, "储蓄节奏", "Savings Pattern")} value={data.savingsPattern} />
              </div>
              <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
                <div className="space-y-2 rounded-[24px] border border-white/55 bg-white/34 p-4 backdrop-blur-md">
                  <p className="text-sm font-medium">{pick(language, "主要分类", "Top Categories")}</p>
                  {data.spendingCategories.map((category) => (
                    <div key={category.name} className="flex items-center justify-between text-sm text-[color:var(--muted-foreground)]">
                      <span>{category.name}</span>
                      <span>{category.value}</span>
                    </div>
                  ))}
                </div>
                <div className="rounded-[24px] border border-white/55 bg-white/34 px-5 py-4 backdrop-blur-md lg:min-w-[180px]">
                  <p className="text-sm text-[color:var(--muted-foreground)]">{pick(language, "可投入现金", "Investable Cash")}</p>
                  <p className="mt-2 text-2xl font-semibold">{data.investableCash}</p>
                  <p className="mt-1 text-[13px] text-[color:var(--muted-foreground)]">{pick(language, "收入减去消费", "Income minus spending")}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        <Card>
            <CardHeader>
              <CardTitle>{pick(language, "一句话看组合问题", "Quick read on the portfolio")}</CardTitle>
            </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            {data.healthScore.highlights.map((highlight) => (
              <div key={highlight} className="rounded-[24px] border border-white/55 bg-white/34 p-4 text-sm text-[color:var(--muted-foreground)] backdrop-blur-md">
                {highlight}
              </div>
            ))}
          </CardContent>
        </Card>
        <RecommendationSummaryCard
          language={language}
          title={pick(language, "推荐摘要", "Recommendation Summary")}
          subtitle={data.recommendation.subtitle}
          theme={data.recommendation.theme}
          reason={data.recommendation.reason}
          signals={data.recommendation.signals}
          emphasized={hasRecommendationRun}
        />
      </div>
    </AppShell>
  );
}

function WelcomeSignal({ title, detail, icon }: { title: string; detail: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-[24px] border border-white/62 bg-[linear-gradient(180deg,rgba(255,255,255,0.62),rgba(255,250,252,0.34))] p-4 shadow-[0_14px_30px_rgba(110,103,130,0.06)] backdrop-blur-xl">
      <div className="flex items-center gap-2 text-sm font-medium text-[color:var(--muted-foreground)]">
        <span className="text-[color:var(--primary)]">{icon}</span>
        {title}
      </div>
      <p className="mt-3 text-base font-semibold text-[color:var(--foreground)]">{detail}</p>
    </div>
  );
}

function getMetricIcon(label: string) {
  switch (label.toLowerCase()) {
    case "total portfolio":
      return <CircleDollarSign className="h-5 w-5" />;
    case "available room":
      return <ShieldCheck className="h-5 w-5" />;
    case "portfolio risk":
      return <TrendingUp className="h-5 w-5" />;
    default:
      return <TrendingUp className="h-5 w-5" />;
  }
}
