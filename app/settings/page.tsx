import { requireViewer } from "@/lib/auth/session";
import { getCitizenProfileView, getPreferenceView } from "@/lib/backend/services";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PreferencesWorkbench } from "@/components/settings/preferences-workbench";
import { CitizenProfilePanel } from "@/components/settings/citizen-profile-panel";
import { pick } from "@/lib/i18n/ui";

export default async function SettingsPage() {
  const viewer = await requireViewer();
  const language = viewer.displayLanguage;
  const { data } = await getPreferenceView(viewer.id);
  const citizenResponse = language === "zh" ? await getCitizenProfileView(viewer.id) : null;

  return (
    <AppShell
      viewer={viewer}
      title={pick(language, "藏宝规则", "Settings")}
      description={pick(language, "投资偏好是推荐和未来健康评分的底层输入。引导式配置和手动配置在这里汇合。", "Investment preferences are the underlying input for recommendations and future health scoring. Guided and manual setup converge here.")}
    >
      <Card className="overflow-hidden bg-[linear-gradient(135deg,rgba(255,255,255,0.72),rgba(248,223,233,0.54),rgba(224,235,255,0.48))] before:bg-[linear-gradient(180deg,rgba(255,255,255,0.48),rgba(255,255,255,0.12)_38%,rgba(255,255,255,0.02)_100%)]">
        <CardContent className="grid gap-6 px-6 py-6 md:grid-cols-[1.2fr_0.8fr] md:items-center">
          <div className="relative space-y-4">
            <div className="pointer-events-none absolute -left-14 top-[-60px] h-44 w-44 rounded-full bg-[radial-gradient(circle,rgba(240,143,178,0.2),rgba(240,143,178,0))] blur-3xl" />
            <div className="pointer-events-none absolute left-1/2 top-[-76px] h-40 w-40 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.3),rgba(255,255,255,0))] blur-3xl" />
            <Badge variant="primary">{pick(language, "Loo 的偏好建模台", "Loo's preference studio")}</Badge>
            <div className="space-y-3">
              <h2 className="text-[30px] font-semibold tracking-[-0.04em] text-[color:var(--foreground)]">
                {pick(language, "先讲清你的规则，系统才有资格给出推荐。", "Make the rules explicit before the product earns the right to recommend anything.")}
              </h2>
              <p className="max-w-3xl text-sm leading-7 text-[color:var(--muted-foreground)]">
                {pick(language, `这里的设置会直接驱动推荐逻辑和未来的组合健康评分。对 ${viewer.displayName} 来说，这里不是装饰页，而是整套藏宝规则的源头。`, `These settings directly drive recommendation logic and future portfolio health scoring. For ${viewer.displayName}, this is not decorative configuration; it is the source of the entire rule set.`)}
              </p>
            </div>
          </div>
          <div className="relative grid gap-3 sm:grid-cols-2">
            <div className="pointer-events-none absolute bottom-[-32px] right-[-20px] h-36 w-36 rounded-full bg-[radial-gradient(circle,rgba(139,168,255,0.16),rgba(139,168,255,0))] blur-3xl" />
            <SettingsSignal title={pick(language, "引导路径", "Guided path")} detail={pick(language, "适合先生成一个可编辑的起始配置", "Best when you want a generated starting allocation you can still edit.")} />
            <SettingsSignal title={pick(language, "手动路径", "Manual path")} detail={pick(language, "适合直接控制目标配置与账户优先级", "Best when you want direct control over targets and funding order.")} />
          </div>
        </CardContent>
      </Card>

      <Card className="border-white/55 bg-white/38">
        <CardContent className="px-6 py-5">
          <p className="text-sm text-[color:var(--muted-foreground)]">
            {pick(language, `这里配置的偏好会直接驱动 ${viewer.displayName} 的推荐结果和未来组合健康评分。`, `All recommendations and portfolio health scoring are calculated from the preferences configured here for ${viewer.displayName}.`)}
          </p>
        </CardContent>
      </Card>
      {language === "zh" && citizenResponse ? (
        <CitizenProfilePanel language={language} citizen={citizenResponse.data.citizen} isAdmin={citizenResponse.data.isAdmin} />
      ) : (
        <Card className="border-white/55 bg-white/38">
          <CardContent className="px-6 py-6">
            <div className="space-y-2">
              <Badge variant="primary">Profile</Badge>
              <h3 className="text-xl font-semibold tracking-[-0.03em] text-[color:var(--foreground)]">{viewer.displayName}</h3>
              <p className="text-sm text-[color:var(--muted-foreground)]">{viewer.email}</p>
            </div>
          </CardContent>
        </Card>
      )}
      <PreferencesWorkbench
        language={language}
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
    <div className="rounded-[24px] border border-white/62 bg-[linear-gradient(180deg,rgba(255,255,255,0.62),rgba(255,250,252,0.32))] p-4 shadow-[0_14px_30px_rgba(110,103,130,0.06)] backdrop-blur-md">
      <p className="text-sm font-medium text-[color:var(--muted-foreground)]">{title}</p>
      <p className="mt-3 text-base font-semibold text-[color:var(--foreground)]">{detail}</p>
    </div>
  );
}
