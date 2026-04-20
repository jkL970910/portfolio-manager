"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { assertApiData, getApiErrorMessage, safeJson } from "@/lib/client/api";
import type { DisplayLanguage } from "@/lib/i18n/ui";
import { pick } from "@/lib/i18n/ui";

type RefreshSecurityQuoteResult = {
  symbol: string;
  matchedHoldingCount: number;
  refreshedHoldingCount: number;
  missingQuoteCount: number;
  sampledSymbolCount: number;
  ambiguousHoldingCount: number;
  quoteFound: boolean;
  quotePrice: number | null;
  quoteCurrency: string | null;
  refreshedAt: string;
};

export function RefreshSecurityPricePanel({
  language = "zh",
  symbol,
  lastRefreshed,
  freshness,
  compact = false
}: {
  language?: DisplayLanguage;
  symbol: string;
  lastRefreshed: string;
  freshness: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ type: "idle" | "success" | "error"; message: string }>({
    type: "idle",
    message: ""
  });

  function refreshSecurityPrice() {
    setStatus({ type: "idle", message: "" });

    startTransition(async () => {
      const response = await fetch(`/api/portfolio/security/${encodeURIComponent(symbol)}/refresh-price`, {
        method: "POST"
      });
      const payload = await safeJson(response);

      if (!response.ok) {
        setStatus({
          type: "error",
          message: getApiErrorMessage(payload, pick(language, "刷新这支标的的价格失败了。", "Failed to refresh the price for this security."))
        });
        return;
      }

      let result: RefreshSecurityQuoteResult;
      try {
        result = assertApiData<RefreshSecurityQuoteResult>(
          payload,
          (candidate) =>
            typeof candidate === "object" &&
            candidate !== null &&
            "symbol" in candidate &&
            "refreshedHoldingCount" in candidate &&
            "quoteFound" in candidate,
          pick(language, "刷新成功了，但没有返回可用的结果摘要。", "Refresh succeeded but returned no usable result summary.")
        );
      } catch (error) {
        setStatus({
          type: "error",
          message:
            error instanceof Error
              ? error.message
              : pick(language, "刷新这支标的的价格失败了。", "Failed to refresh the price for this security.")
        });
        return;
      }

      const successMessage = result.matchedHoldingCount > 0
        ? result.refreshedHoldingCount > 0
          ? pick(
              language,
              `这次刷新到了 ${result.refreshedHoldingCount} 笔 ${result.symbol} 持仓。${result.ambiguousHoldingCount > 0 ? "有些仓位因为币种或交易所不匹配，被暂时跳过了。" : ""}`,
              `Refreshed ${result.refreshedHoldingCount} ${result.symbol} holding entries.${result.ambiguousHoldingCount > 0 ? " Some rows were skipped because the currency or exchange context did not match cleanly." : ""}`
            )
          : pick(
              language,
              result.quoteFound
                ? `这次拿到了 ${result.symbol} 的新报价，但没有更新到你的本地持仓。通常是因为币种或交易所上下文还不够明确。`
                : `这次还没有拿到 ${result.symbol} 的新报价。`,
              result.quoteFound
                ? `A new quote for ${result.symbol} was found, but none of your local holding rows were updated. This usually means the currency or exchange context still needs clarification.`
                : `No fresh quote was returned for ${result.symbol} this time.`
            )
        : pick(
            language,
            result.quoteFound
              ? `这次拿到了 ${result.symbol} 的参考报价，但你本地还没有这支标的的真实持仓可更新。`
              : `这次还没有拿到 ${result.symbol} 的参考报价。`,
            result.quoteFound
              ? `A reference quote for ${result.symbol} was found, but you do not currently hold it locally, so there was nothing to update.`
              : `No reference quote for ${result.symbol} was returned this time.`
          );

      setStatus({
        type: "success",
        message: successMessage
      });
      router.refresh();
    });
  }

  return (
    <div className={`space-y-3 rounded-[24px] border border-white/55 bg-white/36 backdrop-blur-md ${compact ? "p-4" : "p-4"}`}>
      <div>
        <p className="font-medium text-[color:var(--foreground)]">{pick(language, "只刷新这支标的", "Refresh only this security")}</p>
        <p className={`mt-2 text-[color:var(--muted-foreground)] ${compact ? "text-sm leading-6" : "text-sm leading-6"}`}>
          {pick(
            language,
            compact
              ? "想单独试试这支标的能不能拿到新报价，就在这里刷，不用重刷整个组合。"
              : "如果你想单独验证这支标的能不能拿到新报价，这里可以只刷新它，不用重刷整个组合。",
            compact
              ? "Use this to test whether this symbol can return a fresh quote without refreshing the whole portfolio."
              : "Use this when you want to test whether this symbol can return a fresh quote without refreshing the whole portfolio."
          )}
        </p>
      </div>
      <div className={`grid gap-2 ${compact ? "sm:grid-cols-3" : ""}`}>
        <div className="rounded-[20px] border border-white/55 bg-white/42 px-4 py-3 text-sm text-[color:var(--muted-foreground)]">
          <span className="font-medium text-[color:var(--foreground)]">{pick(language, "代码", "Symbol")}: </span>
          {symbol}
        </div>
        <div className="rounded-[20px] border border-white/55 bg-white/42 px-4 py-3 text-sm text-[color:var(--muted-foreground)]">
          <span className="font-medium text-[color:var(--foreground)]">{pick(language, compact ? "缓存时间" : "当前缓存时间", compact ? "Cached at" : "Cached quote time")}: </span>
          {lastRefreshed}
        </div>
        <div className="rounded-[20px] border border-white/55 bg-white/42 px-4 py-3 text-sm text-[color:var(--muted-foreground)]">
          <span className="font-medium text-[color:var(--foreground)]">{pick(language, compact ? "状态" : "当前状态", compact ? "Freshness" : "Current freshness")}: </span>
          {freshness}
        </div>
      </div>
      <Button
        type="button"
        variant="secondary"
        className="w-full"
        onClick={refreshSecurityPrice}
        disabled={isPending}
        leadingIcon={<RefreshCcw className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} />}
      >
        {isPending
          ? pick(language, "正在刷新这支标的...", "Refreshing this security...")
          : pick(language, "刷新这支标的价格", "Refresh this security")}
      </Button>
      {status.type !== "idle" ? (
        <div
          className={`rounded-[20px] border px-4 py-3 text-sm leading-7 ${
            status.type === "success"
              ? "border-[#b6d7c7] bg-[#eef8f1] text-[#21613f]"
              : "border-[#e7b0b8] bg-[#fff3f5] text-[#8e2433]"
          }`}
        >
          {status.message}
        </div>
      ) : null}
    </div>
  );
}
