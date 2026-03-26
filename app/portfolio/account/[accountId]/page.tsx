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
        "先看这个账户自己的走势、放了哪些资产、还有哪些地方需要先修。",
        "Use this page to inspect the account trend, the assets inside it, and the first areas that still need work."
      )}
    >
      <Card className="overflow-hidden bg-[linear-gradient(135deg,rgba(255,255,255,0.68),rgba(246,218,230,0.52),rgba(221,232,255,0.46))]">
        <CardContent className="grid gap-6 px-6 py-6 md:grid-cols-[1.1fr_0.9fr] md:items-center">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Button href="/portfolio" variant="secondary" leadingIcon={<ArrowLeft className="h-4 w-4" />}>
                {pick(language, "返回组合页", "Back to portfolio")}
              </Button>
              <div className="inline-flex rounded-full border border-white/60 bg-white/44 px-4 py-2 text-sm font-medium text-[color:var(--foreground)] backdrop-blur-md">
                {detail.account.typeLabel}
              </div>
            </div>
            <div className="space-y-3">
              <h2 className="text-[30px] font-semibold tracking-[-0.04em] text-[color:var(--foreground)]">
                {pick(language, `${detail.account.name} 现在大概是什么样`, `How ${detail.account.name} looks right now`)}
              </h2>
              <p className="max-w-3xl text-sm leading-7 text-[color:var(--muted-foreground)]">
                {pick(
                  language,
                  "这里不再把别的账户混进来。你看到的走势、分布、健康提示和持仓表，都只属于这个账户。",
                  "Nothing else is mixed into this page. The trend, allocation, health signals, and holdings table all belong to this account only."
                )}
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <StatBlock icon={<Wallet className="h-4 w-4" />} label={pick(language, "这个账户现在有多少", "Current account value")} value={detail.account.value} />
            <StatBlock
              icon={<CircleGauge className="h-4 w-4" />}
              label={pick(language, "这个账户占整个组合多少", "Share of total portfolio")}
              value={detail.account.portfolioShare}
              detail={pick(language, "这里看的分母是你全部投资资产，不只是这个账户。", "This compares the account with your full invested portfolio, not just this account.")}
            />
            <StatBlock icon={<Wallet className="h-4 w-4" />} label={pick(language, "账户币种", "Account currency")} value={detail.account.currency} />
            <StatBlock icon={<Wallet className="h-4 w-4" />} label={pick(language, "额度和状态", "Room and status")} value={detail.account.room} />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <SectionHeading
            title={pick(language, "先认清这个账户现在是什么样", "Start by sizing up this account")}
            description={pick(language, "先把账户里有几笔持仓、哪类资产最重、最近价格更新到什么程度看清楚，再往下看走势和持仓。", "Check how many holdings sit here, which sleeve dominates, and how fresh the prices are before moving into trends and positions.")}
          />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {detail.facts.map((fact, index) => (
              <StatBlock key={`account-fact-${index}`} icon={<Wallet className="h-4 w-4" />} label={fact.label} value={fact.value} detail={fact.detail} />
            ))}
          </div>

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
              <HoldingTable holdings={detail.holdings} language={language} />
            </CardContent>
          </Card>
        </div>

        <StickyRail>
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
