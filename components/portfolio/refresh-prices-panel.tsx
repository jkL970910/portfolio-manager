"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCcw } from "lucide-react";
import { MascotAsset } from "@/components/brand/mascot-asset";
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
      <div className="grid gap-4 md:grid-cols-[1fr_112px] md:items-start">
        <div>
          <p className="font-medium">{pick(language, "更新持仓价格", "Refresh market prices")}</p>
          <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
            {pick(
              language,
              "系统会尽量把导入过的持仓价格更新到最新，然后重新计算总值、盈亏和账户占比。",
              "Pull the latest cached quotes for imported holdings, then recompute market value, gain/loss, and account weights."
            )}
          </p>
        </div>
        <div className="justify-self-start md:justify-self-end">
          <MascotAsset name="sideEyeReview" className="h-[112px] w-[112px]" sizes="112px" />
        </div>
      </div>
      <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card-muted)] px-4 py-3 text-sm text-[color:var(--muted-foreground)]">
        <p><span className="font-medium text-[color:var(--foreground)]">{pick(language, "上次刷新", "Last refreshed")}:</span> {lastRefreshed}</p>
        <p className="mt-1"><span className="font-medium text-[color:var(--foreground)]">{pick(language, "现在这些价格看起来有多新", "How recent the prices look")}:</span> {freshness}</p>
        <p className="mt-1"><span className="font-medium text-[color:var(--foreground)]">{pick(language, "这次覆盖到多少持仓", "How many holdings have usable prices")}:</span> {coverage}</p>
        <p className="mt-2 text-xs leading-6">
          {pick(
            language,
            "即使这次有些代码没拿到新报价，表格里它们仍可能显示之前缓存下来的价格和时间，所以“较新”并不一定代表这次刷新刚刚成功拿到新报价。",
            "Even when some symbols do not return a new quote this time, their rows may still show older cached prices and timestamps. So a row marked as fresh does not always mean this refresh just returned a brand-new quote."
          )}
        </p>
      </div>
      <Button type="button" variant="secondary" onClick={refreshPrices} disabled={isPending} leadingIcon={<RefreshCcw className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} />}>
        {isPending
          ? pick(language, "正在更新价格...", "Refreshing prices...")
          : pick(language, "更新持仓价格", "Refresh prices")}
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
