import { ArrowRight, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type RecommendationSummaryCardProps = {
  title: string;
  subtitle: string;
  theme: string;
  reason: string;
  signals: string[];
  emphasized?: boolean;
};

export function RecommendationSummaryCard({
  title,
  subtitle,
  theme,
  reason,
  signals,
  emphasized = false
}: RecommendationSummaryCardProps) {
  return (
    <Card className={emphasized ? "border-white/60 bg-[linear-gradient(135deg,rgba(240,143,178,0.12),rgba(111,141,246,0.08),rgba(255,255,255,0.28))]" : undefined}>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>{title}</CardTitle>
            <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">{subtitle}</p>
          </div>
          <Badge variant={emphasized ? "warning" : "neutral"}>{emphasized ? "High Priority" : "Next Step"}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-[24px] border border-white/55 bg-white/36 p-5 backdrop-blur-md">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xl font-semibold text-[color:var(--foreground)]">{theme}</p>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-[color:var(--muted-foreground)]">{reason}</p>
            </div>
            <ShieldCheck className="h-5 w-5 text-[color:var(--success)]" />
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {signals.map((signal) => (
              <div key={signal} className="rounded-[24px] border border-white/55 bg-white/44 p-4 backdrop-blur-md">
                <p className="text-sm text-[color:var(--muted-foreground)]">Supporting signal</p>
                <p className="mt-2 text-sm font-medium text-[color:var(--foreground)]">{signal}</p>
              </div>
            ))}
          </div>
        </div>
        <Button href="/recommendations" className="w-full md:w-auto" trailingIcon={<ArrowRight className="h-4 w-4" />}>
          View Detailed Recommendations
        </Button>
      </CardContent>
    </Card>
  );
}
