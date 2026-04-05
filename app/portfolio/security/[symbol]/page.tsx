import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireViewer } from "@/lib/auth/session";
import { getPortfolioSecurityDetailView, getPreferenceView } from "@/lib/backend/services";
import { AppShell } from "@/components/layout/app-shell";
import { UnifiedSecurityDetail } from "@/components/portfolio/unified-security-detail";
import { Button } from "@/components/ui/button";
import { pick } from "@/lib/i18n/ui";

export default async function PortfolioSecurityDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ symbol: string }>;
  searchParams?: Promise<{ account?: string; holding?: string }>;
}) {
  const viewer = await requireViewer();
  const language = viewer.displayLanguage;
  const { symbol } = await params;
  const filters = (await searchParams) ?? {};
  const [response, preferences] = await Promise.all([
    getPortfolioSecurityDetailView(viewer.id, decodeURIComponent(symbol)),
    getPreferenceView(viewer.id)
  ]);
  const detail = response.data.data;

  if (!detail) {
    notFound();
  }

  return (
    <AppShell
      viewer={viewer}
      title={detail.security.symbol}
      description={pick(
        language,
        "这里统一看这支标的。未持有时按候选标的理解；已持有时会自动补上总持仓和账户级别的持仓信息。",
        "This is the unified page for the symbol. Candidate securities and already-held positions now converge here."
      )}
      compactHeader
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <Button href="/recommendations" variant="secondary" leadingIcon={<ArrowLeft className="h-4 w-4" />}>
            {pick(language, "回推荐页", "Back to recommendations")}
          </Button>
          <Link href="/portfolio" className="inline-flex rounded-full border border-white/60 bg-white/44 px-4 py-2 text-sm font-medium text-[color:var(--foreground)] backdrop-blur-md transition hover:bg-white/56">
            {pick(language, "回组合页", "Back to portfolio")}
          </Link>
        </div>
      </div>

      <UnifiedSecurityDetail
        detail={detail}
        language={language}
        initialAccountId={filters.account ?? null}
        initialHoldingId={filters.holding ?? null}
        initialTracked={preferences.data.profile.watchlistSymbols.includes(detail.security.symbol.trim().toUpperCase())}
      />
    </AppShell>
  );
}
