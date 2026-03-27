"use client";

import Link from "next/link";
import { ArrowUpRight, Crown } from "lucide-react";
import type { PortfolioData } from "@/lib/contracts";
import type { DisplayLanguage } from "@/lib/i18n/ui";
import { pick } from "@/lib/i18n/ui";
import { Badge } from "@/components/ui/badge";
import { SecurityMark } from "@/components/portfolio/security-mark";

type HoldingRow = PortfolioData["holdings"][number] & {
  highlighted?: boolean;
  highlightLabel?: string;
};

function freshnessLabel(language: DisplayLanguage, variant: HoldingRow["freshnessVariant"]) {
  if (variant === "success") return pick(language, "较新", "Fresh enough");
  if (variant === "warning") return pick(language, "偏旧", "Aging");
  return pick(language, "未知", "Unknown");
}

export function HoldingTable({
  holdings,
  language
}: {
  holdings: HoldingRow[];
  language: DisplayLanguage;
}) {
  if (holdings.length === 0) {
    return (
      <div className="rounded-[24px] border border-white/55 bg-white/36 p-5 text-sm leading-7 text-[color:var(--muted-foreground)] backdrop-blur-md">
        {pick(language, "这里暂时还没有持仓。先导入，或者去账户页补一笔新持仓。", "There are no holdings here yet. Import data first or add a new holding from the account page.")}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="hidden items-center gap-4 rounded-[22px] border border-white/55 bg-white/26 px-5 py-4 text-sm font-medium text-[color:var(--muted-foreground)] lg:grid lg:grid-cols-[minmax(230px,1.55fr)_minmax(150px,0.9fr)_minmax(180px,1fr)_minmax(135px,0.8fr)_minmax(150px,0.9fr)_minmax(190px,1fr)_minmax(90px,0.65fr)_minmax(250px,1.4fr)]">
        <span>{pick(language, "持仓", "Holding")}</span>
        <span>{pick(language, "账户", "Account")}</span>
        <span>{pick(language, "成本", "Cost")}</span>
        <span>{pick(language, "当前估值", "Current value")}</span>
        <span>{pick(language, "最近价格", "Last price")}</span>
        <span>{pick(language, "占比", "Share")}</span>
        <span>{pick(language, "盈亏", "Gain / loss")}</span>
        <span>{pick(language, "Loo皇审核", "Loo review")}</span>
      </div>

      {holdings.map((holding) => (
        <div
          key={holding.id}
          className={`rounded-[26px] border p-5 backdrop-blur-md transition-colors ${
            holding.highlighted
              ? "border-[rgba(240,143,178,0.4)] bg-[linear-gradient(135deg,rgba(255,255,255,0.78),rgba(246,218,230,0.22),rgba(221,232,255,0.18))]"
              : "border-white/55 bg-white/36"
          }`}
        >
          <div className="grid gap-4 lg:grid-cols-[minmax(230px,1.55fr)_minmax(150px,0.9fr)_minmax(180px,1fr)_minmax(135px,0.8fr)_minmax(150px,0.9fr)_minmax(190px,1fr)_minmax(90px,0.65fr)_minmax(250px,1.4fr)] lg:items-start">
            <div className="space-y-3">
              <Link
                href={holding.href}
                className="group flex items-start gap-3 rounded-[22px] border border-white/60 bg-white/48 px-4 py-3 transition-[background-color,border-color,box-shadow] duration-200 hover:border-white/78 hover:bg-white/64 hover:shadow-[0_12px_28px_rgba(110,103,130,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]"
              >
                <SecurityMark symbol={holding.symbol} assetClass={holding.assetClass} className="h-14 w-14 rounded-[18px] text-sm" />
                <div className="min-w-0 space-y-1">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[28px] leading-none font-semibold tracking-[-0.03em] text-[color:var(--foreground)] sm:text-[30px]">
                        {holding.symbol}
                      </p>
                      <p className="mt-1 truncate text-sm text-[color:var(--muted-foreground)]">{holding.name}</p>
                    </div>
                    <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-[color:var(--muted-foreground)] transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </div>
                  <p className="text-xs font-medium text-[color:var(--primary)]">{pick(language, "点开详情", "Open detail")}</p>
                </div>
              </Link>
              {holding.highlighted && holding.highlightLabel ? <Badge variant="primary">{holding.highlightLabel}</Badge> : null}
            </div>

            <InfoBlock label={pick(language, "账户", "Account")} value={holding.account} muted={holding.accountType} />

            <InfoBlock
              label={pick(language, "成本", "Cost")}
              value={pick(language, `总股数 ${holding.quantity}`, `Shares ${holding.quantity}`)}
              muted={pick(language, `平均成本 ${holding.avgCost}`, `Avg cost ${holding.avgCost}`)}
            />

            <InfoBlock label={pick(language, "当前估值", "Current value")} value={holding.value} />

            <div className="space-y-2">
              <InfoBlock label={pick(language, "最近价格", "Last price")} value={holding.lastPrice} />
              <div className="inline-flex items-center gap-2">
                <Badge variant={holding.freshnessVariant}>{freshnessLabel(language, holding.freshnessVariant)}</Badge>
                <span className="text-xs text-[color:var(--muted-foreground)]">{holding.lastUpdated}</span>
              </div>
            </div>

            <InfoBlock
              label={pick(language, "占比", "Share")}
              value={pick(language, `占整个组合 ${holding.portfolioShare}`, `Of total portfolio ${holding.portfolioShare}`)}
              muted={pick(language, `占这个账户 ${holding.accountShare}`, `Inside this account ${holding.accountShare}`)}
            />

            <InfoBlock label={pick(language, "盈亏", "Gain / loss")} value={holding.gainLoss} />

            <div className="rounded-[22px] border border-white/55 bg-white/40 p-4 text-sm leading-7 text-[color:var(--muted-foreground)]">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-[color:var(--primary)]">
                <Crown className="h-3.5 w-3.5" />
                {pick(language, "Loo皇审核", "Loo review")}
              </div>
              {holding.signal}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function InfoBlock({
  label,
  value,
  muted
}: {
  label: string;
  value: string;
  muted?: string;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-[color:var(--muted-foreground)]">{label}</p>
      <p className="text-lg font-semibold leading-8 text-[color:var(--foreground)]">{value}</p>
      {muted ? <p className="text-sm leading-7 text-[color:var(--muted-foreground)]">{muted}</p> : null}
    </div>
  );
}
