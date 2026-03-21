import { ArrowRight, BarChart3, CircleGauge, PieChart, ShieldAlert } from "lucide-react";
import { requireViewer } from "@/lib/auth/session";
import { getPortfolioView } from "@/lib/backend/services";
import { AppShell } from "@/components/layout/app-shell";
import { DonutChartCard } from "@/components/charts/donut-chart";
import { LineChartCard } from "@/components/charts/line-chart";
import { HoldingTable } from "@/components/portfolio/holding-table";
import { QuickActionCard } from "@/components/portfolio/quick-action-card";
import { RefreshPricesPanel } from "@/components/portfolio/refresh-prices-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/section-heading";

export default async function PortfolioPage() {
  const viewer = await requireViewer();
  const { data } = await getPortfolioView(viewer.id);

  return (
    <AppShell viewer={viewer} title="宝库结构" description="这里是更深的分析层。收益走势、账户分布、持仓细节和集中度信号都在这里展开。">
      <Card className="overflow-hidden bg-[linear-gradient(135deg,rgba(255,255,255,0.68),rgba(246,218,230,0.5),rgba(221,232,255,0.44))]">
        <CardContent className="grid gap-6 px-6 py-6 md:grid-cols-[1.2fr_0.8fr] md:items-center">
          <div className="space-y-4">
            <div className="inline-flex rounded-full border border-white/60 bg-white/44 px-4 py-2 text-sm font-medium text-[color:var(--foreground)] backdrop-blur-md">
              Loo 的结构分析台
            </div>
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
            title="Performance and structure"
            description="The Portfolio page is the analytical surface. It carries the heavier charts that do not belong on the overview page."
          />
          <LineChartCard title="6-Month Performance" description="Performance history moved here from Dashboard to keep the overview page lighter." data={data.performance} dataKey="value" color="#152238" />
          <div className="grid gap-4 2xl:grid-cols-2">
            <DonutChartCard title="Account Allocation" description="Account-level exposure split." data={data.accountAllocation} />
            <DonutChartCard title="Sector Exposure" description="Sector concentration by current holdings." data={data.sectorExposure} />
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Holdings Detail</CardTitle>
            </CardHeader>
            <CardContent>
              <HoldingTable holdings={data.holdings} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <RefreshPricesPanel
                lastRefreshed={data.quoteStatus.lastRefreshed}
                freshness={data.quoteStatus.freshness}
                coverage={data.quoteStatus.coverage}
              />
              <QuickActionCard icon={<ShieldAlert className="h-4 w-4" />} title="Review Concentration Risk" description="Inspect the positions driving the highest single-name exposure." />
              <QuickActionCard icon={<PieChart className="h-4 w-4" />} title="Inspect Allocation Gaps" description="See the biggest underweight and overweight classes before funding." />
              <QuickActionCard icon={<CircleGauge className="h-4 w-4" />} title="Open Recommendation Drivers" description="Trace which portfolio signals are pushing the current recommendation." />
              <QuickActionCard icon={<BarChart3 className="h-4 w-4" />} title="View Sector Exposure" description="Surface over-indexed sectors and thematic concentration." />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Bridge to Recommendations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.summaryPoints.map((point) => (
                <div key={point} className="rounded-[24px] border border-white/55 bg-white/38 p-4 text-sm text-[color:var(--muted-foreground)] backdrop-blur-md">
                  {point}
                </div>
              ))}
              <Button href="/recommendations" className="w-full" trailingIcon={<ArrowRight className="h-4 w-4" />}>
                Open funding recommendations
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
