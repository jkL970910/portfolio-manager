import { requireViewer } from "@/lib/auth/session";
import { getImportView } from "@/lib/backend/services";
import { AppShell } from "@/components/layout/app-shell";
import { ImportExperience } from "@/components/import/import-experience";

export default async function ImportPage() {
  const viewer = await requireViewer();
  const { data } = await getImportView(viewer.id);

  return (
    <AppShell
      viewer={viewer}
      title="Import"
      description="Choose between a guided account-by-account onboarding flow and a direct CSV import path for bulk broker exports."
    >
      <ImportExperience latestJob={data.latestJob} steps={data.steps} successStates={data.successStates} />
    </AppShell>
  );
}
