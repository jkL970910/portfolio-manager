import type { CurrencyCode } from "@/lib/backend/models";

export function roundAmount(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function formatMoney(value: number, currency: CurrencyCode) {
  return new Intl.NumberFormat(currency === "CAD" ? "en-CA" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: value % 1 === 0 ? 0 : 2
  }).format(value);
}

export function getCurrencySymbol(currency: CurrencyCode) {
  return currency === "CAD" ? "C$" : "US$";
}
