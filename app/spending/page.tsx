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
      title={pick(language, "消费流水", "Spending")}
      description={pick(language, "这里专门看现金流和日常交易。它的重点不是精细记账，而是帮你看清最近花了多少、剩下多少还能继续投。", "This page is for cash flow and day-to-day transactions. The goal is not heavy bookkeeping. It is to help you see how much you spent recently and how much may still be available to invest.")}
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
        <LineChartCard
          title={pick(language, "最近几个月花钱大概怎么走", "How spending has moved in recent months")}
          description={pick(language, "先看这条线是稳着走，还是最近突然抬高了。", "Use this to see whether spending has been steady or has suddenly jumped higher.")}
          data={data.trend}
          dataKey="value"
          color="#be3b49"
        />
        <Card>
          <CardHeader>
            <CardTitle>{pick(language, "钱主要花在了哪里", "Where most of the money went")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.categories.map((category) => (
              <div key={category.name} className="flex items-center justify-between rounded-2xl border border-[color:var(--border)] p-4">
                <div>
                  <p className="font-medium">{category.name}</p>
                  <p className="text-sm text-[color:var(--muted-foreground)]">
                    {pick(language, `大约占这个月支出的 ${category.share}`, `${category.share} of monthly spending`)}
                  </p>
                </div>
                <Badge variant="neutral">{category.amount}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{pick(language, "最近都发生了哪些交易", "Recent transactions")}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-[color:var(--muted-foreground)]">
              <tr>
                <th className="pb-3 font-medium">{pick(language, "日期", "Date")}</th>
                <th className="pb-3 font-medium">{pick(language, "商户", "Merchant")}</th>
                <th className="pb-3 font-medium">{pick(language, "花在哪类", "Category")}</th>
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
                      title={pick(language, "还没有交易记录", "No transactions imported yet")}
                      text={pick(language, "先导入第一份交易 CSV，这里才会开始告诉你最近的钱花到哪里去了。", "Import the first transaction CSV and this page will start showing where your money has been going.")}
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
