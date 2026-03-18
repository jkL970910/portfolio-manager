import { CheckCircle2, Upload, Wand2 } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getImportData } from "@/lib/mock-data";

export default async function ImportPage() {
  const data = await getImportData();

  return (
    <AppShell
      title="Import"
      description="Guided portfolio setup with staged import, mapping, and review. The flow is intentionally lightweight at the first step."
    >
      <div className="grid gap-4 xl:grid-cols-5">
        {data.steps.map((step, index) => (
          <Card key={step.title} className={index == 0 ? "border-[color:var(--primary)]/20" : ""}>
            <CardContent className="space-y-3 px-5 py-5">
              <Badge variant={index == 0 ? "primary" : "neutral"}>Step {index + 1}</Badge>
              <p className="font-semibold">{step.title}</p>
              <p className="text-sm text-[color:var(--muted-foreground)]">{step.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Import Setup</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {data.setupCards.map((card) => (
                <div key={card.title} className="rounded-[24px] border border-dashed border-[color:var(--border)] bg-[color:var(--card-muted)] p-5">
                  <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">{card.label}</p>
                  <p className="mt-2 text-lg font-semibold">{card.title}</p>
                  <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">{card.description}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-3">
              <Button leadingIcon={<Upload className="h-4 w-4" />}>Upload CSV</Button>
              <Button variant="secondary" leadingIcon={<Wand2 className="h-4 w-4" />}>
                Review field mapping
              </Button>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Success states to support</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.successStates.map((item) => (
              <div key={item} className="flex gap-3 rounded-2xl border border-[color:var(--border)] p-4 text-sm text-[color:var(--muted-foreground)]">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-[color:var(--success)]" />
                {item}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
