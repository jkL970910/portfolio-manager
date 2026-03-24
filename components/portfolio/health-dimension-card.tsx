import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function HealthDimensionCard({
  dimension,
  driversLabel,
  actionsLabel
}: {
  dimension: {
    id: string;
    label: string;
    score: number;
    status: string;
    summary: string;
    drivers: string[];
    actions: string[];
  };
  driversLabel: string;
  actionsLabel: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>{dimension.label}</CardTitle>
          <p className="mt-2 text-sm leading-7 text-[color:var(--muted-foreground)]">{dimension.summary}</p>
        </div>
        <Badge variant={dimension.score >= 82 ? "success" : dimension.score >= 68 ? "neutral" : "warning"}>
          {dimension.score}/100
        </Badge>
      </CardHeader>
      <CardContent className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-3">
          <p className="text-sm font-semibold text-[color:var(--foreground)]">{driversLabel}</p>
          {dimension.drivers.map((driver, index) => (
            <div key={`${dimension.id}-driver-${index}`} className="rounded-[24px] border border-white/55 bg-white/36 px-4 py-3 text-sm leading-7 text-[color:var(--muted-foreground)] backdrop-blur-md">
              {driver}
            </div>
          ))}
        </div>
        <div className="space-y-3">
          <p className="text-sm font-semibold text-[color:var(--foreground)]">{actionsLabel}</p>
          {dimension.actions.map((action, index) => (
            <div key={`${dimension.id}-action-${index}`} className="rounded-[24px] border border-white/55 bg-white/36 px-4 py-3 text-sm leading-7 text-[color:var(--muted-foreground)] backdrop-blur-md">
              {action}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
