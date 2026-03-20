"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Info } from "lucide-react";
import type { CurrencyCode } from "@/lib/backend/models";
import { assertApiData, getApiErrorMessage, safeJson } from "@/lib/client/api";
import { cn } from "@/lib/utils";

export function DisplayCurrencyToggle({
  currency,
  fxRateLabel,
  fxNote
}: {
  currency: CurrencyCode;
  fxRateLabel: string;
  fxNote: string;
}) {
  const router = useRouter();
  const [activeCurrency, setActiveCurrency] = useState<CurrencyCode>(currency);
  const [, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function updateCurrency(nextCurrency: CurrencyCode) {
    if (nextCurrency === activeCurrency || isPending) {
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch("/api/settings/display-currency", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ currency: nextCurrency })
        });
        const payload = await safeJson(response);
        if (!response.ok) {
          throw new Error(getApiErrorMessage(payload, "Failed to update display currency."));
        }
        const data = assertApiData<{ baseCurrency?: CurrencyCode }>(
          payload,
          (candidate) => typeof candidate === "object" && candidate !== null,
          "Display currency update succeeded but returned no usable payload."
        );
        setError(null);
        setActiveCurrency((data.baseCurrency as CurrencyCode) ?? nextCurrency);
        router.refresh();
      } catch (error) {
        setError(error instanceof Error ? error.message : "Failed to update display currency.");
      }
    });
  }

  return (
    <div className="group relative inline-flex items-center gap-2">
      <div className="inline-flex items-center rounded-full border border-white/20 bg-white/10 p-1">
        {(["CAD", "USD"] as const).map((option) => {
          const active = option === activeCurrency;
          return (
            <button
              key={option}
              type="button"
              onClick={() => void updateCurrency(option)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-semibold tracking-[0.12em] transition-colors",
                active ? "bg-white text-[color:var(--secondary)]" : "text-white/82 hover:bg-white/10 hover:text-white"
              )}
            >
              {option}
            </button>
          );
        })}
      </div>
      <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/18 bg-white/8 text-white/82 transition-colors group-hover:bg-white/14 group-hover:text-white group-focus-within:bg-white/14 group-focus-within:text-white">
        <Info className="h-4 w-4" />
      </div>
      <div className="pointer-events-none absolute right-0 top-[calc(100%+10px)] z-20 w-[320px] rounded-2xl border border-[color:var(--border)] bg-white p-4 text-left text-[13px] text-[color:var(--foreground)] opacity-0 shadow-[var(--shadow-card)] transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
        <p className="font-semibold">Display currency: {activeCurrency}</p>
        <p className="mt-1 text-[color:var(--muted-foreground)]">{fxNote}</p>
        <p className="mt-3 text-xs font-medium uppercase tracking-[0.14em] text-[color:var(--muted-foreground)]">{fxRateLabel}</p>
      </div>
    </div>
  );
}
