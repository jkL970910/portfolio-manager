"use client";

import { useState, useTransition } from "react";
import { Check, Plus, Star } from "lucide-react";
import { safeJson, getApiErrorMessage, assertApiData } from "@/lib/client/api";
import type { DisplayLanguage } from "@/lib/i18n/ui";
import { pick } from "@/lib/i18n/ui";

type WatchlistResponse = {
  watchlistSymbols: string[];
};

export function WatchlistToggleButton({
  symbol,
  language,
  initialTracked,
  compact = false
}: {
  symbol: string;
  language: DisplayLanguage;
  initialTracked: boolean;
  compact?: boolean;
}) {
  const normalizedSymbol = symbol.trim().toUpperCase();
  const [tracked, setTracked] = useState(initialTracked);
  const [status, setStatus] = useState("");
  const [isPending, startTransition] = useTransition();

  function toggleTracked() {
    setStatus("");
    startTransition(async () => {
      const response = await fetch("/api/settings/watchlist", {
        method: tracked ? "DELETE" : "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ symbol: normalizedSymbol })
      });
      const payload = await safeJson(response);
      if (!response.ok) {
        setStatus(
          getApiErrorMessage(
            payload,
            tracked
              ? pick(language, "从观察列表移除失败。", "Failed to remove the symbol from the watchlist.")
              : pick(language, "加入观察列表失败。", "Failed to add the symbol to the watchlist.")
          )
        );
        return;
      }

      try {
        const data = assertApiData<WatchlistResponse>(
          payload,
          (candidate) =>
            typeof candidate === "object" &&
            candidate !== null &&
            "watchlistSymbols" in candidate,
          tracked
            ? pick(language, "移除成功了，但没有返回新的观察列表。", "Removed successfully but no updated watchlist was returned.")
            : pick(language, "添加成功了，但没有返回新的观察列表。", "Added successfully but no updated watchlist was returned.")
        );
        setTracked(data.watchlistSymbols.includes(normalizedSymbol));
        setStatus(
          tracked
            ? pick(language, `${normalizedSymbol} 已从观察列表移除。`, `${normalizedSymbol} was removed from the watchlist.`)
            : pick(language, `${normalizedSymbol} 已加入观察列表。`, `${normalizedSymbol} was added to the watchlist.`)
        );
      } catch (error) {
        setStatus(error instanceof Error ? error.message : pick(language, "更新观察列表失败。", "Failed to update the watchlist."));
      }
    });
  }

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      <button
        type="button"
        onClick={toggleTracked}
        disabled={isPending}
        className={[
          "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition",
          tracked
            ? "border-[rgba(240,143,178,0.34)] bg-[rgba(255,255,255,0.82)] text-[color:var(--primary)]"
            : "border-white/60 bg-white/46 text-[color:var(--foreground)] hover:bg-white/58",
          isPending ? "opacity-70" : ""
        ].join(" ")}
      >
        {tracked ? <Star className="h-4 w-4 fill-current" /> : compact ? <Plus className="h-4 w-4" /> : <Check className="h-4 w-4" />}
        {tracked
          ? pick(language, compact ? "已在观察列表" : "从观察列表移除", compact ? "Watchlisted" : "Remove from watchlist")
          : pick(language, compact ? "加入观察列表" : "加入观察列表", compact ? "Watchlist" : "Add to watchlist")}
      </button>
      {status ? <p className="text-xs leading-6 text-[color:var(--muted-foreground)]">{status}</p> : null}
    </div>
  );
}
