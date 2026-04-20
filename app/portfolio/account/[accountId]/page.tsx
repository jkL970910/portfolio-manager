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

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-stretch">
          <Card className="h-full bg-white/34">
            <CardContent className="flex h-full min-w-0 flex-col gap-5 px-5 py-5">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-[24px] font-semibold tracking-tight text-[color:var(--foreground)] sm:text-[28px]">
                    {detail.account.name}
                  </h2>
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
                </div>
                {detail.account.topHoldings.length > 0 ? (
                  <div className="rounded-[18px] border border-white/55 bg-white/34 px-4 py-3 text-sm text-[color:var(--muted-foreground)] backdrop-blur-md">
                    <span className="font-medium text-[color:var(--foreground)]">{pick(language, "主要持仓", "Main holdings")}</span>
                    <span className="ml-2">{detail.account.topHoldings.join(" · ")}</span>
                  </div>
                ) : null}
              </div>
              <div className="min-h-0 flex-1">
                <LineChartCard
                title={pick(language, `${detail.account.name} 近 6 个月大概怎么走`, `How ${detail.account.name} has moved over the last 6 months`)}
                description={pick(language, "这里只看这个账户自己的走势。", "This trend looks only at the account itself.")}
                data={detail.performance}
                dataKey="value"
                color="#152238"
                rangeControls
                valueFormat="currency"
                currencyCode={detail.displayContext.currency}
                actions={
                  <div className="flex flex-wrap gap-2">
                    <div className="inline-flex rounded-full border border-white/60 bg-white/56 px-3 py-1.5 text-xs font-medium text-[color:var(--foreground)] backdrop-blur-md">
                      {detail.trendContext.scopeLabel}: {detail.trendContext.scopeDetail}
                    </div>
                    <div className="inline-flex rounded-full border border-white/60 bg-white/56 px-3 py-1.5 text-xs font-medium text-[color:var(--foreground)] backdrop-blur-md">
                      {detail.trendContext.sourceLabel}: {detail.trendContext.sourceDetail}
                    </div>
                  </div>
                }
                />
              </div>
            </CardContent>
          </Card>
          <div className="grid h-full grid-rows-[auto_minmax(0,1fr)] gap-4">
            <Card className="bg-white/34">
              <CardContent className="space-y-3 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <CompactMetric
                    icon={<Wallet className="h-4 w-4" />}
                    label={pick(language, "当前账户总值", "Current account value")}
                    value={detail.account.value}
                    detail={compactPortfolioShare(detail.account.portfolioShare)}
                  />
                  <CompactMetric
                    icon={<CircleGauge className="h-4 w-4" />}
                    label={pick(language, "账户总盈亏", "Account gain/loss")}
                    value={detail.account.gainLoss}
                  />
                  <CompactMetric icon={<Wallet className="h-4 w-4" />} label={pick(language, "账户币种", "Account currency")} value={detail.account.currency} />
                  <CompactMetric
                    icon={<Wallet className="h-4 w-4" />}
                    label={pick(language, "可用额度", "Available room")}
                    value={compactRoom(detail.account.room, detail.account.currency)}
                  />
                </div>
              </CardContent>
            </Card>
            <DonutChartCard
              className="h-full bg-white/34"
              title={pick(language, "账户内资产分布", "Allocation inside this account")}
              data={detail.allocation}
              noDataText={pick(language, "这个账户里还没有足够的持仓数据。", "There is not enough holding data inside this account yet.")}
              legendMode="side"
              legendMaxItems={5}
              chartHeight={118}
              chartMaxWidth={124}
              innerRadius={28}
              outerRadius={44}
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {detail.facts.map((fact, index) => (
            <StatBlock key={`account-fact-${index}`} icon={<Wallet className="h-4 w-4" />} label={fact.label} value={fact.value} detail={fact.detail} />
          ))}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_248px] 2xl:grid-cols-[minmax(0,1fr)_264px]">
        <div className="space-y-6">
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

function CompactMetric({
  icon,
  label,
  value,
  detail
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="rounded-[20px] border border-white/55 bg-white/40 p-4 backdrop-blur-md">
      <div className="flex items-center gap-2 text-sm text-[color:var(--muted-foreground)]">
        {icon}
        {label}
      </div>
      <p className="mt-3 text-[18px] leading-8 font-semibold text-[color:var(--foreground)]">{value}</p>
      {detail ? <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">{detail}</p> : null}
    </div>
  );
}

function compactPortfolioShare(value: string) {
  const match = value.match(/-?\d+(?:\.\d+)?%/);
  return match?.[0] ?? value;
}

function compactRoom(value: string, currency: string) {
  if (value.includes("不记录") || value.toLowerCase().includes("does not track")) {
    return value;
  }

  const moneyMatch = value.match(/([$¥€£]\s?[\d,]+(?:\.\d+)?|\d[\d,]*(?:\.\d+)?)/);
  if (!moneyMatch) {
    return value;
  }

  return `${currency} ${moneyMatch[0].replace(/\s+/g, "")}`;
}
