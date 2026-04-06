"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { ArrowRight, Search } from "lucide-react";
import type { SecuritySearchResult } from "@/lib/market-data/types";
import type { DisplayLanguage } from "@/lib/i18n/ui";
import { pick } from "@/lib/i18n/ui";
import { assertApiData, getApiErrorMessage, safeJson } from "@/lib/client/api";
import { CandidateScorePanel } from "@/components/portfolio/candidate-score-panel";
import { WatchlistComparePanel } from "@/components/discover/watchlist-compare-panel";
import { WatchlistToggleButton } from "@/components/portfolio/watchlist-toggle-button";
import { SecurityMark } from "@/components/portfolio/security-mark";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type SearchResponse = {
  results: SecuritySearchResult[];
  providerHealth: {
    openFigiConfigured: boolean;
    twelveDataConfigured: boolean;
  };
};

export function SecurityDiscoveryWorkbench({
  language,
  initialWatchlistSymbols
}: {
  language: DisplayLanguage;
  initialWatchlistSymbols: string[];
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SecuritySearchResult[]>([]);
  const [selectedSearchSymbols, setSelectedSearchSymbols] = useState<string[]>([]);
  const [searched, setSearched] = useState(false);
  const [status, setStatus] = useState("");
  const [providerStatus, setProviderStatus] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const watchlistSet = useMemo(
    () => new Set(initialWatchlistSymbols.map((symbol) => symbol.trim().toUpperCase())),
    [initialWatchlistSymbols]
  );

  function runSearch() {
    const trimmed = query.trim();
    if (!trimmed) {
      setSearched(true);
      setResults([]);
      setProviderStatus(null);
      setStatus(pick(language, "先输入一个代码或名称。", "Enter a symbol or company name first."));
      return;
    }

    setStatus("");
    startTransition(async () => {
      const response = await fetch(`/api/market-data/search?query=${encodeURIComponent(trimmed)}`);
      const payload = await safeJson(response);
      if (!response.ok) {
        setSearched(true);
        setResults([]);
        setProviderStatus(null);
        setStatus(getApiErrorMessage(payload, pick(language, "搜索标的失败。", "Security search failed.")));
        return;
      }

      try {
        const data = assertApiData<SearchResponse>(
          payload,
          (candidate) =>
            typeof candidate === "object" &&
            candidate !== null &&
            "results" in candidate &&
            "providerHealth" in candidate,
          pick(language, "搜索成功了，但没有返回可用结果。", "Search succeeded but returned no usable result.")
        );
        setSearched(true);
        setResults(data.results);
        setSelectedSearchSymbols([]);
        setProviderStatus(
          data.providerHealth.twelveDataConfigured
            ? pick(language, "当前搜索由 Twelve Data 提供。", "Search is currently backed by Twelve Data.")
            : pick(language, "当前没有配置实时搜索 provider。", "No live search provider is currently configured.")
        );
        setStatus(
          data.results.length > 0
            ? pick(language, `找到 ${data.results.length} 个候选结果。`, `Found ${data.results.length} candidate results.`)
            : pick(language, "这次没有找到匹配结果。", "No matching securities were found.")
        );
      } catch (error) {
        setSearched(true);
        setResults([]);
        setProviderStatus(null);
        setStatus(error instanceof Error ? error.message : pick(language, "搜索标的失败。", "Security search failed."));
      }
    });
  }

  function toggleSelectedSearchSymbol(symbol: string) {
    setSelectedSearchSymbols((current) =>
      current.includes(symbol)
        ? current.filter((entry) => entry !== symbol)
        : [...current, symbol].slice(0, 10)
    );
  }
  return (
    <div className="space-y-6">
      <WatchlistComparePanel language={language} watchlistSymbols={initialWatchlistSymbols} />

      {searched && results.length > 0 ? (
        <WatchlistComparePanel
          language={language}
          watchlistSymbols={selectedSearchSymbols}
          title={pick(language, "当前搜索结果对比", "Current search comparison")}
          description={pick(language, "先从这次搜索结果里挑出几支，再把它们放在一起比较。", "Pick a few symbols from the current search results and compare them side by side.")}
          compareLabel={pick(language, "比较已选搜索结果", "Compare selected search results")}
        />
      ) : null}

      <Card className="overflow-hidden bg-[linear-gradient(135deg,rgba(255,255,255,0.72),rgba(248,223,233,0.54),rgba(224,235,255,0.46))]">
        <CardContent className="space-y-5 px-6 py-6">
          <div className="space-y-3">
            <p className="text-sm font-medium uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
              {pick(language, "标的发现台", "Security discovery")}
            </p>
            <h2 className="text-[30px] font-semibold tracking-[-0.04em] text-[color:var(--foreground)]">
              {pick(language, "把你自己的想法也带进推荐系统里。", "Bring your own ideas into the recommendation engine.")}
            </h2>
            <p className="max-w-3xl text-sm leading-7 text-[color:var(--muted-foreground)]">
              {pick(
                language,
                "这里不是只看系统推荐什么，而是先搜索你正在考虑的标的，再决定要不要加入观察列表，或者直接打开统一标的页继续分析。",
                "This page is for the ideas you want to investigate yourself before deciding whether to watch them or open the unified symbol page for deeper analysis."
              )}
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  runSearch();
                }
              }}
              placeholder={pick(language, "搜索代码或名称，例如 XEQT、VFV、Apple", "Search symbol or name, for example XEQT, VFV, Apple")}
              className="w-full rounded-[22px] border border-white/55 bg-white/54 px-5 py-4 text-sm text-[color:var(--foreground)] outline-none backdrop-blur-md"
            />
            <Button type="button" onClick={runSearch} leadingIcon={<Search className={`h-4 w-4 ${isPending ? "animate-pulse" : ""}`} />}>
              {isPending ? pick(language, "搜索中...", "Searching...") : pick(language, "搜索标的", "Search")}
            </Button>
          </div>

          {status ? <p className="text-sm leading-7 text-[color:var(--muted-foreground)]">{status}</p> : null}
          {providerStatus ? <p className="text-xs leading-6 text-[color:var(--muted-foreground)]">{providerStatus}</p> : null}
        </CardContent>
      </Card>

      {!searched ? null : results.length === 0 ? (
        <Card>
          <CardContent className="px-6 py-6 text-sm leading-7 text-[color:var(--muted-foreground)]">
            {pick(
              language,
              "还没有可展示的结果。你可以换个代码、公司名，或者直接回设置页整理观察列表。",
              "No results are available yet. Try another symbol or name, or return to Settings to clean up the existing watchlist."
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {results.map((result) => {
            const normalized = result.symbol.trim().toUpperCase();
            return (
              <Card key={`${result.symbol}-${result.exchange ?? "unknown"}`}>
                <CardContent className="flex flex-col gap-4 px-5 py-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <SecurityMark symbol={result.symbol} assetClass={result.type} className="h-12 w-12 rounded-[14px] text-[13px]" />
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-3">
                        <p className="text-[22px] leading-none font-semibold tracking-[-0.03em] text-[color:var(--foreground)]">{result.symbol}</p>
                        <div className="flex flex-wrap gap-2 text-xs text-[color:var(--muted-foreground)]">
                          {result.exchange ? <span className="rounded-full border border-white/60 bg-white/44 px-3 py-1">{result.exchange}</span> : null}
                          {result.currency ? <span className="rounded-full border border-white/60 bg-white/44 px-3 py-1">{result.currency}</span> : null}
                          <span className="rounded-full border border-white/60 bg-white/44 px-3 py-1">{result.type}</span>
                        </div>
                      </div>
                      <p className="text-sm leading-7 text-[color:var(--muted-foreground)]">{result.name}</p>
                      <button
                        type="button"
                        onClick={() => toggleSelectedSearchSymbol(normalized)}
                        className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                          selectedSearchSymbols.includes(normalized)
                            ? "border-[rgba(240,143,178,0.4)] bg-[rgba(255,255,255,0.84)] text-[color:var(--primary)]"
                            : "border-white/60 bg-white/44 text-[color:var(--foreground)] hover:bg-white/58"
                        }`}
                      >
                        {selectedSearchSymbols.includes(normalized)
                          ? pick(language, "已选入比较", "Selected for compare")
                          : pick(language, "加入比较", "Add to compare")}
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col items-start gap-3 lg:items-end">
                    <WatchlistToggleButton
                      symbol={normalized}
                      language={language}
                      initialTracked={watchlistSet.has(normalized)}
                      compact
                    />
                    <Link
                      href={`/portfolio/security/${encodeURIComponent(result.symbol)}`}
                      className="group inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/46 px-4 py-2 text-sm font-medium text-[color:var(--foreground)] backdrop-blur-md transition hover:bg-white/58"
                    >
                      {pick(language, "打开标的页", "Open symbol page")}
                      <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                    </Link>
                  </div>
                </CardContent>
                <CardContent className="border-t border-white/40 px-5 py-5">
                  <CandidateScorePanel
                    language={language}
                    symbol={normalized}
                    name={result.name}
                    currency={result.currency === "USD" ? "USD" : "CAD"}
                    securityType={result.type}
                  />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
