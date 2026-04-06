"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Landmark, ShieldCheck, Target, TrendingUp } from "lucide-react";
import type { DisplayLanguage } from "@/lib/backend/models";
import type { PortfolioHoldingDetailData, PortfolioSecurityDetailData } from "@/lib/contracts";
import { LineChartCard } from "@/components/charts/line-chart";
import { StickyRail } from "@/components/layout/sticky-rail";
import { HoldingEditPanel } from "@/components/portfolio/holding-edit-panel";
import { CandidateScorePanel } from "@/components/portfolio/candidate-score-panel";
import { RefreshSecurityPricePanel } from "@/components/portfolio/refresh-security-price-panel";
import { SecurityMark } from "@/components/portfolio/security-mark";
import { WatchlistToggleButton } from "@/components/portfolio/watchlist-toggle-button";
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

function compactMetricValue(value: string) {
  const percentMatch = value.match(/-?\d+(?:\.\d+)?%/);
  if (percentMatch) {
    return percentMatch[0];
  }

  const moneyMatch = value.match(/(?:CAD|USD|JPY|EUR|GBP)\s*\$?[\d,]+(?:\.\d+)?|[$¥€£]\s?[\d,]+(?:\.\d+)?/);
  if (moneyMatch) {
    return moneyMatch[0].replace(/\s+/g, " ");
  }

  return value;
}

function formatPriceTooltip(value: number, currency: string) {
  return `${currency} $${value.toFixed(2)}`;
}

function getAggregateMetrics(detail: PortfolioSecurityDetailData, language: DisplayLanguage) {
  if (!detail.heldPosition) {
    return detail.facts.map((fact) => ({
      label: fact.label,
      value: compactMetricValue(fact.value)
    }));
  }

  return [
    { label: pick(language, "当前估值", "Current value"), value: detail.heldPosition.aggregate.value },
    { label: pick(language, "总股数", "Total shares"), value: detail.heldPosition.aggregate.quantity },
    { label: pick(language, "平均成本", "Average cost"), value: detail.heldPosition.aggregate.avgCost },
    { label: pick(language, "现价", "Last price"), value: detail.heldPosition.aggregate.lastPrice },
    { label: pick(language, "总成本", "Cost basis"), value: detail.heldPosition.aggregate.costBasis },
    { label: pick(language, "盈亏", "Gain / loss"), value: detail.heldPosition.aggregate.gainLoss },
    { label: pick(language, "占组合", "Of portfolio"), value: detail.heldPosition.aggregate.portfolioShare },
    { label: pick(language, "分布账户", "Accounts"), value: detail.heldPosition.aggregate.accountCount },
    { label: pick(language, "标的类型", "Security type"), value: localizeSecurityType(detail.security.securityType, language) },
    { label: pick(language, "主要市场", "Primary market"), value: localizeExchange(detail.security.exchange, language) }
  ];
}

function getAccountMetrics(summary: NonNullable<PortfolioSecurityDetailData["heldPosition"]>["accountSummaries"][number], detail: PortfolioHoldingDetailData, language: DisplayLanguage) {
  return [
    { label: pick(language, "当前估值", "Current value"), value: summary.value },
    { label: pick(language, "总股数", "Total shares"), value: summary.quantity },
    { label: pick(language, "平均成本", "Average cost"), value: summary.avgCost },
    { label: pick(language, "现价", "Last price"), value: summary.lastPrice },
    { label: pick(language, "总成本", "Cost basis"), value: summary.costBasis },
    { label: pick(language, "盈亏", "Gain / loss"), value: summary.gainLoss },
    { label: pick(language, "占组合", "Of portfolio"), value: summary.portfolioShare },
    { label: pick(language, "占账户", "Of account"), value: summary.accountShare },
    { label: pick(language, "标的类型", "Security type"), value: localizeSecurityType(detail.holding.securityType, language) },
    { label: pick(language, "主要市场", "Primary market"), value: localizeExchange(detail.holding.exchange, language) }
  ];
}

