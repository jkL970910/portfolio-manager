import { ArrowRight, BarChart3, CircleGauge, PieChart, ShieldAlert } from "lucide-react";
import { requireViewer } from "@/lib/auth/session";
import { getPortfolioView } from "@/lib/backend/services";
import { AppShell } from "@/components/layout/app-shell";
import { DonutChartCard } from "@/components/charts/donut-chart";
import { LineChartCard } from "@/components/charts/line-chart";
import { RefreshPricesPanel } from "@/components/portfolio/refresh-prices-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/section-heading";

export default async function PortfolioPage() {
  const viewer = await requireViewer();
  const { data } = await getPortfolioView(viewer.id);

  return (
    <AppShell
      viewer={viewer}
      title="Portfolio"
      description="Deep portfolio analysis, concentration checks, and performance context that support recommendation trust."
    >
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
            <CardContent className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-[color:var(--muted-foreground)]">
                  <tr>
                    <th className="pb-3 font-medium">Holding</th>
                    <th className="pb-3 font-medium">Account</th>
                    <th className="pb-3 font-medium">Weight</th>
                    <th className="pb-3 font-medium">Gain / Loss</th>
                    <th className="pb-3 font-medium">Signal</th>
                  </tr>
                </thead>
                <tbody>
                  {data.holdings.map((holding) => (
                    <tr key={holding.symbol} className="border-t border-[color:var(--border)]">
                      <td className="py-4 font-medium">{holding.symbol}</td>
                      <td className="py-4 text-[color:var(--muted-foreground)]">{holding.account}</td>
                      <td className="py-4">{holding.weight}</td>
                      <td className="py-4">{holding.gainLoss}</td>
                      <td className="py-4 text-[color:var(--muted-foreground)]">{holding.signal}</td>
                    </tr>
                  ))}
                  {data.holdings.length === 0 ? (
                    <tr className="border-t border-[color:var(--border)]">
                      <td className="py-6 text-[color:var(--muted-foreground)]" colSpan={5}>
                        No holdings imported yet. Complete the import flow to unlock portfolio analysis.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <RefreshPricesPanel />
              <QuickAction icon={<ShieldAlert className="h-4 w-4" />} title="Review Concentration Risk" description="Inspect the positions driving the highest single-name exposure." />
              <QuickAction icon={<PieChart className="h-4 w-4" />} title="Inspect Allocation Gaps" description="See the biggest underweight and overweight classes before funding." />
              <QuickAction icon={<CircleGauge className="h-4 w-4" />} title="Open Recommendation Drivers" description="Trace which portfolio signals are pushing the current recommendation." />
              <QuickAction icon={<BarChart3 className="h-4 w-4" />} title="View Sector Exposure" description="Surface over-indexed sectors and thematic concentration." />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Bridge to Recommendations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.summaryPoints.map((point) => (
                <div key={point} className="rounded-2xl border border-[color:var(--border)] p-4 text-sm text-[color:var(--muted-foreground)]">
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

function QuickAction({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-[color:var(--border)] p-4">
      <div className="flex items-center gap-2 font-medium">
        {icon}
        {title}
      </div>
      <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">{description}</p>
    </div>
  );
}
