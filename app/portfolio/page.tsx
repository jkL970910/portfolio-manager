import { requireViewer } from "@/lib/auth/session";
import { getPortfolioView } from "@/lib/backend/services";
import { AppShell } from "@/components/layout/app-shell";
import { PortfolioWorkspace } from "@/components/portfolio/portfolio-workspace";
import { pick } from "@/lib/i18n/ui";

export default async function PortfolioPage({
  searchParams
}: {
  searchParams?: Promise<{ account?: string; accountType?: string; holding?: string }>;
}) {
  const viewer = await requireViewer();
  const language = viewer.displayLanguage;
  const { data } = await getPortfolioView(viewer.id);
  const filters = (await searchParams) ?? {};

  return (
    <AppShell
      viewer={viewer}
      title={pick(language, "宝库结构", "Portfolio")}
      description={pick(
        language,
        "先按账户把钱分开看，再往下看具体持仓。先看账户结构对不对，再决定要不要继续钻到单笔仓位。",
        "Start by looking at the money account by account, then drill into individual holdings. Make sure the account structure still makes sense before zooming into individual holdings."
      )}
      compactHeader
    >
      <PortfolioWorkspace data={data} language={language} initialFilters={filters} />
    </AppShell>
  );
}
