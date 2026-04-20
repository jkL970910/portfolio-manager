import { requireViewer } from "@/lib/auth/session";
import { getImportView } from "@/lib/backend/services";
import { AppShell } from "@/components/layout/app-shell";
import { ImportExperience } from "@/components/import/import-experience";
import { pick } from "@/lib/i18n/ui";

export default async function ImportPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const viewer = await requireViewer();
  const language = viewer.displayLanguage;
  const { data } = await getImportView(viewer.id);
  const params = searchParams ? await searchParams : {};
  const accountId = typeof params.accountId === "string" ? params.accountId : null;
  const mode = typeof params.mode === "string" ? params.mode : null;
  const workflow = typeof params.workflow === "string" ? params.workflow : null;
  const accountMode = typeof params.accountMode === "string" ? params.accountMode : null;
  const method = typeof params.method === "string" ? params.method : null;

  return (
    <AppShell
      viewer={viewer}
      title={pick(language, "入库中心", "Import")}
      description={pick(
        language,
        "把投资账户和消费流水分开导入。账户、持仓和交易各走自己的流程，后面接 broker 或 bank API 时也不会混在一起。",
        "Portfolio assets and spending records are imported through separate workflows. Accounts, holdings, and transactions keep their own boundaries so broker or bank APIs can plug in later."
      )}
      compactHeader
    >
      <ImportExperience
        language={language}
        latestPortfolioJob={data.latestPortfolioJob}
        latestSpendingJob={data.latestSpendingJob}
        portfolioSteps={data.portfolioSteps}
        portfolioSuccessStates={data.portfolioSuccessStates}
        spendingSuccessStates={data.spendingSuccessStates}
        existingAccounts={data.existingAccounts}
        initialContext={{
          workflowView: workflow === "portfolio" || workflow === "spending" ? workflow : undefined,
          mode: mode === "guided" || mode === "direct" ? mode : undefined,
          accountMode: accountMode === "existing" || accountMode === "new" ? accountMode : undefined,
          accountId,
          method: method === "single-account-csv" || method === "manual-entry" || method === "continue-later" ? method : undefined
        }}
      />
    </AppShell>
  );
}
