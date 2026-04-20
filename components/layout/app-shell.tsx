import { logout } from "@/lib/auth/actions";
import type { Viewer } from "@/lib/auth/session";
import { FloatingHeaderFrame } from "@/components/layout/floating-header-frame";
import { TopNav } from "@/components/navigation/top-nav";
import { ScrollToTopButton } from "@/components/layout/scroll-to-top-button";
import { pick } from "@/lib/i18n/ui";
import { getFxRate } from "@/lib/market-data/fx";

function getInitials(displayName: string) {
  return displayName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export async function AppShell({
  title,
  description,
  viewer,
  children,
  compactHeader = false
}: {
  title: string;
  description: string;
  viewer: Viewer;
  children: React.ReactNode;
  compactHeader?: boolean;
}) {
  const language = viewer.displayLanguage;
  const fxRate = viewer.baseCurrency === "CAD" ? 1 : await getFxRate("CAD", viewer.baseCurrency);
  const fxRateLabel =
    viewer.baseCurrency === "CAD"
      ? pick(language, "当前显示和分析基准都是 CAD。", "Base analytics and display are in CAD.")
      : `1 CAD = ${fxRate.toFixed(4)} USD`;
  const fxNote =
    viewer.baseCurrency === "CAD"
      ? pick(
          language,
          "CAD 是当前显示币种。USD 原生持仓会保留自己的价格输入，但组合分析仍统一归一化到 CAD。",
          "CAD is the active display currency. USD-native positions retain their own price inputs, while portfolio analytics stay normalized in CAD."
        )
      : pick(
          language,
          "USD 是当前显示币种。底层分析仍统一归一化到 CAD，再按最新缓存的 USD/CAD 汇率换算为 USD 展示。",
          "USD is the active display currency. Portfolio analytics remain normalized in CAD and are converted into USD for display using the latest cached USD/CAD FX rate."
        );

  return (
    <div className="min-h-screen px-4 pb-12 pt-4 md:px-6">
      <FloatingHeaderFrame>
        <div className="relative overflow-visible rounded-[28px]">
          <div className="overflow-hidden rounded-t-[28px]">
            <div className="relative flex flex-col gap-5 bg-[linear-gradient(135deg,rgba(255,255,255,0.5),rgba(245,211,226,0.42),rgba(210,228,255,0.38))] px-6 py-6 text-[color:var(--foreground)] transition-[padding,gap] duration-200 before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-[linear-gradient(90deg,transparent,var(--edge-highlight),transparent)] after:pointer-events-none after:absolute after:inset-0 after:bg-[radial-gradient(circle_at_18%_16%,rgba(240,143,178,0.14),transparent_24%),radial-gradient(circle_at_82%_18%,rgba(139,168,255,0.14),transparent_24%),radial-gradient(circle_at_50%_-8%,rgba(255,255,255,0.34),transparent_26%)] group-data-[scrolled=true]/header:gap-4 group-data-[scrolled=true]/header:px-5 group-data-[scrolled=true]/header:py-4 md:flex-row md:items-center md:justify-between md:px-8 group-data-[scrolled=true]/header:md:px-6">
              <div className="relative z-10 flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-[20px] border border-white/62 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(255,232,242,0.94))] text-sm font-bold tracking-[0.06em] text-[color:var(--foreground)] shadow-[0_12px_28px_rgba(110,103,130,0.08)] transition-[width,height] duration-200 group-data-[scrolled=true]/header:h-10 group-data-[scrolled=true]/header:w-10">
                  {pick(language, "Loo", "PM")}
                </div>
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight transition-[font-size] duration-200 group-data-[scrolled=true]/header:text-[1.35rem]">
                    {pick(language, "Loo国的财富宝库", "Portfolio Manager")}
                  </h1>
                  <p className="text-sm text-[color:var(--muted-foreground)] transition-[font-size] duration-200 group-data-[scrolled=true]/header:text-[13px]">
                    {pick(language, "陪你整理资产、看懂结构、规划下一笔钱", "A softer space to organize assets, understand structure, and plan the next contribution.")}
                  </p>
                </div>
              </div>
              <div className="relative z-10 flex flex-wrap items-center gap-4 transition-[gap] duration-200 group-data-[scrolled=true]/header:gap-3 md:gap-6 group-data-[scrolled=true]/header:md:gap-4">
                <div className="text-right">
                  <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]/80">
                    {pick(language, "当前登录", "Signed in as")}
                  </p>
                  <p className="mt-1 text-base font-semibold">{viewer.displayName}</p>
                  <p className="text-sm text-[color:var(--muted-foreground)]">{viewer.email}</p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/62 bg-white/74 text-sm font-semibold text-[color:var(--foreground)] shadow-[0_12px_28px_rgba(110,103,130,0.08)] transition-[width,height] duration-200 group-data-[scrolled=true]/header:h-10 group-data-[scrolled=true]/header:w-10">
                  {getInitials(viewer.displayName)}
                </div>
                <form action={logout}>
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center rounded-full border border-white/60 bg-white/46 px-4 py-2 text-sm font-medium text-[color:var(--foreground)] shadow-[0_10px_24px_rgba(110,103,130,0.06)] transition-[padding,background-color,box-shadow] hover:bg-white/62 hover:shadow-[0_14px_28px_rgba(110,103,130,0.08)] group-data-[scrolled=true]/header:px-3.5 group-data-[scrolled=true]/header:py-1.5"
                  >
                    {pick(language, "退出登录", "Sign out")}
                  </button>
                </form>
              </div>
            </div>
          </div>
          <TopNav language={language} currency={viewer.baseCurrency} fxRateLabel={fxRateLabel} fxNote={fxNote} />
        </div>
      </FloatingHeaderFrame>

      <main className={compactHeader ? "mx-auto mt-4 max-w-[1440px] space-y-4" : "mx-auto mt-6 max-w-[1440px] space-y-6"}>
        <section className="px-1">
          <div className={compactHeader ? "space-y-0.5" : "space-y-1"}>
            <h2 className={compactHeader ? "text-[20px] font-semibold tracking-tight sm:text-[22px]" : "text-[28px] font-semibold tracking-tight sm:text-[30px]"}>{title}</h2>
            <p className={compactHeader ? "max-w-[760px] text-[13px] leading-5 text-[color:var(--muted-foreground)]" : "max-w-[920px] text-sm leading-7 text-[color:var(--muted-foreground)]"}>{description}</p>
          </div>
        </section>
        {children}
      </main>
      <ScrollToTopButton />
    </div>
  );
}
