"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Info } from "lucide-react";
import type { CurrencyCode } from "@/lib/backend/models";
import { FxInfoPopoverContent } from "@/components/navigation/fx-info-popover-content";
import { LiquidGlassShell } from "@/components/ui/liquid-glass-shell";
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
      <LiquidGlassShell
        className="rounded-full"
        fallbackClassName="rounded-full border border-white/55 bg-white/30"
        cornerRadius={999}
        displacementScale={44}
        blurAmount={0.075}
        saturation={148}
        aberrationIntensity={1.2}
      >
        <div className="inline-flex items-center rounded-full p-1.5">
          {(["CAD", "USD"] as const).map((option) => {
            const active = option === activeCurrency;
            return (
              <button
                key={option}
                type="button"
                onClick={() => void updateCurrency(option)}
                className={cn(
                  "rounded-full px-3.5 py-2 text-xs font-semibold tracking-[0.12em] transition-[background-color,color,transform] duration-200",
                  active
                    ? "bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(255,240,248,0.94))] text-[color:var(--foreground)] shadow-[0_8px_18px_rgba(110,103,130,0.14)]"
                    : "text-[color:var(--foreground)]/82 hover:-translate-y-0.5 hover:bg-white/30 hover:text-[color:var(--foreground)]"
                )}
              >
                {option}
              </button>
            );
          })}
        </div>
      </LiquidGlassShell>
      <LiquidGlassShell
        className="rounded-full"
        fallbackClassName="rounded-full border border-white/55 bg-white/30"
        cornerRadius={999}
        displacementScale={36}
        blurAmount={0.07}
        saturation={145}
        aberrationIntensity={1.2}
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-full text-[color:var(--foreground)]/78 transition-colors group-hover:text-[color:var(--foreground)] group-focus-within:text-[color:var(--foreground)]">
          <Info className="h-4 w-4" />
        </div>
      </LiquidGlassShell>
      <div className="pointer-events-none absolute right-0 top-[calc(100%+12px)] z-20 w-[340px] rounded-[24px] border border-[color:var(--border)] bg-white/68 p-4 text-left text-[13px] text-[color:var(--foreground)] opacity-0 shadow-[var(--shadow-card)] backdrop-blur-2xl transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
        <FxInfoPopoverContent currency={activeCurrency} fxRateLabel={fxRateLabel} fxNote={fxNote} />
      </div>
    </div>
  );
}
