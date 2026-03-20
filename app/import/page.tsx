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
      description="Portfolio and spending imports now run as separate workflows. Portfolio onboarding stays account-and-holding focused, while spending imports remain transaction focused and ready for future bank or card provider integrations. For portfolio holdings, explicit total value takes priority over any value derived from quantity and price."
    >
      <ImportExperience
        latestPortfolioJob={data.latestPortfolioJob}
        latestSpendingJob={data.latestSpendingJob}
        portfolioSteps={data.portfolioSteps}
        portfolioSuccessStates={data.portfolioSuccessStates}
        spendingSuccessStates={data.spendingSuccessStates}
        existingAccounts={data.existingAccounts}
      />
    </AppShell>
  );
}
