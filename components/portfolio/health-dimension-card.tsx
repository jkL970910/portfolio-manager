import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function HealthDimensionCard({
  dimension,
  driversLabel,
  consequencesLabel,
  actionsLabel,
  summaryLabel
}: {
  dimension: {
    id: string;
    label: string;
    score: number;
    status: string;
    summary: string;
    drivers: string[];
    consequences: string[];
    actions: string[];
  };
  driversLabel: string;
  consequencesLabel: string;
  actionsLabel: string;
  summaryLabel: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>{dimension.label}</CardTitle>
          <div className="mt-3 rounded-[22px] border border-white/55 bg-white/34 px-4 py-3 backdrop-blur-md">
            <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">{summaryLabel}</p>
            <p className="mt-2 text-sm leading-7 text-[color:var(--muted-foreground)]">{dimension.summary}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">当前状态</p>
          <Badge variant={dimension.score >= 82 ? "success" : dimension.score >= 68 ? "neutral" : "warning"}>
            {dimension.status}
          </Badge>
          <span
            title="这个分数只是方便系统排序和比较，不是绝对评级。真正更值得看的是上面的状态和下面的解释。"
            className="cursor-help border-b border-dotted border-[color:var(--muted-foreground)] text-xs text-[color:var(--muted-foreground)]"
          >
            {dimension.score}/100
          </span>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div className="space-y-4">
          <p className="text-sm font-semibold text-[color:var(--foreground)]">{driversLabel}</p>
          {dimension.drivers.map((driver, index) => (
            <div key={`${dimension.id}-driver-${index}`} className="rounded-[24px] border border-white/55 bg-white/36 px-4 py-3 text-sm leading-7 text-[color:var(--muted-foreground)] backdrop-blur-md">
              {driver}
            </div>
          ))}

          <p className="text-sm font-semibold text-[color:var(--foreground)]">{consequencesLabel}</p>
          {dimension.consequences.map((consequence, index) => (
            <div key={`${dimension.id}-consequence-${index}`} className="rounded-[24px] border border-[rgba(240,143,178,0.22)] bg-[linear-gradient(135deg,rgba(255,255,255,0.76),rgba(245,214,235,0.28),rgba(255,239,224,0.22))] px-4 py-3 text-sm leading-7 text-[color:var(--muted-foreground)] backdrop-blur-md">
              {consequence}
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
