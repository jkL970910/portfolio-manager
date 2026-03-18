import { TopNav } from "@/components/navigation/top-nav";

export function AppShell({
  title,
  description,
  children
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen px-4 pb-12 pt-4 md:px-6">
      <header className="mx-auto max-w-[1440px] overflow-hidden rounded-[28px] border border-[color:var(--border)] bg-white shadow-[var(--shadow-soft)]">
        <div className="flex flex-col gap-5 bg-[linear-gradient(135deg,#31568f,#1c3763)] px-6 py-6 text-white md:flex-row md:items-center md:justify-between md:px-8">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/18 text-sm font-semibold uppercase tracking-[0.18em]">
              PM
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Portfolio Manager</h1>
              <p className="text-sm text-white/82">Investment Decision Support</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-6">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-white/70">Total Portfolio Value</p>
              <p className="mt-1 text-xl font-semibold">$296,660 CAD</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-white/70">YTD Return</p>
              <p className="mt-1 text-xl font-semibold">+6.8%</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-sm font-semibold text-[color:var(--secondary)]">
              JD
            </div>
          </div>
        </div>
        <TopNav />
      </header>

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
