import { ArrowLeft, ArrowRight, Landmark, ShieldCheck, Target, TrendingUp } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireViewer } from "@/lib/auth/session";
import { getPortfolioHoldingDetailView } from "@/lib/backend/services";
import { AppShell } from "@/components/layout/app-shell";
import { StickyRail } from "@/components/layout/sticky-rail";
import { LineChartCard } from "@/components/charts/line-chart";
import { RefreshSecurityPricePanel } from "@/components/portfolio/refresh-security-price-panel";
import { SecurityMark } from "@/components/portfolio/security-mark";
import { HoldingEditPanel } from "@/components/portfolio/holding-edit-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/section-heading";
import { StatBlock } from "@/components/ui/stat-block";
import { pick } from "@/lib/i18n/ui";

function formatFreshnessLabel(language: "zh" | "en", variant: "success" | "warning" | "neutral") {
  if (variant === "success") {
    return pick(language, "较新", "Fresh");
  }

  if (variant === "warning") {
    return pick(language, "偏旧", "Slightly stale");
  }

  return pick(language, "未知", "Unknown");
}

function localizeSecurityType(value: string, language: "zh" | "en") {
  const labels: Record<string, { zh: string; en: string }> = {
    "Common Stock": { zh: "普通股票", en: "Common Stock" },
    ETF: { zh: "ETF", en: "ETF" },
    "Commodity ETF": { zh: "商品 ETF", en: "Commodity ETF" },
    "Mutual Fund": { zh: "共同基金", en: "Mutual Fund" },
    ADR: { zh: "ADR", en: "ADR" },
    Index: { zh: "指数", en: "Index" },
    REIT: { zh: "REIT", en: "REIT" },
    Trust: { zh: "信托", en: "Trust" },
    "Preferred Share": { zh: "优先股", en: "Preferred Share" },
    Crypto: { zh: "加密资产", en: "Crypto" },
    Forex: { zh: "外汇", en: "Forex" },
    Unknown: { zh: "未知类型", en: "Unknown" }
  };
  return pick(language, labels[value]?.zh ?? value, labels[value]?.en ?? value);
}

