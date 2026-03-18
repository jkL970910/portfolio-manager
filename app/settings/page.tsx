import { ArrowRight, SlidersHorizontal } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSettingsData } from "@/lib/mock-data";

export default async function SettingsPage() {
  const data = await getSettingsData();

  return (
    <AppShell
      title="Settings"
      description="Investment preferences drive both recommendations and the future health score model. Guided and manual setup stay side by side."
    >
      <Card className="border-[color:var(--primary)]/20">
        <CardContent className="px-6 py-5">
          <p className="text-sm text-[color:var(--muted-foreground)]">
            All recommendations and portfolio health scoring are calculated from the preferences configured here.
          </p>
        </CardContent>
      </Card>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Guided Allocation Setup</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-[24px] border border-[color:var(--border)] bg-[color:var(--card-muted)] p-5">
              <Badge variant="primary">For newer users</Badge>
              <p className="mt-3 text-lg font-semibold">Help me build my allocation</p>
              <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
                A short questionnaire that produces an editable starting allocation with assumptions and rationale.
              </p>
            </div>
            <div className="space-y-3">
              {data.guidedQuestions.map((question) => (
                <div key={question} className="rounded-2xl border border-[color:var(--border)] p-4 text-sm text-[color:var(--muted-foreground)]">
                  {question}
                </div>
              ))}
            </div>
            <Card className="bg-[linear-gradient(135deg,rgba(25,71,229,0.06),rgba(25,71,229,0.02))]">
              <CardContent className="space-y-4 px-5 py-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm text-[color:var(--muted-foreground)]">Suggested starting allocation</p>
                    <p className="mt-1 text-xl font-semibold">70 / 20 / 10</p>
                  </div>
                  <Badge variant="success">Editable draft</Badge>
                </div>
                <p className="text-sm text-[color:var(--muted-foreground)]">
                  Generated from time horizon, volatility comfort, account mix, and tax-efficiency preference.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Button>Use this allocation</Button>
                  <Button variant="secondary">Edit manually</Button>
                </div>
              </CardContent>
            </Card>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Manual Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.manualGroups.map((group) => (
              <div key={group.title} className="rounded-[24px] border border-[color:var(--border)] p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold">{group.title}</p>
                    <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">{group.description}</p>
                  </div>
                  {group.badge ? <Badge variant="neutral">{group.badge}</Badge> : null}
                </div>
              </div>
            ))}
            <div className="rounded-[24px] border border-[color:var(--border)] bg-[color:var(--card-muted)] p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-semibold">Advanced tax settings</p>
                  <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
                    Province and marginal tax bracket are hidden until the user opts into tax-aware placement details.
                  </p>
                </div>
                <SlidersHorizontal className="h-5 w-5 text-[color:var(--secondary)]" />
              </div>
            </div>
            <Button className="w-full" trailingIcon={<ArrowRight className="h-4 w-4" />}>
              Save preference profile
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
