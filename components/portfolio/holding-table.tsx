import { Badge } from "@/components/ui/badge";
import { EmptyStatePanel } from "@/components/ui/empty-state-panel";
import type { DisplayLanguage } from "@/lib/i18n/ui";
import { pick } from "@/lib/i18n/ui";

type HoldingTableRow = {
  id: string;
  symbol: string;
  account: string;
  lastPrice: string;
  lastUpdated: string;
  freshnessVariant: "success" | "warning" | "neutral";
  weight: string;
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
            <th className="pb-3 font-medium">{pick(language, "占组合多少", "Weight")}</th>
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
                <div className="flex flex-col gap-2">
                  <span>{holding.symbol}</span>
                  {holding.highlightLabel ? (
                    <span className="inline-flex w-fit rounded-full border border-[rgba(232,121,249,0.22)] bg-[rgba(255,255,255,0.82)] px-2.5 py-1 text-xs font-medium text-[color:var(--foreground)]">
                      {holding.highlightLabel}
                    </span>
                  ) : null}
                </div>
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
              <td className="py-4">{holding.weight}</td>
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
