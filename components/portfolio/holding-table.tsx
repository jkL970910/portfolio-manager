import { Badge } from "@/components/ui/badge";

type HoldingTableRow = {
  symbol: string;
  account: string;
  lastPrice: string;
  lastUpdated: string;
  freshnessVariant: "success" | "warning" | "neutral";
  weight: string;
  gainLoss: string;
  signal: string;
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
            <tr key={`${holding.account}-${holding.symbol}`} className="border-t border-white/45">
              <td className="py-4 font-medium text-[color:var(--foreground)]">{holding.symbol}</td>
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
              <td className="py-6 text-[color:var(--muted-foreground)]" colSpan={7}>
                No holdings imported yet. Complete the import flow to unlock portfolio analysis.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
