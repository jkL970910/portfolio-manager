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
              <SecurityMark
                symbol={detail.holding.symbol}
                assetClass={detail.holding.assetClass}
                hint={detail.holding.securityType === "Unknown" ? undefined : detail.holding.securityType.slice(0, 3).toUpperCase()}
                className="h-16 w-16 rounded-[20px] text-sm"
              />
              <div className="space-y-2">
                <div>
                  <h2 className="text-[30px] font-semibold tracking-[-0.04em] text-[color:var(--foreground)]">{detail.holding.symbol}</h2>
                  <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">{detail.holding.name}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm text-[color:var(--muted-foreground)]">
                  <span className="inline-flex rounded-full border border-white/60 bg-white/44 px-3 py-1">{detail.holding.assetClass}</span>
                  <span className="inline-flex rounded-full border border-white/60 bg-white/44 px-3 py-1">{detail.holding.sector}</span>
                  <span className="inline-flex rounded-full border border-white/60 bg-white/44 px-3 py-1">{detail.holding.securityType}</span>
                  <span className="inline-flex rounded-full border border-white/60 bg-white/44 px-3 py-1">{detail.holding.exchange}</span>
                  <span className="inline-flex rounded-full border border-white/60 bg-white/44 px-3 py-1">{detail.holding.accountName}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <StatBlock icon={<Landmark className="h-4 w-4" />} label={pick(language, "这笔现在值多少", "Current value")} value={detail.holding.value} />
            <StatBlock
              icon={<Landmark className="h-4 w-4" />}
              label={pick(language, "占整个组合多少", "Share of total portfolio")}
              value={detail.holding.portfolioShare}
              detail={pick(language, "分母是你全部投资资产，所以这里是这笔持仓在全局里的分量。", "This uses the full invested portfolio as the denominator, so it shows the position's global share.")}
            />
            <StatBlock
              icon={<Landmark className="h-4 w-4" />}
              label={pick(language, "占这个账户多少", "Share inside this account")}
              value={detail.holding.accountShare}
              detail={pick(language, "这里只看它在当前账户里占了多大一块。", "This only measures how large the position is inside the current account.")}
            />
            <StatBlock icon={<Landmark className="h-4 w-4" />} label={pick(language, "最近价格", "Last price")} value={detail.holding.lastPrice} />
            <StatBlock icon={<Landmark className="h-4 w-4" />} label={pick(language, "当前盈亏", "Gain / loss")} value={detail.holding.gainLoss} />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <SectionHeading
            title={pick(language, "先认清这是什么标的", "Start by identifying the security")}
            description={pick(language, "先把它是什么、主要在哪个市场、在你账户里占多大看清楚，再往下看走势和建议。", "Clarify what it is, where it trades, and how large it is inside your account before moving into trend and guidance.")}
          />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {detail.facts.map((fact, index) => (
              <StatBlock key={`holding-fact-${index}`} icon={<Landmark className="h-4 w-4" />} label={fact.label} value={fact.value} detail={fact.detail} />
            ))}
          </div>

          <LineChartCard
            title={pick(language, `${detail.holding.symbol} 近 6 个月参考走势`, `Reference 6-month view for ${detail.holding.symbol}`)}
            description={pick(language, "这里先给你一个参考走势，帮你判断这笔持仓最近大概是稳着走，还是波动比较大。完整历史回放后面再补。", "This gives you a reference view so you can quickly judge whether the position has been steadier or more volatile recently. Full historical replay comes later.")}
            data={detail.performance}
            dataKey="value"
            color="#152238"
          />

          <SectionHeading
            title={pick(language, "现在拿到的价格靠不靠谱", "How trustworthy the current quote looks")}
            description={pick(language, "这里会说明这页当前拿到的价格来自哪里、是不是延迟行情，以及哪些地方还需要你自己判断。", "This explains where the current quote came from, whether it is delayed, and where your own judgment still matters.")}
          />
          <Card>
            <CardContent className="space-y-4 px-6 py-6">
              <div className="rounded-[24px] border border-white/55 bg-white/36 p-4 text-sm leading-7 text-[color:var(--muted-foreground)] backdrop-blur-md">
                {detail.marketData.summary}
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {detail.marketData.facts.map((fact, index) => (
                  <StatBlock key={`holding-market-fact-${index}`} icon={<Landmark className="h-4 w-4" />} label={fact.label} value={fact.value} detail={fact.detail} />
                ))}
              </div>
              <div className="grid gap-3">
                {detail.marketData.notes.map((note, index) => (
                  <div key={`holding-market-note-${index}`} className="rounded-[24px] border border-white/55 bg-white/36 p-4 text-sm leading-7 text-[color:var(--muted-foreground)] backdrop-blur-md">
                    {note}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

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
