import {
  AlertTriangle,
  ArrowRight,
  CircleDollarSign,
  ExternalLink,
  MoveUpRight,
  ShieldCheck,
  TrendingUp
} from "lucide-react";
import { requireViewer } from "@/lib/auth/session";
import { getDashboardView } from "@/lib/backend/services";
import { AppShell } from "@/components/layout/app-shell";
import { RecommendationSummaryCard } from "@/components/dashboard/recommendation-summary-card";
import { DonutChartCard } from "@/components/charts/donut-chart";
import { LineChartCard } from "@/components/charts/line-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric-card";
import { SectionHeading } from "@/components/ui/section-heading";
import { StatBlock } from "@/components/ui/stat-block";

export default async function DashboardPage() {
  const viewer = await requireViewer();
  const { data } = await getDashboardView(viewer.id);
  const hasRecommendationRun = !data.recommendation.theme.startsWith("Complete import");
  const recommendationAlertTitle = hasRecommendationRun ? "3 high-priority recommendations detected" : "No recommendation run yet";
  const recommendationAlertDetail = hasRecommendationRun
    ? "Your portfolio has allocation gaps that should be addressed."
    : "Import holdings and save your preferences to generate the first ranked funding plan.";

  return (
    <AppShell viewer={viewer} title="宝库总览" description="先看全局，再决定下一笔钱。这里汇总账户状态、组合偏离、消费节奏和当前藏宝路线。">
      <Card className="overflow-hidden bg-[linear-gradient(135deg,rgba(255,255,255,0.68),rgba(246,218,230,0.58),rgba(221,232,255,0.5))]">
        <CardContent className="grid gap-6 px-6 py-6 md:grid-cols-[1.25fr_0.75fr] md:items-center">
          <div className="space-y-4">
            <Badge variant="primary">Loo 的今日宝库巡检</Badge>
            <div className="space-y-3">
              <h2 className="text-[30px] font-semibold tracking-[-0.04em] text-[color:var(--foreground)]">
                先看财富温度，再决定下一步配置。
              </h2>
              <p className="max-w-3xl text-sm leading-7 text-[color:var(--muted-foreground)]">
                这一页保留概览，不把细节塞满。组合健康、账户空间、消费节奏和推荐摘要会先告诉你哪里值得先看。
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
          <div className="grid gap-3 sm:grid-cols-2">
            <WelcomeSignal title="今日重点" detail={hasRecommendationRun ? "优先处理配置缺口" : "先完成导入与偏好设置"} icon={<ShieldCheck className="h-4 w-4" />} />
            <WelcomeSignal title="节奏提醒" detail={data.savingsPattern} icon={<TrendingUp className="h-4 w-4" />} />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {data.metrics.slice(0, 3).map((metric) => (
          <MetricCard key={metric.label} label={metric.label} value={metric.value} detail={metric.detail} icon={getMetricIcon(metric.label)} />
        ))}
        <Card className="bg-[linear-gradient(180deg,rgba(255,255,255,0.66),rgba(255,255,255,0.46))]">
          <CardHeader className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">Portfolio Health Score</p>
            <Badge variant="neutral">Coming in P1</Badge>
          </CardHeader>
          <CardContent className="space-y-3 pt-2">
            <div className="grid grid-cols-[96px_1fr] items-center gap-4">
              <div className="flex h-24 w-24 items-center justify-center rounded-full border border-white/55 bg-[radial-gradient(circle_at_center,rgba(240,143,178,0.2),rgba(255,255,255,0.32)_70%)]">
                <div className="relative h-16 w-16">
                  <div className="absolute inset-0 rotate-45 border border-[color:var(--primary)]/35" />
                  <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-[color:var(--primary)]/20" />
                  <div className="absolute top-1/2 h-px w-full -translate-y-1/2 bg-[color:var(--primary)]/20" />
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-[13px] leading-6 text-[color:var(--muted-foreground)]">
                  This score will measure how closely your portfolio matches your target allocation, diversification goals,
                  account efficiency, position concentration, and risk profile.
                </p>
                <Button href="/portfolio" variant="ghost" className="h-auto justify-start px-0 py-0 text-[13px] text-[color:var(--primary)]">
                  Preview in Portfolio <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
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
            View recommendations <ArrowRight className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <SectionHeading
          title="Portfolio overview"
          description="Accounts, allocation drift, and current holdings surface the state of the portfolio before the user opens the deeper analysis pages."
        />
        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle>Your Accounts</CardTitle>
                <Button href="/portfolio" variant="ghost" className="h-auto px-0 py-0 text-[13px] text-[color:var(--primary)]">
                  View details <MoveUpRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {data.accounts.map((account) => (
                <div key={account.name} className="flex items-center justify-between rounded-[24px] border border-white/55 bg-white/36 p-4 backdrop-blur-md">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{account.name}</p>
                      <span className="text-xs text-[color:var(--muted-foreground)]">- {account.caption}</span>
                    </div>
                    <p className="mt-1 text-[13px] text-[color:var(--muted-foreground)]">{account.room}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold">{account.value}</p>
                    <Badge variant={account.badgeVariant}>{account.badge}</Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle>Allocation Drift</CardTitle>
                <Button href="/portfolio" variant="ghost" className="h-auto px-0 py-0 text-[13px] text-[color:var(--primary)]">
                  View full analysis <MoveUpRight className="h-3.5 w-3.5" />
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
                  <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">Current {item.current} vs target {item.target}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <DonutChartCard title="Asset Mix" description="Current allocation split used by the recommendation engine." data={data.assetMix} />
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle>Top Holdings</CardTitle>
                <Button href="/portfolio" variant="ghost" className="h-auto px-0 py-0 text-[13px] text-[color:var(--primary)]">
                  View all <MoveUpRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.topHoldings.map((holding) => (
                <div key={holding.symbol} className="flex items-center justify-between rounded-[24px] border border-white/55 bg-white/36 p-4 backdrop-blur-md">
                  <div>
                    <p className="font-medium">
                      {holding.symbol} <span className="text-sm text-[color:var(--muted-foreground)]">{holding.name}</span>
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-[color:var(--muted-foreground)]">
                      <span>{holding.account}</span>
                      <span>-</span>
                      <span>{holding.lastPrice}</span>
                      <Badge variant={holding.freshnessVariant}>
                        {holding.freshnessVariant === "success" ? "Fresh" : holding.freshnessVariant === "warning" ? "Aging" : "Unknown"}
                      </Badge>
                    </div>
                    <p className="mt-1 text-[13px] text-[color:var(--muted-foreground)]">{holding.lastUpdated}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{holding.weight}</p>
                    <p className="text-sm text-[color:var(--muted-foreground)]">{holding.value}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <LineChartCard title="Net Worth Trend" description="6-month growth trajectory" data={data.netWorthTrend} dataKey="value" color="#f08fb2" />
          <Card>
            <CardHeader>
              <CardTitle>Monthly Spending Snapshot</CardTitle>
              <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">{data.spendingMonthLabel}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <StatBlock icon={<CircleDollarSign className="h-4 w-4" />} label="Top Spending Category" value={data.spendingCategories[0]?.value ?? "$0"} />
                <StatBlock icon={<TrendingUp className="h-4 w-4" />} label="Savings Pattern" value={data.savingsPattern} />
              </div>
              <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
                <div className="space-y-2 rounded-[24px] border border-white/55 bg-white/34 p-4 backdrop-blur-md">
                  <p className="text-sm font-medium">Top Categories</p>
                  {data.spendingCategories.map((category) => (
                    <div key={category.name} className="flex items-center justify-between text-sm text-[color:var(--muted-foreground)]">
                      <span>{category.name}</span>
                      <span>{category.value}</span>
                    </div>
                  ))}
                </div>
                <div className="rounded-[24px] border border-white/55 bg-white/34 px-5 py-4 backdrop-blur-md lg:min-w-[180px]">
                  <p className="text-sm text-[color:var(--muted-foreground)]">Investable Cash</p>
                  <p className="mt-2 text-2xl font-semibold">{data.investableCash}</p>
                  <p className="mt-1 text-[13px] text-[color:var(--muted-foreground)]">Income minus spending</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        <RecommendationSummaryCard
          title="Recommendation Summary"
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
    <div className="rounded-[24px] border border-white/55 bg-white/46 p-4 backdrop-blur-md">
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
