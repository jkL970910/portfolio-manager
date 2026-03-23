import { cn } from "@/lib/utils";

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <section
      className={cn(
        "relative isolate overflow-hidden rounded-[28px] border border-[color:var(--border)] bg-[color:var(--card)] shadow-[var(--shadow-card)] backdrop-blur-xl before:pointer-events-none before:absolute before:inset-px before:rounded-[26px] before:bg-[linear-gradient(180deg,rgba(255,255,255,0.42),rgba(255,255,255,0.14)_40%,rgba(255,255,255,0.02)_100%)] before:opacity-90",
        className
      )}
    >
      <div className="relative z-10">{children}</div>
    </section>
  );
}

export function CardHeader({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("px-6 pt-6", className)}>{children}</div>;
}

export function CardTitle({ className, children }: { className?: string; children: React.ReactNode }) {
  return <h2 className={cn("text-lg font-semibold tracking-tight", className)}>{children}</h2>;
}

export function CardContent({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("px-6 pb-6 pt-4", className)}>{children}</div>;
}
