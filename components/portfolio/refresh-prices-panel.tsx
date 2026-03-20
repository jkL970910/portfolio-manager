"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function RefreshPricesPanel({
  lastRefreshed,
  freshness,
  coverage
}: {
  lastRefreshed: string;
  freshness: string;
  coverage: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ type: "idle" | "success" | "error"; message: string }>({
    type: "idle",
    message: ""
  });

  function refreshPrices() {
    setStatus({ type: "idle", message: "" });

    startTransition(async () => {
      const response = await fetch("/api/portfolio/refresh-prices", { method: "POST" });
      const payload = await response.json();

      if (!response.ok) {
        setStatus({ type: "error", message: payload.error ?? "Failed to refresh portfolio prices." });
        return;
      }

      const result = payload.data as {
        refreshedHoldingCount: number;
        missingQuoteCount: number;
        sampledSymbolCount: number;
      };
      setStatus({
        type: "success",
        message: `Refreshed ${result.refreshedHoldingCount} holdings across ${result.sampledSymbolCount} symbols.${result.missingQuoteCount > 0 ? ` Missing quotes for ${result.missingQuoteCount} symbols.` : ""}`
      });
      router.refresh();
    });
  }

  return (
    <div className="space-y-3 rounded-2xl border border-[color:var(--border)] p-4">
      <div>
        <p className="font-medium">Refresh market prices</p>
        <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
          Pull the latest cached quotes for imported holdings, then recompute market value, gain/loss, and account weights.
        </p>
      </div>
      <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card-muted)] px-4 py-3 text-sm text-[color:var(--muted-foreground)]">
        <p><span className="font-medium text-[color:var(--foreground)]">Last refreshed:</span> {lastRefreshed}</p>
        <p className="mt-1"><span className="font-medium text-[color:var(--foreground)]">Freshness:</span> {freshness}</p>
        <p className="mt-1"><span className="font-medium text-[color:var(--foreground)]">Coverage:</span> {coverage}</p>
      </div>
      <Button type="button" variant="secondary" onClick={refreshPrices} disabled={isPending} leadingIcon={<RefreshCcw className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} />}>
        {isPending ? "Refreshing prices..." : "Refresh prices"}
      </Button>
      {status.type !== "idle" ? (
        <div className={`rounded-2xl border px-4 py-3 text-sm ${status.type === "success" ? "border-[#b6d7c7] bg-[#eef8f1] text-[#21613f]" : "border-[#e7b0b8] bg-[#fff3f5] text-[#8e2433]"}`}>
          {status.message}
        </div>
      ) : null}
    </div>
  );
}
