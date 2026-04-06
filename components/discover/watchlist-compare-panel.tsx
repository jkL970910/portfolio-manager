"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { BarChart3 } from "lucide-react";
import { assertApiData, getApiErrorMessage, safeJson } from "@/lib/client/api";
import type { DisplayLanguage } from "@/lib/i18n/ui";
import { pick } from "@/lib/i18n/ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type CompareResponse = {
  scorecards: {
    symbol: string;
    name: string;
    assetClass: string;
    score: number;
    verdict: "strong" | "watch" | "weak";
    selectedAccountName: string;
    accountFitScore: number;
    taxFitScore: number;
    securityScore: number;
    warnings: string[];
  }[];
};

export function WatchlistComparePanel({
  language,
  watchlistSymbols,
  title,
  description,
  compareLabel
}: {
  language: DisplayLanguage;
  watchlistSymbols: string[];
  title?: string;
  description?: string;
  compareLabel?: string;
}) {
  const [selected, setSelected] = useState<string[]>(watchlistSymbols.slice(0, 5));
  const [scorecards, setScorecards] = useState<CompareResponse["scorecards"]>([]);
  const [status, setStatus] = useState("");
  const [isPending, startTransition] = useTransition();

  const normalizedWatchlist = useMemo(
    () => watchlistSymbols.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean),
    [watchlistSymbols]
  );

  function toggleSelected(symbol: string) {
    setSelected((current) =>
      current.includes(symbol)
        ? current.filter((entry) => entry !== symbol)
        : [...current, symbol].slice(0, 10)
    );
  }

  function compareSelected() {
    if (selected.length === 0) {
      setStatus(pick(language, "先选至少一支观察标的。", "Select at least one watchlist symbol first."));
      return;
    }

    setStatus("");
    startTransition(async () => {
      const response = await fetch("/api/recommendations/candidate-compare", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ symbols: selected })
      });
      const payload = await safeJson(response);
      if (!response.ok) {
        setStatus(getApiErrorMessage(payload, pick(language, "批量比较观察标的失败。", "Failed to compare watchlist candidates.")));
        return;
      }

      try {
        const data = assertApiData<CompareResponse>(
          payload,
          (candidate) =>
            typeof candidate === "object" &&
            candidate !== null &&
            "scorecards" in candidate,
          pick(language, "比较成功了，但没有返回可用的评分列表。", "Comparison succeeded but returned no usable score list.")
        );
        setScorecards([...data.scorecards].sort((left, right) => right.score - left.score));
      } catch (error) {
        setStatus(error instanceof Error ? error.message : pick(language, "批量比较观察标的失败。", "Failed to compare watchlist candidates."));
      }
    });
  }

  if (normalizedWatchlist.length === 0) {
    return (
      <Card>
        <CardContent className="px-6 py-6 text-sm leading-7 text-[color:var(--muted-foreground)]">
          {pick(language, "观察列表还是空的。先在搜索结果或标的页里加几支候选，再回来一起比较。", "Your watchlist is still empty. Add a few candidates from search or a symbol page, then come back to compare them together.")}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-5 px-6 py-6">
        <div className="space-y-3">
          <p className="text-sm font-semibold text-[color:var(--foreground)]">{title ?? pick(language, "观察列表候选对比", "Watchlist comparison")}</p>
          <p className="text-sm leading-7 text-[color:var(--muted-foreground)]">
            {description ?? pick(language, "先挑出你最想比较的几支，再让引擎用同一套规则把它们放在一起看。", "Pick the watchlist symbols you want to compare most, then let the engine score them with the same rule set side by side.")}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {normalizedWatchlist.map((symbol) => (
            <button
              key={symbol}
              type="button"
              onClick={() => toggleSelected(symbol)}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                selected.includes(symbol)
                  ? "border-[rgba(240,143,178,0.4)] bg-[rgba(255,255,255,0.84)] text-[color:var(--primary)]"
                  : "border-white/60 bg-white/44 text-[color:var(--foreground)] hover:bg-white/58"
              }`}
            >
              {symbol}
            </button>
          ))}
        </div>

        <Button type="button" onClick={compareSelected} leadingIcon={<BarChart3 className="h-4 w-4" />}>
          {isPending ? pick(language, "比较中...", "Comparing...") : compareLabel ?? pick(language, "比较已选观察标的", "Compare selected watchlist symbols")}
        </Button>

        {status ? <p className="text-sm leading-7 text-[color:var(--muted-foreground)]">{status}</p> : null}

        {scorecards.length > 0 ? (
          <div className="grid gap-4">
            {scorecards.map((card) => (
              <div key={card.symbol} className="rounded-[22px] border border-white/55 bg-white/38 p-5 backdrop-blur-md">
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_220px]">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="text-lg font-semibold text-[color:var(--foreground)]">{card.symbol}</p>
                      <p className="text-sm text-[color:var(--muted-foreground)]">{card.assetClass}</p>
                    </div>
                    <p className="text-sm leading-7 text-[color:var(--muted-foreground)]">{card.name}</p>
                    {card.warnings.length > 0 ? (
                      <div className="grid gap-2">
                        {card.warnings.map((warning) => (
                          <div key={warning} className="rounded-[18px] border border-[rgba(212,148,61,0.26)] bg-[rgba(255,248,238,0.72)] p-3 text-sm leading-6 text-[color:var(--muted-foreground)]">
                            {warning}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-[20px] border border-white/55 bg-white/42 p-4">
                    <p className="text-sm text-[color:var(--muted-foreground)]">{pick(language, "综合分", "Overall score")}</p>
                    <p className="mt-2 text-3xl font-semibold text-[color:var(--foreground)]">{card.score}</p>
                    <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
                      {card.verdict === "strong"
                        ? pick(language, "较强候选", "Strong candidate")
                        : card.verdict === "watch"
                          ? pick(language, "可继续观察", "Worth watching")
                          : pick(language, "需要谨慎", "Needs caution")}
                    </p>
                    <div className="mt-4 space-y-2 text-sm text-[color:var(--muted-foreground)]">
                      <p>{pick(language, `建议账户 ${card.selectedAccountName}`, `Suggested account ${card.selectedAccountName}`)}</p>
                      <p>{pick(language, `账户匹配 ${card.accountFitScore}/100`, `Account fit ${card.accountFitScore}/100`)}</p>
                      <p>{pick(language, `税务匹配 ${card.taxFitScore}/100`, `Tax fit ${card.taxFitScore}/100`)}</p>
                      <p>{pick(language, `标的分 ${card.securityScore}/100`, `Security score ${card.securityScore}/100`)}</p>
                    </div>
                    <Link
                      href={`/portfolio/security/${encodeURIComponent(card.symbol)}`}
                      className="mt-4 inline-flex items-center rounded-full border border-white/60 bg-white/50 px-3 py-2 text-sm font-medium text-[color:var(--foreground)] transition hover:bg-white/64"
                    >
                      {pick(language, "打开标的页", "Open symbol page")}
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
