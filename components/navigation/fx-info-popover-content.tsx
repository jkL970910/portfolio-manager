import type { CurrencyCode } from "@/lib/backend/models";

export function FxInfoPopoverContent({
  currency,
  fxRateLabel,
  fxNote
}: {
  currency: CurrencyCode;
  fxRateLabel: string;
  fxNote: string;
}) {
  return (
    <>
      <p className="font-semibold">Display currency: {currency}</p>
      <p className="mt-1 text-[color:var(--muted-foreground)]">{fxNote}</p>
      <p className="mt-3 text-xs font-medium uppercase tracking-[0.14em] text-[color:var(--muted-foreground)]">{fxRateLabel}</p>
    </>
  );
}
