"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type DrilldownItem = {
  id: string;
  label: string;
  href?: string;
  score: number;
  status: string;
  summary: string;
  impactHints?: {
    amount: number;
    hint: string;
  }[];
  drivers: string[];
  actions: string[];
};

function formatAmountChip(amount: number) {
  if (amount >= 1000) {
    const short = amount % 1000 === 0 ? amount / 1000 : amount / 1000;
    return `$${short}k`;
  }
  return `$${amount}`;
}

export function HealthDrilldownCard({
  title,
  description,
  items,
  openLabel,
  driversLabel,
  actionsLabel,
  scenarioLabel
}: {
  title: string;
  description: string;
  items: DrilldownItem[];
  openLabel: string;
  driversLabel: string;
  actionsLabel: string;
  scenarioLabel: string;
}) {
  const availableAmounts = useMemo(
    () =>
      Array.from(
        new Set(
          items.flatMap((item) => item.impactHints?.map((entry) => entry.amount) ?? [])
        )
      ).sort((left, right) => left - right),
    [items]
  );

  const defaultAmount = availableAmounts.includes(5000)
    ? 5000
    : (availableAmounts[0] ?? 0);

  const [selectedAmount, setSelectedAmount] = useState(defaultAmount);

  return (
    <Card>
      <CardHeader className="space-y-4">
        <div className="space-y-2">
          <CardTitle>{title}</CardTitle>
          <p className="text-sm leading-7 text-[color:var(--muted-foreground)]">{description}</p>
        </div>
        {availableAmounts.length > 0 ? (
          <div className="rounded-[24px] border border-white/55 bg-white/36 p-3 backdrop-blur-md">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <p className="text-sm font-semibold text-[color:var(--foreground)]">{scenarioLabel}</p>
              <div className="inline-flex w-full max-w-fit rounded-full border border-white/60 bg-white/66 p-1 backdrop-blur-md">
                {availableAmounts.map((amount) => {
                  const active = amount === selectedAmount;
                  return (
                    <button
                      key={`${title}-${amount}`}
                      type="button"
                      onClick={() => setSelectedAmount(amount)}
                      className={[
                        "rounded-full px-4 py-2 text-sm font-medium transition",
                        active
                          ? "bg-[linear-gradient(135deg,rgba(240,143,178,0.88),rgba(111,141,246,0.82))] text-white shadow-[var(--shadow-card)]"
                          : "text-[color:var(--foreground)] hover:bg-white/72"
                      ].join(" ")}
                    >
                      {formatAmountChip(amount)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        {items.map((item) => {
          const selectedHint =
            item.impactHints?.find((entry) => entry.amount === selectedAmount)?.hint ??
            item.impactHints?.[0]?.hint;

          return (
            <div key={item.id} className="rounded-[24px] border border-white/55 bg-white/38 p-5 backdrop-blur-md">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-[color:var(--foreground)]">{item.label}</p>
                  <p className="mt-2 text-sm leading-7 text-[color:var(--muted-foreground)]">{item.summary}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={item.score >= 82 ? "success" : item.score >= 68 ? "neutral" : "warning"}>
                    {item.score}/100
                  </Badge>
                  <span className="text-sm text-[color:var(--muted-foreground)]">{item.status}</span>
                </div>
              </div>
              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-[color:var(--foreground)]">{driversLabel}</p>
                  {selectedHint ? (
                    <div className="rounded-[22px] border border-[rgba(232,121,249,0.24)] bg-[linear-gradient(135deg,rgba(255,255,255,0.76),rgba(245,214,235,0.36),rgba(212,226,255,0.24))] px-4 py-3 text-sm leading-7 text-[color:var(--foreground)] backdrop-blur-md">
                      {selectedHint}
                    </div>
                  ) : null}
                  {item.drivers.map((driver, index) => (
                    <div
                      key={`${item.id}-driver-${index}`}
                      className="rounded-[22px] border border-white/55 bg-white/44 px-4 py-3 text-sm leading-7 text-[color:var(--muted-foreground)] backdrop-blur-md"
                    >
                      {driver}
                    </div>
                  ))}
                </div>
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-[color:var(--foreground)]">{actionsLabel}</p>
                  {item.actions.map((action, index) => (
                    <div
                      key={`${item.id}-action-${index}`}
                      className="rounded-[22px] border border-white/55 bg-white/44 px-4 py-3 text-sm leading-7 text-[color:var(--muted-foreground)] backdrop-blur-md"
                    >
                      {action}
                    </div>
                  ))}
                  {item.href ? (
                    <Button href={item.href} variant="secondary" className="w-full">
                      {openLabel}
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