export function UnifiedSecurityDetail({
  detail,
  language,
  initialAccountId = null,
  initialHoldingId = null,
  initialTracked
}: {
  detail: PortfolioSecurityDetailData;
  language: DisplayLanguage;
  initialAccountId?: string | null;
  initialHoldingId?: string | null;
  initialTracked: boolean;
}) {
  const [selectedRange, setSelectedRange] = useState<"1D" | "1W" | "1M" | "3M" | "6M" | "1Y" | "ALL">("6M");
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(
    detail.heldPosition?.accountOptions.some((option) => option.accountId === initialAccountId) ? initialAccountId : null
  );
  const [selectedHoldingId, setSelectedHoldingId] = useState<string | null>(
    detail.heldPosition?.accountViews.some((view) => view.holding.id === initialHoldingId) ? initialHoldingId : null
  );

  const selectedAccountViews = useMemo(() => {
    if (!detail.heldPosition || !selectedAccountId) {
      return [];
    }

    return detail.heldPosition.accountViews.filter((view) => view.holding.accountId === selectedAccountId);
  }, [detail.heldPosition, selectedAccountId]);

  const selectedAccountView = useMemo(() => {
    if (!detail.heldPosition || !selectedAccountId) {
      return null;
    }

    if (selectedHoldingId) {
      return selectedAccountViews.find((view) => view.holding.id === selectedHoldingId) ?? selectedAccountViews[0] ?? null;
    }

    return selectedAccountViews[0] ?? null;
  }, [detail.heldPosition, selectedAccountId, selectedAccountViews, selectedHoldingId]);
  const selectedAccountSummary = useMemo(() => {
    if (!detail.heldPosition || !selectedAccountId) {
      return null;
    }

    return detail.heldPosition.accountSummaries.find((summary) => summary.accountId === selectedAccountId) ?? null;
  }, [detail.heldPosition, selectedAccountId]);

  useEffect(() => {
    if (!selectedAccountId) {
      if (selectedHoldingId !== null) {
        setSelectedHoldingId(null);
      }
      return;
    }

    if (selectedAccountViews.length === 0) {
      if (selectedHoldingId !== null) {
        setSelectedHoldingId(null);
      }
      return;
    }

    const hasSelectedHolding = selectedHoldingId
      ? selectedAccountViews.some((view) => view.holding.id === selectedHoldingId)
      : false;

    if (!hasSelectedHolding) {
      setSelectedHoldingId(selectedAccountViews[0]?.holding.id ?? null);
    }
  }, [selectedAccountId, selectedAccountViews, selectedHoldingId]);

  const metrics = selectedAccountView && selectedAccountSummary
    ? getAccountMetrics(selectedAccountSummary, selectedAccountView, language)
    : getAggregateMetrics(detail, language);
  const chartData = useMemo(() => {
    const series = detail.performance;
    const datedSeries = series.filter((point): point is typeof point & { rawDate: string } => typeof point.rawDate === "string");
    if (datedSeries.length < 2) {
      return series.slice(-6);
    }

    const end = new Date(datedSeries[datedSeries.length - 1].rawDate);
    const daysByRange: Record<Exclude<typeof selectedRange, "ALL">, number> = {
      "1D": 2,
      "1W": 8,
      "1M": 31,
      "3M": 92,
      "6M": 183,
      "1Y": 366
    };

    let filtered = selectedRange === "ALL"
      ? datedSeries
      : datedSeries.filter((point) => {
          const date = new Date(point.rawDate);
          const diffDays = (end.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
          return diffDays <= daysByRange[selectedRange];
        });

    if (filtered.length < 2) {
      filtered = datedSeries.slice(-Math.min(8, datedSeries.length));
    }

    const formatter = new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en-CA", {
      month: "short",
      day: selectedRange === "ALL" || selectedRange === "1Y" || selectedRange === "6M" ? undefined : "numeric",
      year: selectedRange === "ALL" ? "2-digit" : undefined
    });

    const maxPoints = selectedRange === "ALL" ? 120 : selectedRange === "1Y" ? 90 : 60;
    if (filtered.length > maxPoints) {
      const step = Math.ceil(filtered.length / maxPoints);
      filtered = filtered.filter((_, index) => index % step === 0 || index === filtered.length - 1);
    }

    return filtered.map((point) => ({
      ...point,
      label: formatter.format(new Date(point.rawDate))
    }));
  }, [detail.performance, language, selectedRange]);

  const topSubtitle = selectedAccountView
    ? pick(
        language,
        `现在正在看 ${selectedAccountSummary?.accountLabel ?? selectedAccountView.holding.accountName} 里的 ${detail.security.symbol} 持仓。`,
        `You are currently looking at ${detail.security.symbol} inside ${selectedAccountSummary?.accountLabel ?? selectedAccountView.holding.accountName}.`
      )
    : detail.heldPosition
      ? pick(
          language,
          `默认先合并看 ${detail.security.symbol} 在你所有账户里的总持仓，再按账户切换。`,
          `The default view combines ${detail.security.symbol} across all of your accounts before you switch into one account.`
        )
      : pick(
          language,
          "你现在还没持有这支标的，所以这里先按候选标的来展示。",
          "You do not currently hold this symbol, so the page starts in candidate-security mode."
        );

  return (
    <>
      <div className="space-y-5">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-stretch">
          <Card className="bg-white/34">
            <CardContent className="min-w-0 space-y-5 px-5 py-5">
              <div className="flex items-start gap-2.5">
                <SecurityMark
                  symbol={detail.security.symbol}
                  assetClass={detail.security.assetClass}
                  hint={detail.security.securityType === "Unknown" ? undefined : detail.security.securityType.slice(0, 3).toUpperCase()}
                  className="h-6 w-6 rounded-[9px] text-[9px]"
                />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="truncate text-[20px] font-semibold tracking-[-0.04em] text-[color:var(--foreground)] sm:text-[22px]">{detail.security.symbol}</h2>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[color:var(--muted-foreground)]">
                      {selectedAccountView ? (
                        <span className="inline-flex rounded-full border border-white/60 bg-white/44 px-3 py-1">{selectedAccountView.holding.accountName}</span>
                      ) : detail.heldPosition ? (
                        <span className="inline-flex rounded-full border border-white/60 bg-white/44 px-3 py-1">
                          {pick(language, `${detail.heldPosition.aggregate.accountCount} 个账户`, `${detail.heldPosition.aggregate.accountCount} accounts`)}
                        </span>
                      ) : null}
                      <span className="inline-flex rounded-full border border-white/60 bg-white/44 px-3 py-1">{detail.security.assetClass}</span>
                      <span className="inline-flex rounded-full border border-white/60 bg-white/44 px-3 py-1">{detail.security.sector}</span>
                      <span className="inline-flex rounded-full border border-white/60 bg-white/44 px-3 py-1">{detail.security.securityType}</span>
                      <span className="inline-flex rounded-full border border-white/60 bg-white/44 px-3 py-1">{detail.security.exchange}</span>
                    </div>
                  </div>
                  {detail.security.name.trim().toUpperCase() === detail.security.symbol.trim().toUpperCase() ? null : (
                    <p className="text-sm text-[color:var(--muted-foreground)]">{detail.security.name}</p>
                  )}
                  <p className="text-sm leading-7 text-[color:var(--muted-foreground)]">{topSubtitle}</p>
                  <WatchlistToggleButton symbol={detail.security.symbol} language={language} initialTracked={initialTracked} compact />
                </div>
              </div>
              <LineChartCard
                title={
                  pick(language, `${detail.security.symbol} 近 6 个月历史价格`, `6-month price history for ${detail.security.symbol}`)
                }
                description={pick(language, "这里展示的是标的本身的历史价格。右侧现价是最新报价，所以和最后一个月度历史点可能会有轻微差异。", "This chart shows the security's own historical prices. The current price on the right uses the latest quote, so it may differ slightly from the last historical monthly point.")}
                data={chartData}
                dataKey="value"
                color="#152238"
                actions={
                  <div className="inline-flex flex-wrap rounded-full border border-white/60 bg-white/56 p-1 backdrop-blur-md">
                    {(["1D", "1W", "1M", "3M", "6M", "1Y", "ALL"] as const).map((range) => (
                      <button
                        key={range}
                        type="button"
                        onClick={() => setSelectedRange(range)}
                        className={[
                          "rounded-full px-3 py-1.5 text-xs font-medium transition",
                          selectedRange === range
                            ? "bg-[linear-gradient(135deg,rgba(240,143,178,0.88),rgba(111,141,246,0.82))] text-white"
                            : "text-[color:var(--foreground)] hover:bg-white/72"
                        ].join(" ")}
                      >
                        {range === "ALL" ? "All" : range}
                      </button>
                    ))}
                  </div>
                }
                tooltipLabel={pick(language, "价格", "Price")}
                tooltipValueFormatter={(value) => formatPriceTooltip(value, detail.security.currency || "CAD")}
              />
            </CardContent>
          </Card>

          <Card className="h-full bg-white/34">
            <CardContent className="space-y-3 p-4">
              {detail.heldPosition ? (
                <div className="space-y-3 rounded-[18px] border border-white/55 bg-white/36 p-3 backdrop-blur-md">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--muted-foreground)]">
                      {pick(language, "持仓视角", "Position view")}
                    </p>
                    <select
                      className="w-full rounded-[16px] border border-white/58 bg-white/70 px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                      value={selectedAccountId ?? "__all__"}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        setSelectedAccountId(nextValue === "__all__" ? null : nextValue);
                      }}
                    >
                      <option value="__all__">{pick(language, "全部持仓", "All holdings")}</option>
                      {detail.heldPosition.accountOptions.map((option) => (
                        <option key={option.accountId} value={option.accountId}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  {selectedAccountViews.length > 1 ? (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--muted-foreground)]">
                        {pick(language, "账户内记录", "Holding record")}
                      </p>
                      <select
                        className="w-full rounded-[16px] border border-white/58 bg-white/70 px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                        value={selectedHoldingId ?? selectedAccountViews[0]?.holding.id ?? ""}
                        onChange={(event) => setSelectedHoldingId(event.target.value)}
                      >
                        {selectedAccountViews.map((view, index) => (
                          <option key={view.holding.id} value={view.holding.id}>
                            {pick(language, `记录 ${index + 1}`, `Record ${index + 1}`)} · {view.holding.quantity} · {view.holding.value}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                </div>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2">
                {metrics.map((metric) => (
                  <CompactMetric key={metric.label} label={metric.label} value={metric.value} />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_248px] 2xl:grid-cols-[minmax(0,1fr)_264px]">
        <div className="space-y-6">
          {selectedAccountView ? (
            <>
              <div className="grid gap-3 md:grid-cols-3">
                {selectedAccountView.portfolioRole.map((item, index) => (
                  <CompactInsightCard
                    key={`holding-role-${index}`}
                    icon={index === 0 ? <Target className="h-4 w-4" /> : index === 1 ? <TrendingUp className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                    text={item}
                  />
                ))}
              </div>

              <SectionHeading
                title={pick(language, "报价和审核", "Quote source and review")}
                description={pick(language, "现在展示的是当前选中账户里的这笔持仓信息。", "This section now reflects the position inside the currently selected account.")}
              />
              {selectedAccountSummary ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {selectedAccountSummary.summaryPoints.map((item, index) => (
                    <Card key={`account-summary-${index}`}>
                      <CardContent className="px-5 py-5 text-sm leading-7 text-[color:var(--muted-foreground)]">{item}</CardContent>
                    </Card>
                  ))}
                </div>
              ) : null}
              <Card>
                <CardContent className="space-y-3 px-5 py-4">
                  <div className="rounded-[18px] border border-white/55 bg-white/36 px-4 py-3 text-sm leading-6 text-[color:var(--muted-foreground)] backdrop-blur-md">
                    {selectedAccountView.marketData.summary}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {selectedAccountView.marketData.facts.map((fact, index) => (
                      <StatBlock key={`holding-market-fact-${index}`} icon={<Landmark className="h-4 w-4" />} label={fact.label} value={fact.value} detail={fact.detail} />
                    ))}
                  </div>
                  {selectedAccountView.marketData.notes.length > 0 ? (
                    <details className="rounded-[18px] border border-white/55 bg-white/30 px-4 py-3">
                      <summary className="cursor-pointer list-none text-sm font-medium text-[color:var(--foreground)] marker:hidden">
                        {pick(language, "展开更多报价说明", "Show more quote notes")}
                      </summary>
                      <div className="mt-3 grid gap-3">
                        {selectedAccountView.marketData.notes.map((note, index) => (
                          <div key={`holding-market-note-${index}`} className="rounded-[16px] border border-white/55 bg-white/36 p-3 text-sm leading-6 text-[color:var(--muted-foreground)] backdrop-blur-md">
                            {note}
                          </div>
                        ))}
                      </div>
                    </details>
                  ) : null}
                </CardContent>
              </Card>
            </>
          ) : (
            <>
              <Card>
                <CardContent className="space-y-4 px-6 py-6">
                  <div className="rounded-[24px] border border-white/55 bg-white/36 p-4 text-sm leading-7 text-[color:var(--muted-foreground)] backdrop-blur-md">
                    {detail.marketData.summary}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {detail.marketData.facts.map((fact, index) => (
                      <StatBlock key={`security-market-fact-${index}`} icon={<Landmark className="h-4 w-4" />} label={fact.label} value={fact.value} detail={fact.detail} />
                    ))}
                  </div>
                  <div className="grid gap-3">
                    {detail.marketData.notes.map((note, index) => (
                      <div key={`security-market-note-${index}`} className="rounded-[24px] border border-white/55 bg-white/36 p-4 text-sm leading-7 text-[color:var(--muted-foreground)] backdrop-blur-md">
                        {note}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <SectionHeading
                title={
                  detail.heldPosition
                    ? pick(language, "它在你组合里的整体位置", "How it sits across your portfolio")
                    : pick(language, "它和你的组合现在是什么关系", "How it currently relates to your portfolio")
                }
                description={
                  detail.heldPosition
                    ? pick(language, "这里先看这支标的合并后的整体位置，再决定要不要切到某个账户。", "Start with the combined view of the symbol across accounts, then switch into one account only when needed.")
                    : pick(language, "如果你以后持有它，这里也会补上账户分布和持仓视角。", "If you hold it in the future, this page will also add account distribution and held-position views.")
                }
              />
                <div className="grid gap-4">
                  {(detail.heldPosition?.aggregate.summaryPoints ?? detail.summaryPoints).map((item, index) => (
                    <Card key={`security-role-${index}`}>
                      <CardContent className="px-5 py-5 text-sm leading-7 text-[color:var(--muted-foreground)]">{item}</CardContent>
                    </Card>
                  ))}
                </div>

              {detail.relatedHoldings.length > 0 ? (
                <>
                  <SectionHeading
                    title={pick(language, "你已持有的账户分布", "Account distribution you already hold")}
                    description={pick(language, "这里保留按账户的快速入口，方便你从总持仓视角直接切到某个账户。", "These cards remain as quick account entry points from the aggregate view.")}
                  />
                  <div className="grid gap-4">
                    {detail.heldPosition?.accountSummaries.map((summary) => (
                      <button
                        key={`related-holding-${summary.accountId}`}
                        type="button"
                        onClick={() => setSelectedAccountId(summary.accountId)}
                        className="rounded-[24px] border border-white/55 bg-white/36 p-5 text-left backdrop-blur-md transition hover:bg-white/48"
                      >
                        <p className="text-lg font-semibold text-[color:var(--foreground)]">{summary.accountLabel}</p>
                        <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
                          {pick(language, `${summary.value} · 占这个账户 ${summary.accountShare}`, `${summary.value} · ${summary.accountShare} of this account`)}
                        </p>
                      </button>
                    ))}
                  </div>
                </>
              ) : null}
            </>
          )}
        </div>

        <StickyRail>
          <RefreshSecurityPricePanel
            compact
            language={language}
            symbol={detail.security.symbol}
            lastRefreshed={selectedAccountView?.holding.lastUpdated ?? detail.security.quoteTimestamp}
            freshness={formatFreshnessLabel(language, selectedAccountView?.holding.freshnessVariant ?? detail.security.freshnessVariant)}
          />

          <CandidateScorePanel
            language={language}
            symbol={detail.security.symbol}
            name={detail.security.name}
            currency={detail.security.currency === "USD" ? "USD" : "CAD"}
            securityType={detail.security.securityType}
            compact
          />

          {selectedAccountView ? (
            <>
              <HoldingEditPanel detail={selectedAccountView} language={language} />

              <Card>
                <CardContent className="space-y-4 px-6 py-6">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-[color:var(--foreground)]">{pick(language, "这笔现在大概是什么状态", "How this holding looks right now")}</p>
                    <Badge variant={selectedAccountView.holding.freshnessVariant}>{selectedAccountView.healthSummary.status}</Badge>
                  </div>
                  <div className="rounded-[24px] border border-white/55 bg-white/36 p-4 text-sm leading-7 text-[color:var(--muted-foreground)] backdrop-blur-md">
                    {selectedAccountView.healthSummary.summary}
                  </div>
                  {selectedAccountView.healthSummary.drivers.map((driver, index) => (
                    <div key={`holding-driver-${index}`} className="rounded-[24px] border border-white/55 bg-white/36 p-4 text-sm leading-7 text-[color:var(--muted-foreground)] backdrop-blur-md">
                      {driver}
                    </div>
                  ))}
                  {selectedAccountView.healthSummary.actions.map((action, index) => (
                    <div key={`holding-action-${index}`} className="rounded-[24px] border border-[rgba(240,143,178,0.22)] bg-[linear-gradient(135deg,rgba(255,255,255,0.76),rgba(245,214,235,0.28),rgba(255,239,224,0.22))] p-4 text-sm leading-7 text-[color:var(--muted-foreground)] backdrop-blur-md">
                      {action}
                    </div>
                  ))}
                  <Button type="button" variant="secondary" className="w-full" onClick={() => setSelectedAccountId(null)} leadingIcon={<ArrowLeft className="h-4 w-4" />}>
                    {pick(language, "回到总持仓视角", "Back to total position view")}
                  </Button>
                  <Button href="/recommendations" className="w-full" trailingIcon={<ArrowRight className="h-4 w-4" />}>
                    {pick(language, "去看系统下一笔钱怎么投", "See where the next contribution should go")}
                  </Button>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="space-y-4 px-6 py-6">
                <p className="text-sm font-semibold text-[color:var(--foreground)]">
                  {detail.heldPosition
                    ? pick(language, "现在是总持仓视角", "You are in the total position view")
                    : pick(language, "如果你把它当候选标的来看", "If you are evaluating it as a candidate")}
                </p>
                <div className="rounded-[24px] border border-white/55 bg-white/36 p-4 text-sm leading-7 text-[color:var(--muted-foreground)] backdrop-blur-md">
                  {detail.heldPosition
                    ? pick(language, "这里先回答你总共持有多少、平均成本是多少、整体占比有多大。等你切到账户以后，再展开那个账户里的编辑、刷新和审核信息。", "This view first answers how much you hold in total, what the blended average cost looks like, and how large the overall exposure is. Switch into an account to unlock that account's edit, refresh, and review detail.")
                    : detail.marketData.summary}
                </div>
                {(detail.heldPosition ? detail.heldPosition.aggregate.summaryPoints : detail.marketData.notes).map((note, index) => (
                  <div key={`security-rail-note-${index}`} className="rounded-[24px] border border-white/55 bg-white/36 p-4 text-sm leading-7 text-[color:var(--muted-foreground)] backdrop-blur-md">
                    {note}
                  </div>
                ))}
                <Button href="/recommendations" variant="secondary" className="w-full" leadingIcon={<ArrowLeft className="h-4 w-4" />}>
                  {pick(language, "回推荐页继续比对", "Back to recommendations")}
                </Button>
                <Button href="/portfolio" className="w-full" trailingIcon={<ArrowRight className="h-4 w-4" />}>
                  {pick(language, "回组合页继续看整体", "Back to portfolio")}
                </Button>
              </CardContent>
            </Card>
          )}
        </StickyRail>
      </div>
    </>
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
