import { requireViewer } from "@/lib/auth/session";
import { getImportView } from "@/lib/backend/services";
import { AppShell } from "@/components/layout/app-shell";
import { ImportExperience } from "@/components/import/import-experience";
import { pick } from "@/lib/i18n/ui";

export default async function ImportPage() {
  const viewer = await requireViewer();
  const language = viewer.displayLanguage;
  const { data } = await getImportView(viewer.id);

  return (
    <AppShell
      viewer={viewer}
      title={pick(language, "入库中心", "Import")}
      description={pick(language, "投资标的和消费流水分开导入。账户、持仓、交易各走自己的 workflow，同时保留后续接 broker 或 bank API 的边界。", "Portfolio assets and spending records are imported through separate workflows. Accounts, holdings, and transactions keep their own boundaries so broker or bank APIs can plug in later.")}
    >
      <ImportExperience
        language={language}
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
