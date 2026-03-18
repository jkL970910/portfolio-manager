import { cn } from "@/lib/utils";

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <section className={cn("rounded-[24px] border border-[color:var(--border)] bg-white shadow-[var(--shadow-card)]", className)}>
      {children}
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
