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

export default async function PortfolioPage() {
  const viewer = await requireViewer();
  const language = viewer.displayLanguage;
  const { data } = await getPortfolioView(viewer.id);

  return (
    <AppShell
      viewer={viewer}
      title={pick(language, "宝库结构", "Portfolio")}
      description={pick(language, "这里是更深的分析层。收益走势、账户分布、持仓细节和集中度信号都在这里展开。", "This is the deeper analytical surface. Performance history, account structure, holding detail, and concentration signals all live here.")}
    >
      <Card className="overflow-hidden bg-[linear-gradient(135deg,rgba(255,255,255,0.68),rgba(246,218,230,0.5),rgba(221,232,255,0.44))]">
        <CardContent className="grid gap-6 px-6 py-6 md:grid-cols-[1.2fr_0.8fr] md:items-center">
          <div className="space-y-4">
            <div className="inline-flex rounded-full border border-white/60 bg-white/44 px-4 py-2 text-sm font-medium text-[color:var(--foreground)] backdrop-blur-md">{pick(language, "Loo 的结构分析台", "Loo's portfolio lab")}</div>
            <div className="space-y-3">
              <h2 className="text-[30px] font-semibold tracking-[-0.04em] text-[color:var(--foreground)]">
                看组合长什么样，再判断推荐有没有说服力。
              </h2>
              <p className="max-w-3xl text-sm leading-7 text-[color:var(--muted-foreground)]">
                这一页故意更重。表现走势、集中度、账户分布和最新价格刷新都放在这里，不挤回首页。
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <PortfolioSignal title="分析重点" detail="集中度、偏离、持仓 freshness" />
            <PortfolioSignal title="下一步动作" detail="看清结构后再打开配置建议" />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_320px]">
        <div className="space-y-6">
          <SectionHeading
            title={pick(language, "表现与结构", "Performance and structure")}
            description={pick(language, "组合页承担更重的分析任务。收益走势和结构性图表都放在这里，而不是挤回首页。", "The Portfolio page is the analytical surface. It carries the heavier charts that do not belong on the overview page.")}
          />
          <LineChartCard title={pick(language, "近 6 个月表现", "6-Month Performance")} description={pick(language, "收益走势从首页移到这里，让总览页保持更轻。", "Performance history moved here from Dashboard to keep the overview page lighter.")} data={data.performance} dataKey="value" color="#152238" />
          <div className="grid gap-4 2xl:grid-cols-2">
            <DonutChartCard title={pick(language, "账户分布", "Account Allocation")} description={pick(language, "按账户拆分当前敞口。", "Account-level exposure split.")} data={data.accountAllocation} />
            <DonutChartCard title={pick(language, "行业暴露", "Sector Exposure")} description={pick(language, "按当前持仓查看行业集中度。", "Sector concentration by current holdings.")} data={data.sectorExposure} />
          </div>
          <Card>
            <CardHeader>
              <CardTitle>{pick(language, "持仓明细", "Holdings Detail")}</CardTitle>
            </CardHeader>
            <CardContent>
              <HoldingTable holdings={data.holdings} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <RadarPreviewCard
            title={pick(language, "组合健康评分", "Portfolio Health Score")}
            status={`${data.healthScore.score}/100 · ${data.healthScore.status}`}
            description={pick(
              language,
              `当前最强维度是 ${data.healthScore.strongestDimension}，最弱维度是 ${data.healthScore.weakestDimension}。`,
              `Strongest dimension: ${data.healthScore.strongestDimension}. Weakest dimension: ${data.healthScore.weakestDimension}.`
            )}
            data={data.healthScore.radar}
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
              <QuickActionCard icon={<ShieldAlert className="h-4 w-4" />} title={pick(language, "查看集中度风险", "Review Concentration Risk")} description={pick(language, "检查哪些持仓正在推高单一标的暴露。", "Inspect the positions driving the highest single-name exposure.")} />
              <QuickActionCard icon={<PieChart className="h-4 w-4" />} title={pick(language, "查看配置缺口", "Inspect Allocation Gaps")} description={pick(language, "在投入新资金前，先看清最大的高配和低配资产类。", "See the biggest underweight and overweight classes before funding.")} />
              <QuickActionCard icon={<CircleGauge className="h-4 w-4" />} title={pick(language, "打开推荐驱动因素", "Open Recommendation Drivers")} description={pick(language, "追踪哪些组合信号正在推动当前建议。", "Trace which portfolio signals are pushing the current recommendation.")} />
              <QuickActionCard icon={<BarChart3 className="h-4 w-4" />} title={pick(language, "查看行业暴露", "View Sector Exposure")} description={pick(language, "识别过度集中的行业或主题敞口。", "Surface over-indexed sectors and thematic concentration.")} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{pick(language, "通往推荐页", "Bridge to Recommendations")}</CardTitle>
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
                {pick(language, "打开资金配置建议", "Open funding recommendations")}
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
