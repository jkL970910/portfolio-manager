import { logout } from "@/lib/auth/actions";
import type { Viewer } from "@/lib/auth/session";
import { FloatingHeaderFrame } from "@/components/layout/floating-header-frame";
import { TopNav } from "@/components/navigation/top-nav";
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
  children
}: {
  title: string;
  description: string;
  viewer: Viewer;
  children: React.ReactNode;
}) {
  const fxRate = viewer.baseCurrency === "CAD" ? 1 : await getFxRate("CAD", viewer.baseCurrency);
  const fxRateLabel =
    viewer.baseCurrency === "CAD" ? "Base analytics and display are in CAD." : `1 CAD = ${fxRate.toFixed(4)} USD`;
  const fxNote =
    viewer.baseCurrency === "CAD"
      ? "CAD is the active display currency. USD-native positions retain their own price inputs, while portfolio analytics stay normalized in CAD."
      : "USD is the active display currency. Portfolio analytics remain normalized in CAD and are converted into USD for display using the latest cached USD/CAD FX rate.";

  return (
    <div className="min-h-screen px-4 pb-12 pt-4 md:px-6">
      <FloatingHeaderFrame>
        <div className="flex flex-col gap-5 bg-[linear-gradient(135deg,rgba(255,255,255,0.44),rgba(245,211,226,0.48),rgba(210,228,255,0.42))] px-6 py-6 text-[color:var(--foreground)] transition-[padding,gap] duration-200 group-data-[scrolled=true]/header:gap-4 group-data-[scrolled=true]/header:px-5 group-data-[scrolled=true]/header:py-4 md:flex-row md:items-center md:justify-between md:px-8 group-data-[scrolled=true]/header:md:px-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-[20px] border border-white/55 bg-[linear-gradient(135deg,rgba(255,255,255,0.88),rgba(255,232,242,0.96))] text-sm font-bold tracking-[0.06em] text-[color:var(--foreground)] shadow-[var(--shadow-card)] transition-[width,height] duration-200 group-data-[scrolled=true]/header:h-10 group-data-[scrolled=true]/header:w-10">
              Loo
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight transition-[font-size] duration-200 group-data-[scrolled=true]/header:text-[1.35rem]">Loo??????</h1>
              <p className="text-sm text-[color:var(--muted-foreground)] transition-[font-size] duration-200 group-data-[scrolled=true]/header:text-[13px]">??????????????????</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4 transition-[gap] duration-200 group-data-[scrolled=true]/header:gap-3 md:gap-6 group-data-[scrolled=true]/header:md:gap-4">
            <div className="text-right">
              <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]/80">Signed in as</p>
              <p className="mt-1 text-base font-semibold">{viewer.displayName}</p>
              <p className="text-sm text-[color:var(--muted-foreground)]">{viewer.email}</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/55 bg-white/78 text-sm font-semibold text-[color:var(--foreground)] shadow-[var(--shadow-card)] transition-[width,height] duration-200 group-data-[scrolled=true]/header:h-10 group-data-[scrolled=true]/header:w-10">
              {getInitials(viewer.displayName)}
            </div>
            <form action={logout}>
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-full border border-white/55 bg-white/44 px-4 py-2 text-sm font-medium text-[color:var(--foreground)] transition-[padding,background-color] hover:bg-white/62 group-data-[scrolled=true]/header:px-3.5 group-data-[scrolled=true]/header:py-1.5"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
        <TopNav currency={viewer.baseCurrency} fxRateLabel={fxRateLabel} fxNote={fxNote} />
      </FloatingHeaderFrame>

      <main className="mx-auto mt-6 max-w-[1440px] space-y-6">
        <section className="px-1">
          <div className="space-y-1">
            <h2 className="text-[32px] font-semibold tracking-tight">{title}</h2>
            <p className="text-[15px] text-[color:var(--muted-foreground)]">{description}</p>
          </div>
        </section>
        {children}
      </main>
    </div>
  );
}
