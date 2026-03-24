import { Badge } from "@/components/ui/badge";
import { EmptyStatePanel } from "@/components/ui/empty-state-panel";

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

export function HoldingTable({ holdings }: { holdings: HoldingTableRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="text-[color:var(--muted-foreground)]">
          <tr>
            <th className="pb-3 font-medium">Holding</th>
            <th className="pb-3 font-medium">Account</th>
            <th className="pb-3 font-medium">Last Price</th>
            <th className="pb-3 font-medium">Last Updated</th>
            <th className="pb-3 font-medium">Weight</th>
            <th className="pb-3 font-medium">Gain / Loss</th>
            <th className="pb-3 font-medium">Signal</th>
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
                    {holding.freshnessVariant === "success" ? "Fresh" : holding.freshnessVariant === "warning" ? "Aging" : "Unknown"}
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
                  title="No holdings imported yet"
                  text="Complete the import flow to unlock portfolio analysis."
                />
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
