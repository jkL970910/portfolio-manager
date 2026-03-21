"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { CurrencyCode } from "@/lib/backend/models";
import { DisplayCurrencyToggle } from "@/components/navigation/display-currency-toggle";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/recommendations", label: "Recommendations" },
  { href: "/spending", label: "Spending" },
  { href: "/import", label: "Import" },
  { href: "/settings", label: "Settings" }
] as const satisfies ReadonlyArray<{ href: Route; label: string }>;

export function TopNav({
  currency,
  fxRateLabel,
  fxNote
}: {
  currency: CurrencyCode;
  fxRateLabel: string;
  fxNote: string;
}) {
  const pathname = usePathname();

  return (
    <nav className="border-t border-white/35 bg-[linear-gradient(180deg,rgba(255,255,255,0.24),rgba(255,255,255,0.14))] px-4 py-3 backdrop-blur-xl md:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-full border px-4 py-2.5 text-sm font-medium transition-[background-color,color,border-color,transform] duration-200",
                  active
                    ? "border-white/60 bg-white/78 text-[color:var(--foreground)] shadow-[var(--shadow-card)]"
                    : "border-transparent text-[color:var(--foreground)]/78 hover:-translate-y-0.5 hover:border-white/30 hover:bg-white/28 hover:text-[color:var(--foreground)]"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
        <DisplayCurrencyToggle currency={currency} fxRateLabel={fxRateLabel} fxNote={fxNote} />
      </div>
    </nav>
  );
}
