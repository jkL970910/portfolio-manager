"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { assertApiData, getApiErrorMessage, safeJson } from "@/lib/client/api";
import type { DisplayLanguage } from "@/lib/i18n/ui";
import { pick } from "@/lib/i18n/ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type CandidateScoreResponse = {
  scorecard: {
    symbol: string;
    name: string;
    assetClass: string;
    assetClassSource: "explicit" | "existing-holding" | "known-universe" | "heuristic";
    currency: "CAD" | "USD";
    score: number;
    verdict: "strong" | "watch" | "weak";
    watchlistMatched: boolean;
    selectedAccountType: string;
    selectedAccountName: string;
    accountFitScore: number;
    taxFitScore: number;
    securityScore: number;
    fxPenaltyBps: number;
    summary: string;
    drivers: string[];
    warnings: string[];
  };
};

export function CandidateScorePanel({
  language,
  symbol,
  name,
  currency,
  assetClass,
  securityType,
  compact = false
}: {
  language: DisplayLanguage;
  symbol: string;
  name?: string;
  currency?: "CAD" | "USD";
  assetClass?: string;
  securityType?: string | null;
  compact?: boolean;
}) {
  const [scorecard, setScorecard] = useState<CandidateScoreResponse["scorecard"] | null>(null);
  const [status, setStatus] = useState("");
  const [isPending, startTransition] = useTransition();

  function scoreCandidate() {
    setStatus("");
    startTransition(async () => {
      const response = await fetch("/api/recommendations/candidate-score", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          symbol,
          name,
          currency,
          assetClass,
          securityType
        })
      });
      const payload = await safeJson(response);
      if (!response.ok) {
        setStatus(getApiErrorMessage(payload, pick(language, "给这支标的打分失败。", "Failed to score this candidate security.")));
        return;
      }

      try {
        const data = assertApiData<CandidateScoreResponse>(
          payload,
          (candidate) =>
            typeof candidate === "object" &&
            candidate !== null &&
            "scorecard" in candidate,
          pick(language, "评分成功了，但没有返回可用的分数卡。", "Scoring succeeded but returned no usable scorecard.")
        );
        setScorecard(data.scorecard);
      } catch (error) {
        setStatus(error instanceof Error ? error.message : pick(language, "给这支标的打分失败。", "Failed to score this candidate security."));
      }
    });
  }

  return (
    <div className="space-y-3">
      <Button type="button" variant="secondary" className={compact ? "w-full" : undefined} onClick={scoreCandidate} leadingIcon={<Sparkles className="h-4 w-4" />}>
        {isPending ? pick(language, "评分中...", "Scoring...") : pick(language, "给这支标的打分", "Score this security")}
      </Button>
      {status ? <p className="text-sm leading-7 text-[color:var(--muted-foreground)]">{status}</p> : null}
      {scorecard ? (
        <Card>
          <CardContent className="space-y-4 px-5 py-5">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-[color:var(--foreground)]">{pick(language, `${scorecard.symbol} 的候选评分`, `Candidate score for ${scorecard.symbol}`)}</p>
              <p className="text-sm leading-7 text-[color:var(--muted-foreground)]">{scorecard.summary}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <ScoreFact label={pick(language, "综合分", "Overall score")} value={String(scorecard.score)} />
              <ScoreFact
                label={pick(language, "结论", "Verdict")}
                value={
                  scorecard.verdict === "strong"
                    ? pick(language, "较强候选", "Strong candidate")
                    : scorecard.verdict === "watch"
                      ? pick(language, "可继续观察", "Worth watching")
                      : pick(language, "需要谨慎", "Needs caution")
                }
              />
              <ScoreFact label={pick(language, "资产类别", "Sleeve")} value={scorecard.assetClass} />
              <ScoreFact label={pick(language, "建议账户", "Suggested account")} value={scorecard.selectedAccountName} />
              <ScoreFact label={pick(language, "账户匹配", "Account fit")} value={`${scorecard.accountFitScore}/100`} />
              <ScoreFact label={pick(language, "税务匹配", "Tax fit")} value={`${scorecard.taxFitScore}/100`} />
            </div>
            <div className="grid gap-3">
              {scorecard.drivers.map((driver) => (
                <div key={driver} className="rounded-[20px] border border-white/55 bg-white/38 p-4 text-sm leading-7 text-[color:var(--muted-foreground)] backdrop-blur-md">
                  {driver}
                </div>
              ))}
            </div>
            {scorecard.warnings.length > 0 ? (
              <div className="grid gap-3">
                {scorecard.warnings.map((warning) => (
                  <div key={warning} className="rounded-[20px] border border-[rgba(212,148,61,0.26)] bg-[rgba(255,248,238,0.72)] p-4 text-sm leading-7 text-[color:var(--muted-foreground)]">
                    {warning}
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function ScoreFact({
  label,
  value
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[18px] border border-white/55 bg-white/42 p-4">
      <p className="text-xs uppercase tracking-[0.14em] text-[color:var(--muted-foreground)]">{label}</p>
      <p className="mt-2 text-sm leading-6 font-semibold text-[color:var(--foreground)]">{value}</p>
    </div>
  );
}
