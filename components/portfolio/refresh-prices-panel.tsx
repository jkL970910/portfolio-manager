"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCcw } from "lucide-react";
import { MascotAsset } from "@/components/brand/mascot-asset";
import { Button } from "@/components/ui/button";
import { assertApiData, getApiErrorMessage, safeJson } from "@/lib/client/api";

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
      const payload = await safeJson(response);

      if (!response.ok) {
        setStatus({ type: "error", message: getApiErrorMessage(payload, "Failed to refresh portfolio prices.") });
        return;
      }

      let result: {
        refreshedHoldingCount: number;
        missingQuoteCount: number;
        sampledSymbolCount: number;
      };
      try {
        result = assertApiData(
          payload,
          (candidate) =>
            typeof candidate === "object" &&
            candidate !== null &&
            "refreshedHoldingCount" in candidate &&
            "missingQuoteCount" in candidate &&
            "sampledSymbolCount" in candidate,
          "Refresh succeeded but returned no usable refresh summary."
        );
      } catch (error) {
        setStatus({ type: "error", message: error instanceof Error ? error.message : "Failed to refresh portfolio prices." });
        return;
      }
      setStatus({
        type: "success",
        message: `Refreshed ${result.refreshedHoldingCount} holdings across ${result.sampledSymbolCount} symbols.${result.missingQuoteCount > 0 ? ` Missing quotes for ${result.missingQuoteCount} symbols.` : ""}`
      });
      router.refresh();
    });
  }

  return (
    <div className="space-y-3 rounded-2xl border border-[color:var(--border)] p-4">
      <div className="grid gap-4 md:grid-cols-[1fr_112px] md:items-start">
        <div>
          <p className="font-medium">Refresh market prices</p>
          <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
            Pull the latest cached quotes for imported holdings, then recompute market value, gain/loss, and account weights.
          </p>
        </div>
        <div className="justify-self-start md:justify-self-end">
          <MascotAsset name="sideEyeReview" className="h-[112px] w-[112px]" sizes="112px" />
        </div>
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
        <div className={`grid gap-3 rounded-2xl border px-4 py-3 text-sm md:grid-cols-[1fr_96px] md:items-center ${status.type === "success" ? "border-[#b6d7c7] bg-[#eef8f1] text-[#21613f]" : "border-[#e7b0b8] bg-[#fff3f5] text-[#8e2433]"}`}>
          <div>{status.message}</div>
          <div className="justify-self-start md:justify-self-end">
            <MascotAsset name={status.type === "success" ? "successSmirk" : "alertRun"} className="h-24 w-24" sizes="96px" />
          </div>
        </div>
      ) : null}
    </div>
  );
}
