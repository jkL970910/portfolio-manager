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
import { DonutChartCard } from "@/components/charts/donut-chart";
import { LineChartCard } from "@/components/charts/line-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/section-heading";

export default async function DashboardPage() {
  const viewer = await requireViewer();
  const { data } = await getDashboardView(viewer.id);
  const hasRecommendationRun = !data.recommendation.theme.startsWith("Complete import");
  const recommendationAlertTitle = hasRecommendationRun ? "3 high-priority recommendations detected" : "No recommendation run yet";
  const recommendationAlertDetail = hasRecommendationRun
    ? "Your portfolio has allocation gaps that should be addressed."
    : "Import holdings and save your preferences to generate the first ranked funding plan.";

  return (
    <AppShell viewer={viewer} title="Dashboard" description="Portfolio overview and wealth snapshot">
      <Card>
        <CardContent className="flex flex-col gap-2 px-6 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium">Display currency: {data.displayContext.currency}</p>
            <p className="text-sm text-[color:var(--muted-foreground)]">{data.displayContext.fxNote}</p>
          </div>
          <Badge variant="neutral">{data.displayContext.fxRateLabel}</Badge>
        </CardContent>
      </Card>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {data.metrics.slice(0, 3).map((metric) => (
          <Card key={metric.label}>
            <CardHeader>
              <CardTitle className="text-[13px] font-medium uppercase tracking-[0.14em] text-[color:var(--muted-foreground)]">
                {metric.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-2">
              <p className="text-[34px] font-semibold tracking-tight">{metric.value}</p>
              <p className="text-[13px] leading-5 text-[color:var(--muted-foreground)]">{metric.detail}</p>
            </CardContent>
          </Card>
        ))}
        <Card>
          <CardHeader>
            <CardTitle className="text-[13px] font-medium uppercase tracking-[0.14em] text-[color:var(--muted-foreground)]">
              Portfolio Health Score
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-2">
            <Badge variant="neutral">Coming in P1</Badge>
            <div className="grid grid-cols-[96px_1fr] items-center gap-4">
              <div className="flex h-24 w-24 items-center justify-center rounded-full border border-[color:var(--border)] bg-[radial-gradient(circle_at_center,rgba(25,71,229,0.08),transparent_70%)]">
                <div className="relative h-16 w-16">
                  <div className="absolute inset-0 rotate-45 border border-[color:var(--primary)]/35" />
                  <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-[color:var(--primary)]/20" />
                  <div className="absolute top-1/2 h-px w-full -translate-y-1/2 bg-[color:var(--primary)]/20" />
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-[13px] leading-5 text-[color:var(--muted-foreground)]">
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

      <Card className="border-[color:var(--primary)]/20 bg-[linear-gradient(135deg,rgba(25,71,229,0.08),rgba(25,71,229,0.02))]">
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
                <div key={account.name} className="flex items-center justify-between rounded-2xl border border-[color:var(--border)] p-4">
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
                <div key={item.assetClass} className="rounded-2xl border border-[color:var(--border)] p-4">
                  <div className="flex items-center justify-between text-sm">
                    <p className="font-medium">{item.assetClass}</p>
                    <Badge variant={item.delta.startsWith("-") ? "warning" : "success"}>{item.delta}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
                    Current {item.current} vs target {item.target}
                  </p>
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
                <div key={holding.symbol} className="flex items-center justify-between rounded-2xl border border-[color:var(--border)] p-4">
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
          <LineChartCard title="Net Worth Trend" description="6-month growth trajectory" data={data.netWorthTrend} dataKey="value" color="#1947E5" />
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
                <div className="space-y-2 rounded-2xl border border-[color:var(--border)] p-4">
                  <p className="text-sm font-medium">Top Categories</p>
                  {data.spendingCategories.map((category) => (
                    <div key={category.name} className="flex items-center justify-between text-sm text-[color:var(--muted-foreground)]">
                      <span>{category.name}</span>
                      <span>{category.value}</span>
                    </div>
                  ))}
                </div>
                <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card-muted)] px-5 py-4 lg:min-w-[180px]">
                  <p className="text-sm text-[color:var(--muted-foreground)]">Investable Cash</p>
                  <p className="mt-2 text-2xl font-semibold">{data.investableCash}</p>
                  <p className="mt-1 text-[13px] text-[color:var(--muted-foreground)]">Income minus spending</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle>Recommendation Summary</CardTitle>
                <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">{data.recommendation.subtitle}</p>
              </div>
              <Badge variant={hasRecommendationRun ? "warning" : "neutral"}>{hasRecommendationRun ? "High Priority" : "Next Step"}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card-muted)] p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xl font-semibold">{data.recommendation.theme}</p>
                  <p className="mt-2 max-w-4xl text-sm leading-6 text-[color:var(--muted-foreground)]">{data.recommendation.reason}</p>
                </div>
                <ShieldCheck className="h-5 w-5 text-[color:var(--success)]" />
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {data.recommendation.signals.map((signal) => (
                  <div key={signal} className="rounded-2xl border border-[color:var(--border)] bg-white p-4">
                    <p className="text-sm text-[color:var(--muted-foreground)]">Supporting signal</p>
                    <p className="mt-2 text-sm font-medium">{signal}</p>
                  </div>
                ))}
              </div>
            </div>
            <Button href="/recommendations" className="w-full md:w-auto" trailingIcon={<ArrowRight className="h-4 w-4" />}>
              View Detailed Recommendations
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function StatBlock({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[color:var(--border)] bg-white p-4">
      <div className="flex items-center gap-2 text-sm text-[color:var(--muted-foreground)]">
        {icon}
        {label}
      </div>
      <p className="mt-3 text-2xl font-semibold">{value}</p>
    </div>
  );
}
