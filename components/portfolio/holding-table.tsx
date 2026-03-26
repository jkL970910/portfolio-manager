import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { SecurityMark } from "@/components/portfolio/security-mark";
import { Badge } from "@/components/ui/badge";
import { EmptyStatePanel } from "@/components/ui/empty-state-panel";
import type { DisplayLanguage } from "@/lib/i18n/ui";
import { pick } from "@/lib/i18n/ui";

type HoldingTableRow = {
  id: string;
  symbol: string;
  name: string;
  assetClass: string;
  account: string;
  href?: string;
  lastPrice: string;
  lastUpdated: string;
  freshnessVariant: "success" | "warning" | "neutral";
  portfolioShare: string;
  accountShare: string;
  gainLoss: string;
  signal: string;
  highlighted?: boolean;
  highlightLabel?: string;
};

export function HoldingTable({
  holdings,
  language = "zh"
}: {
  holdings: HoldingTableRow[];
  language?: DisplayLanguage;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="text-[color:var(--muted-foreground)]">
          <tr>
            <th className="pb-3 font-medium">{pick(language, "持仓", "Holding")}</th>
            <th className="pb-3 font-medium">{pick(language, "放在哪个账户里", "Account")}</th>
            <th className="pb-3 font-medium">{pick(language, "最近价格", "Last price")}</th>
            <th className="pb-3 font-medium">{pick(language, "上次更新", "Last updated")}</th>
            <th className="pb-3 font-medium">{pick(language, "大概占多少", "Share")}</th>
            <th className="pb-3 font-medium">{pick(language, "盈亏", "Gain / loss")}</th>
            <th className="pb-3 font-medium">{pick(language, "现在先怎么看这笔", "What this means now")}</th>
          </tr>
        </thead>
        <tbody>
          {holdings.map((holding) => (
            <tr
              key={holding.id}
              className={holding.highlighted
                ? "border-t border-[rgba(232,121,249,0.35)] bg-[linear-gradient(135deg,rgba(255,255,255,0.7),rgba(245,214,235,0.42),rgba(212,226,255,0.34))]"
                : "border-t border-white/45"}
            >
              <td className="py-4 font-medium text-[color:var(--foreground)]">
                {holding.href ? (
                  <Link
                    href={holding.href}
                    className="group flex items-start gap-3 rounded-[18px] border border-transparent px-2 py-2 transition-[background-color,border-color,box-shadow,color] duration-200 hover:border-white/60 hover:bg-white/42 hover:shadow-[0_10px_22px_rgba(110,103,130,0.06)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]"
                  >
                    <SecurityMark symbol={holding.symbol} assetClass={holding.assetClass} />
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[color:var(--foreground)] transition group-hover:text-[color:var(--secondary)]">
                          {holding.symbol}
                        </span>
                          <ArrowUpRight className="h-3.5 w-3.5 text-[color:var(--muted-foreground)] transition-transform duration-200 group-hover:-translate-y-px group-hover:translate-x-px" />
                        <span className="text-[11px] font-medium text-[color:var(--muted-foreground)]">
                          {pick(language, "点开详情", "Open detail")}
                        </span>
                      </div>
                      <span className="text-xs font-medium text-[color:var(--muted-foreground)]">{holding.name}</span>
                      {holding.highlightLabel ? (
                        <span className="inline-flex w-fit rounded-full border border-[rgba(232,121,249,0.22)] bg-[rgba(255,255,255,0.82)] px-2.5 py-1 text-xs font-medium text-[color:var(--foreground)]">
                          {holding.highlightLabel}
                        </span>
                      ) : null}
                    </div>
                  </Link>
                ) : (
                  <div className="flex items-start gap-3">
                    <SecurityMark symbol={holding.symbol} assetClass={holding.assetClass} />
                    <div className="flex flex-col gap-2">
                      <span>{holding.symbol}</span>
                      <span className="text-xs font-medium text-[color:var(--muted-foreground)]">{holding.name}</span>
                      {holding.highlightLabel ? (
                        <span className="inline-flex w-fit rounded-full border border-[rgba(232,121,249,0.22)] bg-[rgba(255,255,255,0.82)] px-2.5 py-1 text-xs font-medium text-[color:var(--foreground)]">
                          {holding.highlightLabel}
                        </span>
                      ) : null}
                    </div>
                  </div>
                )}
              </td>
              <td className="py-4 text-[color:var(--muted-foreground)]">{holding.account}</td>
              <td className="py-4">{holding.lastPrice}</td>
              <td className="py-4">
                <div className="flex flex-col gap-2">
                  <span className="text-[color:var(--muted-foreground)]">{holding.lastUpdated}</span>
                  <Badge variant={holding.freshnessVariant}>
                    {holding.freshnessVariant === "success"
                      ? pick(language, "较新", "Fresh")
                      : holding.freshnessVariant === "warning"
                        ? pick(language, "偏旧", "Aging")
                        : pick(language, "未知", "Unknown")}
                  </Badge>
                </div>
              </td>
              <td className="py-4">
                <div className="space-y-1 text-sm">
                  <div>
                    <span className="text-[color:var(--muted-foreground)]">{pick(language, "占整个组合", "Of total portfolio")}</span>
                    <span className="ml-2 font-medium text-[color:var(--foreground)]">{holding.portfolioShare}</span>
                  </div>
                  <div>
                    <span className="text-[color:var(--muted-foreground)]">{pick(language, "占这个账户", "Inside this account")}</span>
                    <span className="ml-2 font-medium text-[color:var(--foreground)]">{holding.accountShare}</span>
                  </div>
                </div>
              </td>
              <td className="py-4">{holding.gainLoss}</td>
              <td className="py-4 text-[color:var(--muted-foreground)]">{holding.signal}</td>
            </tr>
          ))}
          {holdings.length === 0 ? (
            <tr className="border-t border-white/45">
              <td className="py-6" colSpan={7}>
                <EmptyStatePanel
                  title={pick(language, "还没有持仓", "No holdings imported yet")}
                  text={pick(language, "先完成一次投资导入，这里才会开始显示组合明细。", "Complete an import first to unlock the portfolio view.")}
                />
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
