import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type MetricCardProps = {
  label: string;
  value: string;
  detail: string;
  icon?: React.ReactNode;
  badge?: {
    label: string;
    variant?: "primary" | "success" | "warning" | "neutral";
  };
  className?: string;
  valueClassName?: string;
};

export function MetricCard({
  label,
  value,
  detail,
  icon,
  badge,
  className,
  valueClassName
}: MetricCardProps) {
  return (
    <Card
      className={cn(
        "relative overflow-hidden bg-[linear-gradient(180deg,rgba(255,255,255,0.66),rgba(255,255,255,0.44))]",
        className
      )}
    >
      <div className="pointer-events-none absolute inset-x-6 top-0 h-20 rounded-b-[28px] bg-[linear-gradient(180deg,rgba(240,143,178,0.12),transparent)]" />
      <CardHeader className="relative space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
              {label}
            </p>
            {badge ? <Badge variant={badge.variant ?? "neutral"}>{badge.label}</Badge> : null}
          </div>
          {icon ? (
            <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/55 bg-white/56 text-[color:var(--primary)] shadow-[var(--shadow-card)]">
              {icon}
            </div>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="relative space-y-2 pt-0">
        <CardTitle className={cn("text-[34px] font-semibold tracking-[-0.03em]", valueClassName)}>{value}</CardTitle>
        <p className="text-[13px] leading-6 text-[color:var(--muted-foreground)]">{detail}</p>
      </CardContent>
    </Card>
  );
}
