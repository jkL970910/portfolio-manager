"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DisplayLanguage } from "@/lib/i18n/ui";
import { pick } from "@/lib/i18n/ui";

export function ScenarioCompareCard({
  language,
  scenarios
}: {
  language: DisplayLanguage;
  scenarios: {
    id: string;
    label: string;
    amount: string;
    summary: string;
    diffs: string[];
    allocations: {
      assetClass: string;
      amount: string;
      account: string;
    }[];
  }[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{pick(language, "如果投入金额变了，会怎么变", "What changes if the contribution amount changes")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {scenarios.map((scenario) => (
          <div key={scenario.id} className="rounded-[24px] border border-white/55 bg-white/38 p-5 backdrop-blur-md">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_180px] lg:items-start">
              <div>
                <p className="text-sm font-semibold text-[color:var(--foreground)]">{scenario.label}</p>
                <p className="mt-2 text-sm leading-7 text-[color:var(--muted-foreground)]">{scenario.summary}</p>
                {scenario.diffs.length > 0 ? (
                  <div className="mt-3 rounded-[20px] border border-white/55 bg-white/44 px-4 py-3 backdrop-blur-md">
                    <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
                      {pick(language, "和你现在这组建议相比", "Compared with the current recommendation")}
                    </p>
                    <ul className="mt-3 space-y-2 text-sm leading-7 text-[color:var(--foreground)]">
                      {scenario.diffs.map((diff, index) => (
                        <li key={`${scenario.id}-diff-${index}`} className="flex gap-2">
                          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--foreground)]/55" />
                          <span>{diff}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
              <div className="rounded-[20px] border border-white/55 bg-white/44 px-4 py-3 text-right backdrop-blur-md">
                <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
                  {pick(language, "这次假设投入", "Assumed contribution")}
                </p>
                <p className="mt-2 font-semibold text-[color:var(--foreground)]">{scenario.amount}</p>
              </div>
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-3">
              {scenario.allocations.map((allocation, index) => (
                <div
                  key={`${scenario.id}-allocation-${index}`}
                  className="rounded-[22px] border border-white/55 bg-white/44 px-4 py-3 backdrop-blur-md"
                >
                  <p className="text-sm font-semibold text-[color:var(--foreground)]">{allocation.assetClass}</p>
                  <p className="mt-2 text-base font-semibold text-[color:var(--foreground)]">{allocation.amount}</p>
                  <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
                    {pick(language, "大致会先放进", "Likely goes into")} {allocation.account}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
