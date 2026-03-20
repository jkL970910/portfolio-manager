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

export function TopNav({ currency }: { currency: CurrencyCode }) {
  const pathname = usePathname();

  return (
    <nav className="border-t border-white/12 bg-[#233f6d] px-4 py-3 md:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-full px-4 py-2.5 text-sm font-medium transition-colors duration-200",
                  active
                    ? "bg-white text-[color:var(--secondary)] shadow-[var(--shadow-card)]"
                    : "text-white/88 hover:bg-white/14 hover:text-white"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
        <DisplayCurrencyToggle currency={currency} />
      </div>
    </nav>
  );
}
