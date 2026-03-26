import { ArrowLeft, ArrowRight, Landmark } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireViewer } from "@/lib/auth/session";
import { getPortfolioHoldingDetailView } from "@/lib/backend/services";
import { AppShell } from "@/components/layout/app-shell";
import { StickyRail } from "@/components/layout/sticky-rail";
import { LineChartCard } from "@/components/charts/line-chart";
import { SecurityMark } from "@/components/portfolio/security-mark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/section-heading";
import { StatBlock } from "@/components/ui/stat-block";
import { pick } from "@/lib/i18n/ui";

export default async function PortfolioHoldingDetailPage({
  params
}: {
  params: Promise<{ holdingId: string }>;
}) {
  const viewer = await requireViewer();
  const language = viewer.displayLanguage;
  const { holdingId } = await params;
  const response = await getPortfolioHoldingDetailView(viewer.id, holdingId);
  const detail = response.data.data;

  if (!detail) {
    notFound();
  }

  return (
    <AppShell
      viewer={viewer}
      title={detail.holding.symbol}
      description={pick(language, "这里专门看这一笔持仓在整个组合里扮演什么角色。", "This page focuses on what this single holding is doing inside the portfolio.")}
    >
      <Card className="overflow-hidden bg-[linear-gradient(135deg,rgba(255,255,255,0.68),rgba(246,218,230,0.52),rgba(221,232,255,0.46))]">
        <CardContent className="grid gap-6 px-6 py-6 md:grid-cols-[1.1fr_0.9fr] md:items-center">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Button href={detail.holding.accountHref} variant="secondary" leadingIcon={<ArrowLeft className="h-4 w-4" />}>
                {pick(language, "返回这个账户", "Back to this account")}
              </Button>
              <Link href="/portfolio" className="inline-flex rounded-full border border-white/60 bg-white/44 px-4 py-2 text-sm font-medium text-[color:var(--foreground)] backdrop-blur-md transition hover:bg-white/56">
                {pick(language, "回组合页", "Back to portfolio")}
              </Link>
            </div>
            <div className="flex items-start gap-4">
              <SecurityMark symbol={detail.holding.symbol} assetClass={detail.holding.assetClass} className="h-14 w-14 rounded-[18px] text-sm" />
              <div className="space-y-2">
                <div>
                  <h2 className="text-[30px] font-semibold tracking-[-0.04em] text-[color:var(--foreground)]">{detail.holding.symbol}</h2>
                  <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">{detail.holding.name}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm text-[color:var(--muted-foreground)]">
                  <span className="inline-flex rounded-full border border-white/60 bg-white/44 px-3 py-1">{detail.holding.assetClass}</span>
                  <span className="inline-flex rounded-full border border-white/60 bg-white/44 px-3 py-1">{detail.holding.sector}</span>
                  <span className="inline-flex rounded-full border border-white/60 bg-white/44 px-3 py-1">{detail.holding.accountName}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <StatBlock icon={<Landmark className="h-4 w-4" />} label={pick(language, "这笔现在值多少", "Current value")} value={detail.holding.value} />
            <StatBlock icon={<Landmark className="h-4 w-4" />} label={pick(language, "占整个组合多少", "Share of portfolio")} value={detail.holding.weight} />
            <StatBlock icon={<Landmark className="h-4 w-4" />} label={pick(language, "最近价格", "Last price")} value={detail.holding.lastPrice} />
            <StatBlock icon={<Landmark className="h-4 w-4" />} label={pick(language, "当前盈亏", "Gain / loss")} value={detail.holding.gainLoss} />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <LineChartCard
            title={pick(language, `${detail.holding.symbol} 近 6 个月大概怎么走`, `How ${detail.holding.symbol} has moved over the last 6 months`)}
            description={pick(language, "这里先看这笔持仓自己最近大概是稳着走，还是波动比较大。", "Start by checking whether this position has been moving steadily or swinging more than expected.")}
            data={detail.performance}
            dataKey="value"
            color="#152238"
          />

          <SectionHeading
            title={pick(language, "这笔持仓在组合里扮演什么角色", "What this holding is doing in the portfolio")}
            description={pick(language, "这里先不谈复杂模型，只告诉你这笔持仓现在大概有多重、放在哪个账户、为什么值得注意。", "This section keeps it simple: how large the position is, where it sits, and why it matters.")}
          />
          <div className="grid gap-4">
            {detail.portfolioRole.map((item, index) => (
              <Card key={`holding-role-${index}`}>
                <CardContent className="px-5 py-5 text-sm leading-7 text-[color:var(--muted-foreground)]">{item}</CardContent>
              </Card>
            ))}
          </div>
        </div>

        <StickyRail>
          <Card>
            <CardContent className="space-y-4 px-6 py-6">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-[color:var(--foreground)]">{pick(language, "这笔现在大概是什么状态", "How this holding looks right now")}</p>
                <Badge variant={detail.holding.freshnessVariant}>{detail.healthSummary.status}</Badge>
              </div>
              <div className="rounded-[24px] border border-white/55 bg-white/36 p-4 text-sm leading-7 text-[color:var(--muted-foreground)] backdrop-blur-md">
                {detail.healthSummary.summary}
              </div>
              {detail.healthSummary.drivers.map((driver, index) => (
                <div key={`holding-driver-${index}`} className="rounded-[24px] border border-white/55 bg-white/36 p-4 text-sm leading-7 text-[color:var(--muted-foreground)] backdrop-blur-md">
                  {driver}
                </div>
              ))}
              {detail.healthSummary.actions.map((action, index) => (
                <div key={`holding-action-${index}`} className="rounded-[24px] border border-[rgba(240,143,178,0.22)] bg-[linear-gradient(135deg,rgba(255,255,255,0.76),rgba(245,214,235,0.28),rgba(255,239,224,0.22))] p-4 text-sm leading-7 text-[color:var(--muted-foreground)] backdrop-blur-md">
                  {action}
                </div>
              ))}
              <Button href={detail.holding.accountHref} variant="secondary" className="w-full" leadingIcon={<ArrowLeft className="h-4 w-4" />}>
                {pick(language, "回到这个账户继续看", "Back to this account")}
              </Button>
              <Button href="/recommendations" className="w-full" trailingIcon={<ArrowRight className="h-4 w-4" />}>
                {pick(language, "去看系统下一笔钱怎么投", "See where the next contribution should go")}
              </Button>
            </CardContent>
          </Card>
        </StickyRail>
      </div>
    </AppShell>
  );
}
