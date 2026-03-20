import { requireViewer } from "@/lib/auth/session";
import { getPreferenceView } from "@/lib/backend/services";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { PreferencesWorkbench } from "@/components/settings/preferences-workbench";

export default async function SettingsPage() {
  const viewer = await requireViewer();
  const { data } = await getPreferenceView(viewer.id);

  return (
    <AppShell
      viewer={viewer}
      title="Settings"
      description="Investment preferences drive both recommendations and the future health score model. Guided and manual setup stay side by side."
    >
      <Card className="border-[color:var(--primary)]/20">
        <CardContent className="px-6 py-5">
          <p className="text-sm text-[color:var(--muted-foreground)]">
            All recommendations and portfolio health scoring are calculated from the preferences configured here for {viewer.displayName}.
          </p>
        </CardContent>
      </Card>
      <PreferencesWorkbench
        initialProfile={data.profile}
        initialGuidedDraft={data.guidedDraft}
        guidedQuestions={data.guidedQuestions}
        manualGroups={data.manualGroups}
      />
    </AppShell>
  );
}
