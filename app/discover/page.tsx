import { requireViewer } from "@/lib/auth/session";
import { getPreferenceView } from "@/lib/backend/services";
import { AppShell } from "@/components/layout/app-shell";
import { SecurityDiscoveryWorkbench } from "@/components/discover/security-discovery-workbench";
import { pick } from "@/lib/i18n/ui";

export default async function DiscoverPage() {
  const viewer = await requireViewer();
  const language = viewer.displayLanguage;
  const { data } = await getPreferenceView(viewer.id);

  return (
    <AppShell
      viewer={viewer}
      title={pick(language, "发现标的", "Discover")}
      description={pick(
        language,
        "搜索任意标的、加入观察列表，并把你自己的候选想法带进后续的推荐评分流程。",
        "Search any security, add it to the watchlist, and bring your own candidate ideas into later recommendation scoring."
      )}
      compactHeader
    >
      <SecurityDiscoveryWorkbench language={language} initialWatchlistSymbols={data.profile.watchlistSymbols} />
    </AppShell>
  );
}
