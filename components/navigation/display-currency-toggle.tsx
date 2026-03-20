"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { CurrencyCode } from "@/lib/backend/models";
import { assertApiData, getApiErrorMessage, safeJson } from "@/lib/client/api";
import { cn } from "@/lib/utils";

export function DisplayCurrencyToggle({ currency }: { currency: CurrencyCode }) {
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
  );
}
