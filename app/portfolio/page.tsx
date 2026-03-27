import { requireViewer } from "@/lib/auth/session";
import { getPortfolioView } from "@/lib/backend/services";
import { AppShell } from "@/components/layout/app-shell";
import { PortfolioWorkspace } from "@/components/portfolio/portfolio-workspace";
import { Card, CardContent } from "@/components/ui/card";
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
      description={pick(language, "这里先按账户把钱拆开，再往下看具体持仓。先看账户结构对不对，再决定要不要继续钻到单笔仓位。", "Start by looking at the money account by account, then drill into individual holdings. Make sure the account structure still makes sense before zooming into single positions.")}
    >
      <Card className="overflow-hidden bg-[linear-gradient(135deg,rgba(255,255,255,0.68),rgba(246,218,230,0.5),rgba(221,232,255,0.44))]">
        <CardContent className="grid gap-6 px-6 py-6 md:grid-cols-[1.2fr_0.8fr] md:items-center">
          <div className="space-y-4">
            <div className="inline-flex rounded-full border border-white/60 bg-white/44 px-4 py-2 text-sm font-medium text-[color:var(--foreground)] backdrop-blur-md">{pick(language, "Loo 帮你先按账户拆开看", "Start with the account structure")}</div>
            <div className="space-y-3">
              <h2 className="text-[30px] font-semibold tracking-[-0.04em] text-[color:var(--foreground)]">
                {pick(language, "先看你到底有哪些账户、钱主要压在哪几个里，再往下看具体仓位。", "Start by checking which accounts exist and where most of the money actually sits before drilling into holdings.")}
              </h2>
              <p className="max-w-3xl text-sm leading-7 text-[color:var(--muted-foreground)]">
                {pick(language, "如果有多个 TFSA、FHSA 或不同机构的同类账户，这一页会先帮你拆清楚，避免只看持仓表时把它们混在一起。", "If you have multiple TFSAs, FHSAs, or similar accounts across institutions, this page separates them first so the holdings table does not blur them together.")}
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <PortfolioSignal title={pick(language, "先看什么", "What to look at first")} detail={pick(language, "先看整体怎么走，再点一个账户把整页切过去。", "Start with the overall trend, then click one account to switch the whole page context.")} />
            <PortfolioSignal title={pick(language, "看完以后做什么", "What to do next")} detail={pick(language, "先确认账户结构，再决定要不要继续看持仓、健康详情或推荐页。", "Confirm the account structure first, then decide whether to inspect holdings, health detail, or the recommendation page.")} />
          </div>
        </CardContent>
      </Card>

      <PortfolioWorkspace data={data} language={language} initialFilters={filters} />
    </AppShell>
  );
}

function PortfolioSignal({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-[24px] border border-white/55 bg-white/44 p-4 backdrop-blur-md">
      <p className="text-sm font-medium text-[color:var(--muted-foreground)]">{title}</p>
      <p className="mt-3 text-base font-semibold text-[color:var(--foreground)]">{detail}</p>
    </div>
  );
}
