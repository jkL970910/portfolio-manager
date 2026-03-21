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
      title="入库中心"
      description="投资标的和消费流水分开导入。账户、持仓、交易各走自己的 workflow，同时保留后续接 broker 或 bank API 的边界。"
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
