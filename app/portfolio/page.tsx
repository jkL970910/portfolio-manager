import { ArrowRight, BarChart3, CircleGauge, PieChart, ShieldAlert } from "lucide-react";
import { requireViewer } from "@/lib/auth/session";
import { getPortfolioView } from "@/lib/backend/services";
import { AppShell } from "@/components/layout/app-shell";
import { DonutChartCard } from "@/components/charts/donut-chart";
import { LineChartCard } from "@/components/charts/line-chart";
import { RadarPreviewCard } from "@/components/charts/radar-preview";
import { HoldingTable } from "@/components/portfolio/holding-table";
import { QuickActionCard } from "@/components/portfolio/quick-action-card";
import { RefreshPricesPanel } from "@/components/portfolio/refresh-prices-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/section-heading";
import { pick } from "@/lib/i18n/ui";

export default async function PortfolioPage({
  searchParams
}: {
  searchParams?: Promise<{ account?: string; accountType?: string; holding?: string }>;
}) {
  const viewer = await requireViewer();
  const language = viewer.displayLanguage;
  const { data } = await getPortfolioView(viewer.id);
  const filters = (await searchParams) ?? {};
  const filteredHoldings = (filters.holding
    ? data.holdings.filter((holding) => holding.id === filters.holding)
    : filters.accountType
      ? data.holdings.filter((holding) => holding.accountType === filters.accountType)
    : filters.account
      ? data.holdings.filter((holding) => holding.accountId === filters.account)
      : data.holdings)
    .map((holding) => ({
      ...holding,
      highlighted: Boolean(filters.holding || filters.account || filters.accountType),
      highlightLabel: filters.holding
        ? pick(language, "来自健康评分明细的重点持仓", "Highlighted from health detail")
        : filters.accountType
          ? pick(language, "来自健康评分明细的重点账户类别", "Highlighted from health detail")
        : filters.account
          ? pick(language, "来自健康评分明细的重点账户", "Highlighted from health detail")
          : undefined
    }));
  const activeFilterLabel = filters.holding
    ? pick(language, "当前只显示一个重点持仓。", "Currently focused on one holding.")
    : filters.accountType
      ? pick(language, `当前只显示 ${filters.accountType} 这类账户下的持仓。`, `Currently focused on ${filters.accountType} holdings.`)
    : filters.account
      ? pick(language, "当前只显示一个账户下的持仓。", "Currently focused on a single account.")
      : null;
  const activeAccount = filters.account
    ? data.accountAllocation.find((entry) => entry.name === filteredHoldings[0]?.account)
    : filters.holding
      ? data.accountAllocation.find((entry) => entry.name === filteredHoldings[0]?.account)
      : null;

  return (
    <AppShell
      viewer={viewer}
      title={pick(language, "宝库结构", "Portfolio")}
      description={pick(language, "这里把组合拆开给你看：钱放在哪里、哪一块偏得最多、哪几笔仓位最值得先盯住。", "This page breaks the portfolio into plain pieces: where the money sits, what is furthest from target, and which positions are worth watching first.")}
    >
      <Card className="overflow-hidden bg-[linear-gradient(135deg,rgba(255,255,255,0.68),rgba(246,218,230,0.5),rgba(221,232,255,0.44))]">
        <CardContent className="grid gap-6 px-6 py-6 md:grid-cols-[1.2fr_0.8fr] md:items-center">
          <div className="space-y-4">
            <div className="inline-flex rounded-full border border-white/60 bg-white/44 px-4 py-2 text-sm font-medium text-[color:var(--foreground)] backdrop-blur-md">{pick(language, "Loo 帮你拆开看组合", "Loo helps break the portfolio down")}</div>
            <div className="space-y-3">
              <h2 className="text-[30px] font-semibold tracking-[-0.04em] text-[color:var(--foreground)]">
                {pick(language, "先看组合现在长什么样，再决定要不要照着建议走。", "First see what the portfolio looks like, then decide whether the recommendation makes sense.")}
              </h2>
              <p className="max-w-3xl text-sm leading-7 text-[color:var(--muted-foreground)]">
                {pick(language, "这一页会比首页更细。你可以在这里看清楚钱分散得够不够、哪些仓位太重、以及价格是不是有点旧。", "This page is more detailed than the dashboard. Use it to see whether the money is spread out enough, which positions are getting too large, and whether prices are getting stale.")}
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <PortfolioSignal title={pick(language, "先看什么", "What to look at first")} detail={pick(language, "先看仓位会不会太集中、哪类资产配得不够，以及价格是不是太旧。", "Start with concentration, allocation gaps, and whether quotes are stale.")} />
            <PortfolioSignal title={pick(language, "看完以后做什么", "What to do next")} detail={pick(language, "先看清组合，再决定要不要打开配置建议。", "Understand the portfolio first, then decide whether to open funding recommendations.")} />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_320px]">
        <div className="space-y-6">
          <SectionHeading
            title={pick(language, "先看钱放在哪里", "Start with where the money sits")}
            description={pick(language, "先看走势、账户分布和行业暴露，再决定要不要继续往下钻。", "Start with performance, account spread, and sector exposure before drilling deeper.")}
          />
          <LineChartCard title={pick(language, "近 6 个月大概怎么走", "How it has moved over the last 6 months")} description={pick(language, "先看整体是稳着往上，还是波动比较大。", "Use this to see whether the portfolio has been moving steadily or swinging around more than you expected.")} data={data.performance} dataKey="value" color="#152238" />
          <div className="grid gap-4 2xl:grid-cols-2">
            <DonutChartCard
              title={pick(language, "钱分散在什么账户里", "Which accounts currently hold the money")}
              description={pick(language, "先看是不是有某一类账户吃得太重。", "Use this to check whether one account type is carrying too much of the portfolio.")}
              data={data.accountAllocation}
              activeName={activeAccount?.name}
              activeLabel={activeAccount
                ? pick(language, "当前过滤命中账户", "Matched account")
                : undefined}
            />
            <DonutChartCard title={pick(language, "钱现在压在哪些行业上", "Which sectors are carrying the most weight")} description={pick(language, "如果只压在少数行业上，组合会更容易一起涨跌。", "If only a few sectors dominate, the whole portfolio is more likely to swing together.")} data={data.sectorExposure} />
          </div>
          <Card>
            <CardHeader>
              <CardTitle>{pick(language, "持仓明细", "Holdings Detail")}</CardTitle>
            </CardHeader>
            <CardContent>
              {activeFilterLabel ? (
                <div className="mb-4 flex flex-col gap-3 rounded-[24px] border border-white/55 bg-white/38 p-4 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm text-[color:var(--muted-foreground)]">{activeFilterLabel}</p>
                    <p className="text-xs text-[color:var(--muted-foreground)]">
                      {pick(language, "命中的持仓已在表格中高亮显示，方便从健康评分视图回看具体对象。", "Matched holdings are highlighted below so the health detail deep-link stays visually obvious.")}
                    </p>
                  </div>
                  <Button href="/portfolio" variant="secondary">
                    {pick(language, "清除过滤", "Clear filter")}
                  </Button>
                </div>
              ) : null}
              <HoldingTable holdings={filteredHoldings} language={language} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <RadarPreviewCard
            title={pick(language, "组合现在大概稳不稳", "How stable the portfolio looks right now")}
            status={`${data.healthScore.score}/100 · ${data.healthScore.status}`}
            description={pick(
              language,
              `现在做得最好的是 ${data.healthScore.strongestDimension}，最需要先修的是 ${data.healthScore.weakestDimension}。`,
              `Best area right now: ${data.healthScore.strongestDimension}. The area that needs attention first: ${data.healthScore.weakestDimension}.`
            )}
            data={data.healthScore.radar}
            href="/portfolio/health"
            ctaLabel={pick(language, "去看组合哪里需要先修", "See what needs attention first")}
          />
          <Card>
            <CardHeader>
              <CardTitle>{pick(language, "快捷动作", "Quick Actions")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <RefreshPricesPanel
                lastRefreshed={data.quoteStatus.lastRefreshed}
                freshness={data.quoteStatus.freshness}
                coverage={data.quoteStatus.coverage}
              />
              <QuickActionCard icon={<ShieldAlert className="h-4 w-4" />} title={pick(language, "先查是不是太集中", "Check whether the portfolio is too concentrated")} description={pick(language, "如果少数几笔仓位太重，组合会更容易一起涨跌。", "If only a few positions are too heavy, the whole portfolio becomes easier to swing around.")} href="/portfolio/health" />
              <QuickActionCard icon={<PieChart className="h-4 w-4" />} title={pick(language, "看看哪一块最缺", "See which sleeve is furthest from target")} description={pick(language, "先看哪类资产配得还不够，下一笔钱才知道先补哪里。", "See which sleeve is most off target before deciding where the next contribution should go.")} />
              <QuickActionCard icon={<CircleGauge className="h-4 w-4" />} title={pick(language, "看看系统为什么这么建议", "See why the system leans this way")} description={pick(language, "把推荐背后的理由翻成人话，再决定要不要照着走。", "Open the reasoning in plain language before deciding whether to follow it.")} href="/recommendations" />
              <QuickActionCard icon={<BarChart3 className="h-4 w-4" />} title={pick(language, "看看是不是压在少数行业上", "Check whether a few sectors dominate")} description={pick(language, "如果钱只压在少数行业，组合会更容易一起受影响。", "If too much money sits in only a few sectors, the portfolio is more likely to move as one.")} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{pick(language, "看完组合后下一步", "What to open next")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.healthScore.highlights.map((highlight) => (
                <div key={highlight} className="rounded-[24px] border border-white/55 bg-white/38 p-4 text-sm text-[color:var(--muted-foreground)] backdrop-blur-md">
                  {highlight}
                </div>
              ))}
              {data.summaryPoints.map((point) => (
                <div key={point} className="rounded-[24px] border border-white/55 bg-white/38 p-4 text-sm text-[color:var(--muted-foreground)] backdrop-blur-md">
                  {point}
                </div>
              ))}
              <Button href="/recommendations" className="w-full" trailingIcon={<ArrowRight className="h-4 w-4" />}>
                {pick(language, "去看下一笔钱怎么投", "Open funding recommendations")}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

function PortfolioSignal({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-[24px] border border-white/55 bg-white/44 p-4 backdrop-blur-md">
      <p className="text-sm font-medium text-[color:var(--muted-foreground)]">{title}</p>
      <p className="mt-3 text-base font-semibold text-[color:var(--foreground)]">{detail}</p>
    </div>
  );
}
