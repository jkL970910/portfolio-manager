import { ArrowLeft, ArrowRight, CircleGauge, Wallet } from "lucide-react";
import { notFound } from "next/navigation";
import { requireViewer } from "@/lib/auth/session";
import { getPortfolioAccountDetailView } from "@/lib/backend/services";
import { DonutChartCard } from "@/components/charts/donut-chart";
import { LineChartCard } from "@/components/charts/line-chart";
import { RadarPreviewCard } from "@/components/charts/radar-preview";
import { AppShell } from "@/components/layout/app-shell";
import { StickyRail } from "@/components/layout/sticky-rail";
import { HoldingTable } from "@/components/portfolio/holding-table";
import { AccountMaintenancePanel } from "@/components/portfolio/account-maintenance-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/section-heading";
import { StatBlock } from "@/components/ui/stat-block";
import { pick } from "@/lib/i18n/ui";

export default async function PortfolioAccountDetailPage({
  params
}: {
  params: Promise<{ accountId: string }>;
}) {
  const viewer = await requireViewer();
  const language = viewer.displayLanguage;
  const { accountId } = await params;
  const response = await getPortfolioAccountDetailView(viewer.id, accountId);
  const detail = response.data.data;

  if (!detail) {
    notFound();
  }

  return (
    <AppShell
      viewer={viewer}
      title={detail.account.name}
      description={pick(
        language,
        "先看这个账户的关键数字，再往下看走势、提醒和持仓。",
        "Start with the key account facts, then move into the trend, notes, and holdings."
      )}
      compactHeader
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <Button href="/portfolio" variant="secondary" leadingIcon={<ArrowLeft className="h-4 w-4" />}>
            {pick(language, "返回组合页", "Back to portfolio")}
          </Button>
          <div className="inline-flex rounded-full border border-white/60 bg-white/44 px-4 py-2 text-sm font-medium text-[color:var(--foreground)] backdrop-blur-md">
            {detail.account.typeLabel}
          </div>
        </div>

        <Card className="bg-white/34">
          <CardContent className="space-y-5 px-5 py-5">
            <div className="grid gap-5 xl:grid-cols-[minmax(260px,360px)_minmax(0,1fr)] xl:items-start">
              <div className="min-w-0 rounded-[18px] border border-white/55 bg-white/30 px-4 py-4 backdrop-blur-md">
                <div className="flex flex-wrap items-center gap-2 text-xs text-[color:var(--muted-foreground)]">
                  <span className="inline-flex rounded-full border border-white/60 bg-white/48 px-3 py-1 font-medium text-[color:var(--foreground)]">
                    {detail.account.typeLabel}
                  </span>
                  <span className="inline-flex rounded-full border border-white/60 bg-white/44 px-3 py-1">
                    {detail.account.currency}
                  </span>
                  <span className="inline-flex rounded-full border border-white/60 bg-white/44 px-3 py-1">
                    {detail.account.institution}
                  </span>
                </div>
                <h2 className="mt-3 text-[24px] font-semibold tracking-tight text-[color:var(--foreground)] sm:text-[28px]">
                  {detail.account.name}
                </h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[18px] border border-white/55 bg-white/42 p-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-[color:var(--muted-foreground)]">
                      {pick(language, "主要持仓", "Top holdings")}
                    </p>
                    <p className="mt-2 text-sm font-semibold leading-6 text-[color:var(--foreground)]">
                      {detail.account.topHoldings.join(" · ") || pick(language, "暂时还没有明显主仓", "No clear top holding yet")}
                    </p>
                  </div>
                  <div className="rounded-[18px] border border-white/55 bg-white/42 p-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-[color:var(--muted-foreground)]">
                      {pick(language, "先看什么", "What to check first")}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[color:var(--foreground)]">
                      {detail.account.summaryPoints[0] ?? pick(language, "先看这个账户里哪类资产最重，再决定要不要继续拆到单笔持仓。", "Start with the dominant sleeve, then decide whether you need to drill into single holdings.")}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <StatBlock icon={<Wallet className="h-4 w-4" />} label={pick(language, "当前账户总值", "Current account value")} value={detail.account.value} />
                <StatBlock
                  icon={<CircleGauge className="h-4 w-4" />}
                  label={pick(language, "占整个组合", "Share of total portfolio")}
                  value={detail.account.portfolioShare}
                  detail={pick(language, "分母是你全部投资资产。", "Compared with your full invested portfolio.")}
                />
                <StatBlock icon={<Wallet className="h-4 w-4" />} label={pick(language, "账户币种", "Account currency")} value={detail.account.currency} />
                <StatBlock icon={<Wallet className="h-4 w-4" />} label={pick(language, "额度和状态", "Room and status")} value={detail.account.room} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {detail.facts.map((fact, index) => (
                <StatBlock key={`account-fact-${index}`} icon={<Wallet className="h-4 w-4" />} label={fact.label} value={fact.value} detail={fact.detail} />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_248px] 2xl:grid-cols-[minmax(0,1fr)_264px]">
        <div className="space-y-6">
          <LineChartCard
            title={pick(language, `${detail.account.name} 近 6 个月大概怎么走`, `How ${detail.account.name} has moved over the last 6 months`)}
            description={pick(language, "先看这个账户自己是稳着往上，还是波动比较大。这里先给参考走势，完整历史回放后面再补。", "Start by checking whether this account has been moving steadily or swinging more than expected. This is a reference trend for now; full historical replay comes later.")}
            data={detail.performance}
            dataKey="value"
            color="#152238"
          />

          <SectionHeading
            title={pick(language, "先看这个账户目前的重点", "What stands out in this account")}
            description={pick(language, "这些都是只针对这个账户的提醒，不会把别的账户混进来。", "These notes are specific to this account only.")}
          />
          <div className="grid gap-4 md:grid-cols-2">
            {detail.account.summaryPoints.map((point, index) => (
              <Card key={`account-summary-${index}`}>
                <CardContent className="px-5 py-5 text-sm leading-7 text-[color:var(--muted-foreground)]">{point}</CardContent>
              </Card>
            ))}
          </div>

          <SectionHeading
            title={pick(language, "这个账户里的钱主要放在哪些资产里", "How the money is split inside this account")}
            description={pick(language, "先看这个账户内部大概偏向哪几类资产。", "Use this to see which sleeves dominate inside the account.")}
          />
          <DonutChartCard
            title={pick(language, "账户内资产分布", "Allocation inside this account")}
            description={pick(language, "这里只看这个账户本身，不看整个组合。", "This chart looks only at this account, not the full portfolio.")}
            data={detail.allocation}
            helperText={pick(language, "把鼠标放到切片上，可以看到这一类资产在这个账户里大概占多少。", "Hover a slice to see how much of this account sits in that sleeve.")}
            noDataText={pick(language, "这个账户里还没有足够的持仓数据。", "There is not enough holding data inside this account yet.")}
          />

          <SectionHeading
            title={pick(language, "再往下看这个账户里的具体持仓", "Then inspect the holdings inside this account")}
            description={pick(language, "如果想继续点进单笔持仓，直接点代码名就行。", "If you want to inspect one position in detail, click its symbol.")}
          />
          <Card>
            <CardContent className="px-6 py-6">
              <HoldingTable holdings={detail.holdings} language={language} hideAccountColumn />
            </CardContent>
          </Card>
        </div>

        <StickyRail>
          <AccountMaintenancePanel detail={detail} language={language} />

          <RadarPreviewCard
            title={pick(language, `${detail.account.name} 现在大概是什么状态`, `How ${detail.account.name} looks right now`)}
            status={`${detail.healthScore.score}/100 · ${detail.healthScore.status}`}
            description={pick(
              language,
              `现在最稳的一块是 ${detail.healthScore.strongestDimension}，最该先修的是 ${detail.healthScore.weakestDimension}。`,
              `Strongest area: ${detail.healthScore.strongestDimension}. First area to fix: ${detail.healthScore.weakestDimension}.`
            )}
            data={detail.healthScore.radar}
            href={`/portfolio/health?account=${detail.account.id}`}
            ctaLabel={pick(language, "看这个账户的健康详情", "Open this account health report")}
          />

          <Card>
            <CardContent className="space-y-3 px-6 py-6">
              <div className="rounded-[24px] border border-white/55 bg-white/36 p-4 text-sm leading-7 text-[color:var(--muted-foreground)] backdrop-blur-md">
                {pick(
                  language,
                  "这里可以改账户资料、往账户里加一笔新持仓，或把重复账户合并掉。已有持仓如果要删除或改分类，直接点进那笔持仓详情页去操作。",
                  "Use this rail to edit account details, add a new holding, or merge duplicate accounts. To delete or reclassify an existing position, open that holding detail page."
                )}
              </div>
              {detail.healthScore.highlights.map((highlight, index) => (
                <div key={`account-health-highlight-${index}`} className="rounded-[24px] border border-white/55 bg-white/36 p-4 text-sm leading-7 text-[color:var(--muted-foreground)] backdrop-blur-md">
                  {highlight}
                </div>
              ))}
              <Button href="/recommendations" variant="secondary" className="w-full" leadingIcon={<CircleGauge className="h-4 w-4" />}>
                {pick(language, "看看这个账户会怎样影响下一笔建议", "See how this account affects the next recommendation")}
              </Button>
              <Button href="/portfolio" className="w-full" trailingIcon={<ArrowRight className="h-4 w-4" />}>
                {pick(language, "回组合页继续看整体", "Back to the full portfolio")}
              </Button>
            </CardContent>
          </Card>
        </StickyRail>
      </div>
    </AppShell>
  );
}
