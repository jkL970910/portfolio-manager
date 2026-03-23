"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { CurrencyCode, DisplayLanguage } from "@/lib/backend/models";
import { DisplayCurrencyToggle } from "@/components/navigation/display-currency-toggle";
import { DisplayLanguageToggle } from "@/components/navigation/display-language-toggle";
import { cn } from "@/lib/utils";

export function TopNav({
  language,
  currency,
  fxRateLabel,
  fxNote
}: {
  language: DisplayLanguage;
  currency: CurrencyCode;
  fxRateLabel: string;
  fxNote: string;
}) {
  const pathname = usePathname();
  const navItems = [
    { href: "/dashboard", label: language === "zh" ? "总览" : "Dashboard" },
    { href: "/portfolio", label: language === "zh" ? "组合" : "Portfolio" },
    { href: "/recommendations", label: language === "zh" ? "推荐" : "Recommendations" },
    { href: "/spending", label: language === "zh" ? "消费" : "Spending" },
    { href: "/import", label: language === "zh" ? "导入" : "Import" },
    { href: "/settings", label: language === "zh" ? "设置" : "Settings" }
  ] as const satisfies ReadonlyArray<{ href: Route; label: string }>;

  return (
    <nav className="relative overflow-hidden rounded-b-[28px] border-t border-white/40 bg-[linear-gradient(180deg,rgba(255,255,255,0.3),rgba(255,255,255,0.16))] px-4 py-3 backdrop-blur-xl before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_18%_18%,rgba(240,143,178,0.12),transparent_24%),radial-gradient(circle_at_82%_26%,rgba(139,168,255,0.14),transparent_22%)] after:pointer-events-none after:absolute after:inset-x-0 after:top-0 after:h-px after:bg-[linear-gradient(90deg,transparent,var(--edge-highlight),transparent)] md:px-8">
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-full border px-4 py-2.5 text-sm font-medium transition-[background-color,color,border-color,transform,box-shadow] duration-200",
                  active
                    ? "border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.9),rgba(255,244,248,0.8))] text-[color:var(--foreground)] shadow-[0_14px_30px_rgba(110,103,130,0.07)]"
                    : "border-transparent text-[color:var(--foreground)]/78 hover:-translate-y-0.5 hover:border-white/34 hover:bg-white/34 hover:text-[color:var(--foreground)]"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
        <div className="flex items-center gap-3">
          <DisplayLanguageToggle language={language} />
          <DisplayCurrencyToggle currency={currency} fxRateLabel={fxRateLabel} fxNote={fxNote} />
        </div>
      </div>
    </nav>
  );
}
