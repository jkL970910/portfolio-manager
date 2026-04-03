import { ArrowLeft, ArrowRight, Landmark } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireViewer } from "@/lib/auth/session";
import { getPortfolioHoldingDetailView } from "@/lib/backend/services";
import { AppShell } from "@/components/layout/app-shell";
import { StickyRail } from "@/components/layout/sticky-rail";
import { LineChartCard } from "@/components/charts/line-chart";
import { SecurityMark } from "@/components/portfolio/security-mark";
import { HoldingEditPanel } from "@/components/portfolio/holding-edit-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/section-heading";
import { StatBlock } from "@/components/ui/stat-block";
import { pick } from "@/lib/i18n/ui";

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

        <Card className="bg-white/34">
          <CardContent className="px-5 py-5">
            <div className="grid gap-5 xl:grid-cols-[minmax(260px,360px)_minmax(0,1fr)] xl:items-start">
              <div className="min-w-0 rounded-[18px] border border-white/55 bg-white/30 px-4 py-4 backdrop-blur-md">
                <div className="flex items-start gap-3">
                  <SecurityMark
                    symbol={detail.holding.symbol}
                    assetClass={detail.holding.assetClass}
                    hint={detail.holding.securityType === "Unknown" ? undefined : detail.holding.securityType.slice(0, 3).toUpperCase()}
                    className="h-6 w-6 rounded-[9px] text-[9px]"
                  />
                  <div className="min-w-0 space-y-2">
                    <div>
                      <h2 className="truncate text-[20px] font-semibold tracking-[-0.04em] text-[color:var(--foreground)] sm:text-[22px]">{detail.holding.symbol}</h2>
                      {detail.holding.name.trim().toUpperCase() === detail.holding.symbol.trim().toUpperCase() ? null : (
                        <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">{detail.holding.name}</p>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[color:var(--muted-foreground)]">
                      <span className="inline-flex rounded-full border border-white/60 bg-white/44 px-3 py-1">{detail.holding.assetClass}</span>
                      <span className="inline-flex rounded-full border border-white/60 bg-white/44 px-3 py-1">{detail.holding.sector}</span>
                      <span className="inline-flex rounded-full border border-white/60 bg-white/44 px-3 py-1">{localizeSecurityType(detail.holding.securityType, language)}</span>
                      <span className="inline-flex rounded-full border border-white/60 bg-white/44 px-3 py-1">{localizeExchange(detail.holding.exchange, language)}</span>
                      <span className="inline-flex rounded-full border border-white/60 bg-white/44 px-3 py-1">{detail.holding.accountName}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <StatBlock icon={<Landmark className="h-4 w-4" />} label={pick(language, "当前估值", "Current value")} value={detail.holding.value} />
                <StatBlock icon={<Landmark className="h-4 w-4" />} label={pick(language, "总股数", "Total shares")} value={detail.holding.quantity} />
                <StatBlock icon={<Landmark className="h-4 w-4" />} label={pick(language, "平均成本", "Average cost")} value={detail.holding.avgCost} />
                <StatBlock icon={<Landmark className="h-4 w-4" />} label={pick(language, "现价", "Last price")} value={detail.holding.lastPrice} />
              </div>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatBlock icon={<Landmark className="h-4 w-4" />} label={pick(language, "总成本", "Cost basis")} value={detail.holding.costBasis} />
              <StatBlock icon={<Landmark className="h-4 w-4" />} label={pick(language, "占组合", "Of portfolio")} value={detail.holding.portfolioShare} detail={pick(language, "这里看的是它在全部投资资产里的分量。", "This measures its share of the full invested portfolio.")} />
              <StatBlock icon={<Landmark className="h-4 w-4" />} label={pick(language, "占账户", "Of account")} value={detail.holding.accountShare} detail={pick(language, "这里只看它在当前账户里的大小。", "This only measures its share inside the current account.")} />
              <StatBlock icon={<Landmark className="h-4 w-4" />} label={pick(language, "盈亏", "Gain / loss")} value={detail.holding.gainLoss} />
              {detail.facts.map((fact, index) => (
                <StatBlock key={`holding-fact-${index}`} icon={<Landmark className="h-4 w-4" />} label={fact.label} value={fact.value} detail={fact.detail} />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_248px] 2xl:grid-cols-[minmax(0,1fr)_264px]">
        <div className="space-y-6">
          <SectionHeading
            title={pick(language, "先认清这笔现在是什么状态", "Understand the current state first")}
            description={pick(language, "先看这笔是不是已经够重、价格是不是够新、还有哪些地方需要你自己多留个心眼。", "Check whether the position is already heavy, whether the quote looks fresh enough, and where you still need your own judgment.")}
          />
          <div className="grid gap-4">
            {detail.portfolioRole.map((item, index) => (
              <Card key={`holding-role-${index}`}>
                <CardContent className="px-5 py-5 text-sm leading-7 text-[color:var(--muted-foreground)]">{item}</CardContent>
              </Card>
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
        </div>

        <StickyRail>
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
