import { requireViewer } from "@/lib/auth/session";
import { getPreferenceView } from "@/lib/backend/services";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PreferencesWorkbench } from "@/components/settings/preferences-workbench";

export default async function SettingsPage() {
  const viewer = await requireViewer();
  const { data } = await getPreferenceView(viewer.id);

  return (
    <AppShell viewer={viewer} title="藏宝规则" description="投资偏好是推荐和未来健康评分的底层输入。引导式配置和手动配置在这里汇合。">
      <Card className="overflow-hidden bg-[linear-gradient(135deg,rgba(255,255,255,0.68),rgba(246,218,230,0.52),rgba(221,232,255,0.46))]">
        <CardContent className="grid gap-6 px-6 py-6 md:grid-cols-[1.2fr_0.8fr] md:items-center">
          <div className="space-y-4">
            <Badge variant="primary">Loo 的偏好建模台</Badge>
            <div className="space-y-3">
              <h2 className="text-[30px] font-semibold tracking-[-0.04em] text-[color:var(--foreground)]">
                先讲清你的规则，系统才有资格给出推荐。
              </h2>
              <p className="max-w-3xl text-sm leading-7 text-[color:var(--muted-foreground)]">
                这里的设置会直接驱动推荐逻辑和未来的组合健康评分。对 {viewer.displayName} 来说，这里不是装饰页，而是整套藏宝规则的源头。
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <SettingsSignal title="Guided path" detail="适合先生成一个可编辑的起始配置" />
            <SettingsSignal title="Manual path" detail="适合直接控制目标配置与账户优先级" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-white/55 bg-white/38">
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

function SettingsSignal({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-[24px] border border-white/55 bg-white/44 p-4 backdrop-blur-md">
      <p className="text-sm font-medium text-[color:var(--muted-foreground)]">{title}</p>
      <p className="mt-3 text-base font-semibold text-[color:var(--foreground)]">{detail}</p>
    </div>
  );
}
