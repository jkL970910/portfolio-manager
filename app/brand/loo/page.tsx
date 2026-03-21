import { ArrowRight, Sparkles } from "lucide-react";
import { LooMascot, type LooMood } from "@/components/brand/loo-mascot";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const moods: Array<{ mood: LooMood; title: string; detail: string; bubble: string }> = [
  {
    mood: "guide",
    title: "Guide",
    detail: "适合登录页、导入页、空状态，语气是陪伴式提醒。",
    bubble: "先把资产放进宝库, 我来帮你看路线。"
  },
  {
    mood: "smirk",
    title: "Smirk",
    detail: "适合 Dashboard hero 或 recommendation summary，带一点欠欠的得意感。",
    bubble: "今天不乱买, 就已经很厉害了。"
  },
  {
    mood: "side-eye",
    title: "Side-eye",
    detail: "适合风险提醒、冷静确认和 review 流程。",
    bubble: "这笔钱, 真的要现在冲进去吗?"
  },
  {
    mood: "proud",
    title: "Proud",
    detail: "适合导入成功、路线生成成功、阶段完成反馈。",
    bubble: "藏宝路线已经整理好了, 去看看。"
  }
];

export default async function LooPreviewPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(255,232,242,0.9),rgba(247,244,251,0.92),rgba(232,240,255,0.9))] px-4 py-10 md:px-6">
      <div className="mx-auto max-w-[1440px] space-y-6">
        <section className="space-y-2 px-1">
          <Badge variant="primary">原创品牌形象提案</Badge>
          <h1 className="text-[32px] font-semibold tracking-tight text-[color:var(--foreground)]">Loo 角色预览</h1>
          <p className="max-w-4xl text-[15px] text-[color:var(--muted-foreground)]">
            这是一套原创的品牌 mascot 方案。保留粉色、可爱、略带欠感的情绪，但刻意拉开轮廓、鼻型、耳位和尾巴表达。
          </p>
        </section>

      <Card className="overflow-hidden bg-[linear-gradient(135deg,rgba(255,255,255,0.72),rgba(248,219,233,0.6),rgba(221,232,255,0.5))]">
        <CardContent className="grid gap-6 px-6 py-6 md:grid-cols-[1.1fr_0.9fr] md:items-center">
          <div className="space-y-4">
            <div className="space-y-3">
              <h2 className="text-[30px] font-semibold tracking-[-0.04em] text-[color:var(--foreground)]">
                Loo 是宝库的小管家，不是表格里的噪音。
              </h2>
              <p className="max-w-3xl text-sm leading-7 text-[color:var(--muted-foreground)]">
                设计目标是保留柔和粉色、陪伴感和一点坏笑的性格，但把外形做成更原创的宝库精灵轮廓。它主要出现在登录、导入、空状态、成功提示和摘要模块，不进入高密度分析表格。
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button href="/login" trailingIcon={<ArrowRight className="h-4 w-4" />}>
                打开登录页
              </Button>
              <Button href="/import" variant="secondary">
                看入库场景
              </Button>
            </div>
          </div>
          <div className="flex justify-center">
            <LooMascot mood="smirk" showBubble bubbleText="今天先看结构, 再决定要不要出手。" className="pt-14" />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        {moods.map((item) => (
          <Card key={item.mood}>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle>{item.title}</CardTitle>
                <Badge variant="neutral">{item.mood}</Badge>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-[220px_1fr] md:items-center">
              <div className="flex justify-center rounded-[24px] border border-white/55 bg-white/30 p-4 backdrop-blur-md">
                <LooMascot mood={item.mood} compact />
              </div>
              <div className="space-y-3 text-sm text-[color:var(--muted-foreground)]">
                <p>{item.detail}</p>
                <div className="rounded-[20px] border border-white/55 bg-white/36 p-4 leading-6 backdrop-blur-md">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]/80">Recommended line</p>
                  <p className="mt-2 font-medium text-[color:var(--foreground)]">{item.bubble}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>保留的气质</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm leading-6 text-[color:var(--muted-foreground)]">
            <p>粉色、圆润、陪伴感、略带坏笑的表情和轻松的提醒语气会保留。</p>
            <p>角色会偏低细节、易缩放，适合做 UI 内的 hero 和状态贴纸。</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>刻意拉开的地方</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm leading-6 text-[color:var(--muted-foreground)]">
            <p>轮廓做成头身一体的宝库精灵，不沿用现成角色的脸型、鼻型、耳位和尾巴表达。</p>
            <p>尾巴被处理成印章式藏宝尾，鼻子也改成更小更横向的宝石鼻。</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>接入顺序</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm leading-6 text-[color:var(--muted-foreground)]">
            <p>第一阶段建议先接三个位置：登录页 hero、Dashboard 欢迎区、Import 入口区。</p>
            <p className="flex items-start gap-2 text-[color:var(--foreground)]"><Sparkles className="mt-0.5 h-4 w-4 text-[color:var(--primary)]" />Dense tables 和诊断图表继续保持纯分析风格，不插入 mascot。</p>
          </CardContent>
        </Card>
      </div>
      </div>
    </main>
  );
}
