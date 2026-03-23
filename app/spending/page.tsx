import { requireViewer } from "@/lib/auth/session";
import { getSpendingView } from "@/lib/backend/services";
import { AppShell } from "@/components/layout/app-shell";
import { LineChartCard } from "@/components/charts/line-chart";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyStatePanel } from "@/components/ui/empty-state-panel";
import { pick } from "@/lib/i18n/ui";

export default async function SpendingPage() {
  const viewer = await requireViewer();
  const language = viewer.displayLanguage;
  const { data } = await getSpendingView(viewer.id);

  return (
    <AppShell
      viewer={viewer}
      title={pick(language, "消费流", "Spending")}
      description={pick(language, "这里承接更细的现金流和交易管理。它服务投资决策，但不会抢走产品主线。", "Detailed cash-flow and transaction management lives here. It supports investing decisions but does not take over the product narrative.")}
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {data.metrics.map((metric) => (
          <Card key={metric.label}>
            <CardHeader>
              <CardTitle className="text-sm text-[color:var(--muted-foreground)]">{metric.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">{metric.value}</p>
              <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">{metric.detail}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <LineChartCard title={pick(language, "消费趋势", "Spending trend")} description={pick(language, "过去六个月按月的消费变化。", "Six-month spending movement by month.")} data={data.trend} dataKey="value" color="#be3b49" />
        <Card>
          <CardHeader>
            <CardTitle>{pick(language, "分类拆分", "Category Breakdown")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.categories.map((category) => (
              <div key={category.name} className="flex items-center justify-between rounded-2xl border border-[color:var(--border)] p-4">
                <div>
                  <p className="font-medium">{category.name}</p>
                  <p className="text-sm text-[color:var(--muted-foreground)]">{pick(language, `占当月消费的 ${category.share}`, `${category.share} of monthly spend`)}</p>
                </div>
                <Badge variant="neutral">{category.amount}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{pick(language, "最近交易", "Recent Transactions")}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-[color:var(--muted-foreground)]">
              <tr>
                <th className="pb-3 font-medium">{pick(language, "日期", "Date")}</th>
                <th className="pb-3 font-medium">{pick(language, "商户", "Merchant")}</th>
                <th className="pb-3 font-medium">{pick(language, "分类", "Category")}</th>
                <th className="pb-3 font-medium">{pick(language, "金额", "Amount")}</th>
              </tr>
            </thead>
            <tbody>
              {data.transactions.map((transaction) => (
                <tr key={`${transaction.date}-${transaction.merchant}`} className="border-t border-[color:var(--border)]">
                  <td className="py-4">{transaction.date}</td>
                  <td className="py-4 font-medium">{transaction.merchant}</td>
                  <td className="py-4 text-[color:var(--muted-foreground)]">{transaction.category}</td>
                  <td className="py-4">{transaction.amount}</td>
                </tr>
              ))}
              {data.transactions.length === 0 ? (
                <tr className="border-t border-[color:var(--border)]">
                  <td className="py-6" colSpan={4}>
                    <EmptyStatePanel
                      title={pick(language, "还没有导入交易", "No transactions imported yet")}
                      text={pick(language, "完成第一份交易 CSV 导入后，这里的消费洞察就会出现。", "Spending insights will populate after the first CSV import.")}
                    />
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </AppShell>
  );
}
