"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { assertApiData, getApiErrorMessage, safeJson } from "@/lib/client/api";
import type { DisplayLanguage } from "@/lib/i18n/ui";
import { pick } from "@/lib/i18n/ui";

export function RefreshPricesPanel({
  language = "zh",
  lastRefreshed,
  freshness,
  coverage
}: {
  language?: DisplayLanguage;
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
        setStatus({
          type: "error",
          message: getApiErrorMessage(
            payload,
            pick(language, "刷新价格失败。", "Failed to refresh portfolio prices.")
          )
        });
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
          pick(language, "刷新成功了，但没有返回可用的结果摘要。", "Refresh succeeded but returned no usable refresh summary.")
        );
      } catch (error) {
        setStatus({
          type: "error",
          message: error instanceof Error ? error.message : pick(language, "刷新价格失败。", "Failed to refresh portfolio prices.")
        });
        return;
      }

      setStatus({
        type: "success",
        message: pick(
          language,
          result.missingQuoteCount > 0
            ? `这次一共刷新了 ${result.refreshedHoldingCount} 笔持仓，覆盖 ${result.sampledSymbolCount} 个代码。其中有 ${result.missingQuoteCount} 个代码这次没拿到新报价，所以页面里可能还会继续显示它们之前缓存下来的价格。`
            : `这次一共刷新了 ${result.refreshedHoldingCount} 笔持仓，覆盖 ${result.sampledSymbolCount} 个代码。`,
          result.missingQuoteCount > 0
            ? `Refreshed ${result.refreshedHoldingCount} holdings across ${result.sampledSymbolCount} symbols. ${result.missingQuoteCount} symbols did not return a new quote this time, so some rows may still be showing older cached prices.`
            : `Refreshed ${result.refreshedHoldingCount} holdings across ${result.sampledSymbolCount} symbols.`
        )
      });
      router.refresh();
    });
  }

  return (
    <div className="space-y-3 rounded-2xl border border-[color:var(--border)] p-4">
      <div>
        <p className="font-medium">{pick(language, "更新持仓价格", "Refresh market prices")}</p>
        <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
          {pick(language, "刷新后会重算总值、盈亏和账户占比。", "Refresh quotes, then recalculate value, gain/loss, and weights.")}
        </p>
      </div>
      <div className="grid gap-2">
        <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card-muted)] px-4 py-3 text-sm text-[color:var(--muted-foreground)]">
          <span className="font-medium text-[color:var(--foreground)]">{pick(language, "上次刷新", "Last refreshed")}: </span>
          {lastRefreshed}
        </div>
        <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card-muted)] px-4 py-3 text-sm text-[color:var(--muted-foreground)]">
          <span className="font-medium text-[color:var(--foreground)]">{pick(language, "价格新鲜度", "Freshness")}: </span>
          {freshness}
        </div>
        <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card-muted)] px-4 py-3 text-sm text-[color:var(--muted-foreground)]">
          <span className="font-medium text-[color:var(--foreground)]">{pick(language, "覆盖到多少持仓", "Coverage")}: </span>
          {coverage}
        </div>
        <p className="px-1 text-xs leading-6 text-[color:var(--muted-foreground)]">
          {pick(
            language,
            "如果这次没拿到新报价，表格会继续显示之前缓存下来的价格。",
            "If a symbol misses a new quote this time, the table may still show an older cached price."
          )}
        </p>
      </div>
      <Button type="button" variant="secondary" onClick={refreshPrices} disabled={isPending} leadingIcon={<RefreshCcw className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} />}>
        {isPending
          ? pick(language, "正在更新价格...", "Refreshing prices...")
          : pick(language, "更新持仓价格", "Refresh prices")}
      </Button>
      {status.type !== "idle" ? (
        <div className={`rounded-2xl border px-4 py-3 text-sm leading-7 ${status.type === "success" ? "border-[#b6d7c7] bg-[#eef8f1] text-[#21613f]" : "border-[#e7b0b8] bg-[#fff3f5] text-[#8e2433]"}`}>
          {status.message}
        </div>
      ) : null}
    </div>
  );
}
