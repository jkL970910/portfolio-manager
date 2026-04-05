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

function displaySecurityName(holding: HoldingRow) {
  return holding.name.trim().toUpperCase() === holding.symbol.trim().toUpperCase() ? null : holding.name;
}

export function HoldingTable({
  holdings,
  language,
  hideAccountColumn = false
}: {
  holdings: HoldingRow[];
  language: DisplayLanguage;
  hideAccountColumn?: boolean;
}) {
  if (holdings.length === 0) {
    return (
      <div className="rounded-[24px] border border-white/55 bg-white/36 p-5 text-sm leading-7 text-[color:var(--muted-foreground)] backdrop-blur-md">
        {pick(language, "这里还没有持仓。先导入，或者去账户页补一笔新持仓。", "There are no holdings here yet. Import data first or add a new holding from the account page.")}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div
        className={[
          "hidden items-center gap-4 rounded-[22px] border border-white/55 bg-white/26 px-5 py-4 text-sm font-medium text-[color:var(--muted-foreground)] xl:grid",
          hideAccountColumn
            ? "xl:grid-cols-[minmax(196px,1.12fr)_minmax(148px,0.8fr)_minmax(140px,0.74fr)_minmax(120px,0.58fr)_minmax(176px,0.92fr)]"
            : "xl:grid-cols-[minmax(190px,1.02fr)_minmax(112px,0.6fr)_minmax(144px,0.72fr)_minmax(140px,0.72fr)_minmax(120px,0.54fr)_minmax(176px,0.9fr)]"
        ].join(" ")}
      >
        <span>{pick(language, "持仓", "Holding")}</span>
        {hideAccountColumn ? null : <span>{pick(language, "账户", "Account")}</span>}
        <span>{pick(language, "成本", "Cost")}</span>
        <span>{pick(language, "当前估值", "Current value")}</span>
        <span>{pick(language, "盈亏", "Gain / loss")}</span>
        <span>{pick(language, "Loo皇审核", "Review note")}</span>
      </div>

      {holdings.map((holding) => {
        const securityName = displaySecurityName(holding);
        return (
          <div
            key={holding.id}
            className={`rounded-[26px] border p-5 backdrop-blur-md transition-colors ${
              holding.highlighted
                ? "border-[rgba(240,143,178,0.4)] bg-[linear-gradient(135deg,rgba(255,255,255,0.78),rgba(246,218,230,0.22),rgba(221,232,255,0.18))]"
                : "border-white/55 bg-white/36"
            }`}
          >
            <div
              className={[
                "grid gap-5 xl:items-start",
                hideAccountColumn
                  ? "xl:grid-cols-[minmax(196px,1.12fr)_minmax(148px,0.8fr)_minmax(140px,0.74fr)_minmax(120px,0.58fr)_minmax(176px,0.92fr)]"
                  : "xl:grid-cols-[minmax(190px,1.02fr)_minmax(112px,0.6fr)_minmax(144px,0.72fr)_minmax(140px,0.72fr)_minmax(120px,0.54fr)_minmax(176px,0.9fr)]"
              ].join(" ")}
            >
              <div className="space-y-3">
                <div className="rounded-[22px] border border-white/60 bg-white/48 px-4 py-3">
                  <div className="flex items-start gap-3">
                    <SecurityMark symbol={holding.symbol} assetClass={holding.assetClass} className="h-11 w-11 rounded-[14px] text-[13px]" />
                    <div className="min-w-0 space-y-2">
                      <div className="min-w-0">
                        <p className="truncate text-[20px] leading-none font-semibold tracking-[-0.03em] text-[color:var(--foreground)] sm:text-[22px]">
                          {holding.symbol}
                        </p>
                        {securityName ? <p className="mt-1 truncate text-sm text-[color:var(--muted-foreground)]">{securityName}</p> : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={holding.securityHref}
                          className="group inline-flex items-center gap-1 rounded-full border border-white/72 bg-white/74 px-3 py-1.5 text-xs font-medium text-[color:var(--primary)] transition-[background-color,border-color,box-shadow] duration-200 hover:border-white hover:bg-white hover:shadow-[0_10px_20px_rgba(110,103,130,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]"
                        >
                          {pick(language, "查看标的", "Open security")}
                          <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
                {holding.highlighted && holding.highlightLabel ? <Badge variant="primary">{holding.highlightLabel}</Badge> : null}
              </div>

              {hideAccountColumn ? null : <InfoBlock label={pick(language, "账户", "Account")} value={holding.account} muted={holding.accountType} />}

              <InfoBlock
                label={pick(language, "成本", "Cost")}
                value={pick(language, `总股数 ${holding.quantity}`, `Shares ${holding.quantity}`)}
                muted={pick(language, `平均成本 ${holding.avgCost}`, `Avg cost ${holding.avgCost}`)}
              />

              <div className="space-y-2">
                <InfoBlock
                  label={pick(language, "当前估值", "Current value")}
                  value={holding.value}
                  muted={pick(language, `现价 ${holding.lastPrice}`, `Last price ${holding.lastPrice}`)}
                />
              </div>

              <div className="space-y-2">
                <InfoBlock label={pick(language, "盈亏", "Gain / loss")} value={holding.gainLoss} />
                <div className="space-y-1 text-sm text-[color:var(--muted-foreground)]">
                  <p>{pick(language, `占整个组合 ${holding.portfolioShare}`, `Of total portfolio ${holding.portfolioShare}`)}</p>
                  <p>{pick(language, `占这个账户 ${holding.accountShare}`, `Inside this account ${holding.accountShare}`)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-[color:var(--muted-foreground)]">
                  <Badge variant={holding.freshnessVariant}>{freshnessLabel(language, holding.freshnessVariant)}</Badge>
                  <span>{holding.lastUpdated}</span>
                </div>
              </div>

              <div className="rounded-[22px] border border-white/55 bg-white/40 p-4 text-sm leading-7 text-[color:var(--muted-foreground)]">
                <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-[color:var(--primary)]">
                  <Crown className="h-3.5 w-3.5" />
                  {pick(language, "Loo皇审核", "Review note")}
                </div>
                {holding.signal}
              </div>
            </div>
          </div>
        );
      })}
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
      <p className="text-base font-semibold leading-8 text-[color:var(--foreground)]">{value}</p>
      {muted ? <p className="text-sm leading-7 text-[color:var(--muted-foreground)]">{muted}</p> : null}
    </div>
  );
}