function localizeExchange(value: string, language: "zh" | "en") {
  const labels: Record<string, { zh: string; en: string }> = {
    TSX: { zh: "TSX 多交所", en: "TSX" },
    TSXV: { zh: "TSXV 创业板", en: "TSXV" },
    "Cboe Canada": { zh: "Cboe Canada", en: "Cboe Canada" },
    NYSE: { zh: "NYSE 纽交所", en: "NYSE" },
    NASDAQ: { zh: "NASDAQ 纳指", en: "NASDAQ" },
    "NYSE Arca": { zh: "NYSE Arca", en: "NYSE Arca" },
    OTC: { zh: "OTC 场外市场", en: "OTC" },
    LSE: { zh: "LSE 伦交所", en: "LSE" },
    TSE: { zh: "TSE 东交所", en: "TSE" },
    "Other / Manual": { zh: "其他 / 手动指定", en: "Other / Manual" },
    "Unknown exchange": { zh: "未知交易所", en: "Unknown exchange" }
  };
  return pick(language, labels[value]?.zh ?? value, labels[value]?.en ?? value);
}

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
      description={pick(language, "先看这笔持仓的关键数字，再往下看走势、报价来源和审核。", "Start with the key numbers for this holding, then move into the trend, quote source, and review.")}
      compactHeader
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <Button href={detail.holding.accountHref} variant="secondary" leadingIcon={<ArrowLeft className="h-4 w-4" />}>
            {pick(language, "返回这个账户", "Back to this account")}
          </Button>
          <Link href="/portfolio" className="inline-flex rounded-full border border-white/60 bg-white/44 px-4 py-2 text-sm font-medium text-[color:var(--foreground)] backdrop-blur-md transition hover:bg-white/56">
            {pick(language, "回组合页", "Back to portfolio")}
          </Link>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-stretch">
          <Card className="bg-white/34">
            <CardContent className="min-w-0 space-y-5 px-5 py-5">
              <div className="flex items-start gap-2.5">
                <SecurityMark
                  symbol={detail.holding.symbol}
                  assetClass={detail.holding.assetClass}
                  hint={detail.holding.securityType === "Unknown" ? undefined : detail.holding.securityType.slice(0, 3).toUpperCase()}
                  className="h-6 w-6 rounded-[9px] text-[9px]"
                />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="truncate text-[20px] font-semibold tracking-[-0.04em] text-[color:var(--foreground)] sm:text-[22px]">{detail.holding.symbol}</h2>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[color:var(--muted-foreground)]">
                      <span className="inline-flex rounded-full border border-white/60 bg-white/44 px-3 py-1">{detail.holding.accountName}</span>
                      <span className="inline-flex rounded-full border border-white/60 bg-white/44 px-3 py-1">{detail.holding.assetClass}</span>
                      <span className="inline-flex rounded-full border border-white/60 bg-white/44 px-3 py-1">{detail.holding.sector}</span>
                    </div>
                  </div>
                  <div>
                    {detail.holding.name.trim().toUpperCase() === detail.holding.symbol.trim().toUpperCase() ? null : (
                      <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">{detail.holding.name}</p>
                    )}
                  </div>
                </div>
              </div>
              <LineChartCard
                title={pick(language, `${detail.holding.symbol} 近 6 个月参考走势`, `Reference 6-month view for ${detail.holding.symbol}`)}
                description={pick(language, "这里只看这笔持仓自己的参考走势。", "This trend focuses on this holding only.")}
                data={detail.performance}
                dataKey="value"
                color="#152238"
              />
            </CardContent>
          </Card>
          <Card className="h-full bg-white/34">
            <CardContent className="space-y-3 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <CompactMetric label={pick(language, "当前估值", "Current value")} value={detail.holding.value} />
                <CompactMetric label={pick(language, "总股数", "Total shares")} value={detail.holding.quantity} />
                <CompactMetric label={pick(language, "平均成本", "Average cost")} value={detail.holding.avgCost} />
                <CompactMetric label={pick(language, "现价", "Last price")} value={detail.holding.lastPrice} />
                <CompactMetric label={pick(language, "总成本", "Cost basis")} value={detail.holding.costBasis} />
                <CompactMetric label={pick(language, "盈亏", "Gain / loss")} value={detail.holding.gainLoss} />
                <CompactMetric label={pick(language, "占组合", "Of portfolio")} value={detail.holding.portfolioShare} />
                <CompactMetric label={pick(language, "占账户", "Of account")} value={detail.holding.accountShare} />
                <CompactMetric label={pick(language, "标的类型", "Security type")} value={localizeSecurityType(detail.holding.securityType, language)} />
                <CompactMetric label={pick(language, "主要市场", "Primary market")} value={localizeExchange(detail.holding.exchange, language)} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_248px] 2xl:grid-cols-[minmax(0,1fr)_264px]">
        <div className="space-y-6">
          <div className="grid gap-3 md:grid-cols-3">
            {detail.portfolioRole.map((item, index) => (
              <CompactInsightCard
                key={`holding-role-${index}`}
                icon={index == 0 ? <Target className="h-4 w-4" /> : index == 1 ? <TrendingUp className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                text={item}
              />
            ))}
          </div>

          <SectionHeading
            title={pick(language, "报价和审核", "Quote source and review")}
            description={pick(language, "先看当前价格从哪里来，细节需要时再展开。", "Start with the current quote source and expand only if you need more detail.")}
          />
          <Card>
            <CardContent className="space-y-3 px-5 py-4">
              <div className="rounded-[18px] border border-white/55 bg-white/36 px-4 py-3 text-sm leading-6 text-[color:var(--muted-foreground)] backdrop-blur-md">
                {detail.marketData.summary}
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {detail.marketData.facts.map((fact, index) => (
                  <StatBlock key={`holding-market-fact-${index}`} icon={<Landmark className="h-4 w-4" />} label={fact.label} value={fact.value} detail={fact.detail} />
                ))}
              </div>
              {detail.marketData.notes.length > 0 ? (
                <details className="rounded-[18px] border border-white/55 bg-white/30 px-4 py-3">
                  <summary className="cursor-pointer list-none text-sm font-medium text-[color:var(--foreground)] marker:hidden">
                    {pick(language, "展开更多报价说明", "Show more quote notes")}
                  </summary>
                  <div className="mt-3 grid gap-3">
                    {detail.marketData.notes.map((note, index) => (
                      <div key={`holding-market-note-${index}`} className="rounded-[16px] border border-white/55 bg-white/36 p-3 text-sm leading-6 text-[color:var(--muted-foreground)] backdrop-blur-md">
                        {note}
                      </div>
                    ))}
                  </div>
                </details>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <StickyRail>
          <RefreshSecurityPricePanel
            compact
            language={language}
            symbol={detail.holding.symbol}
            lastRefreshed={detail.holding.lastUpdated}
            freshness={formatFreshnessLabel(language, detail.holding.freshnessVariant)}
          />

          <HoldingEditPanel detail={detail} language={language} />

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


function CompactInsightCard({
  icon,
  text
}: {
  icon: React.ReactNode;
  text: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3 px-3.5 py-3.5 text-sm leading-5 text-[color:var(--muted-foreground)]">
        <div className="mt-0.5 shrink-0 rounded-full border border-white/60 bg-white/42 p-1.5 text-[color:var(--foreground)]">
          {icon}
        </div>
        <p>{text}</p>
      </CardContent>
    </Card>
  );
}

function CompactMetric({
  label,
  value
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[18px] border border-white/55 bg-white/42 p-4">
      <p className="text-xs uppercase tracking-[0.14em] text-[color:var(--muted-foreground)]">{label}</p>
      <p className="mt-2 text-sm leading-6 font-semibold text-[color:var(--foreground)]">{value}</p>
    </div>
  );
}
