"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Info } from "lucide-react";
import type { CurrencyCode } from "@/lib/backend/models";
import { FxInfoPopoverContent } from "@/components/navigation/fx-info-popover-content";
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
    <div className="relative z-40 inline-flex items-center gap-2">
      <div className="inline-flex items-center rounded-full border border-white/60 bg-white/44 p-1.5 shadow-[0_12px_28px_rgba(110,103,130,0.07)] backdrop-blur-xl">
        {(["CAD", "USD"] as const).map((option) => {
          const active = option === activeCurrency;
          return (
            <button
              key={option}
              type="button"
              onClick={() => void updateCurrency(option)}
              className={cn(
                "rounded-full px-3.5 py-2 text-xs font-semibold tracking-[0.12em] transition-[background-color,color,transform,box-shadow] duration-200",
                active
                  ? "bg-[linear-gradient(135deg,rgba(255,255,255,0.94),rgba(255,244,248,0.9))] text-[color:var(--foreground)] shadow-[0_10px_24px_rgba(110,103,130,0.08)]"
                  : "text-[color:var(--foreground)]/82 hover:-translate-y-0.5 hover:bg-white/36 hover:text-[color:var(--foreground)]"
              )}
            >
              {option}
            </button>
          );
        })}
      </div>
      <div className="group/info relative">
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/60 bg-white/44 text-[color:var(--foreground)]/78 shadow-[0_12px_28px_rgba(110,103,130,0.07)] backdrop-blur-xl transition-colors hover:text-[color:var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]"
          aria-label="FX info"
        >
          <Info className="h-4 w-4" />
        </button>
        <div className="pointer-events-none absolute right-0 top-[calc(100%+12px)] z-50 w-[340px] rounded-[24px] border border-[color:var(--border)] bg-white/80 p-4 text-left text-[13px] text-[color:var(--foreground)] opacity-0 shadow-[0_18px_40px_rgba(110,103,130,0.09)] backdrop-blur-2xl transition-opacity duration-150 group-hover/info:opacity-100 group-focus-within/info:opacity-100">
          <FxInfoPopoverContent currency={activeCurrency} fxRateLabel={fxRateLabel} fxNote={fxNote} />
        </div>
      </div>
    </div>
  );
}
