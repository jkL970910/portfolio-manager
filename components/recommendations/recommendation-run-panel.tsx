"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Wand2 } from "lucide-react";
import { MascotAsset } from "@/components/brand/mascot-asset";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getApiErrorMessage, safeJson } from "@/lib/client/api";
import type { DisplayLanguage } from "@/lib/i18n/ui";
import { pick } from "@/lib/i18n/ui";

export function RecommendationRunPanel({
  initialContributionAmount,
  language = "zh"
}: {
  initialContributionAmount: number;
  language?: DisplayLanguage;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [contributionAmount, setContributionAmount] = useState(initialContributionAmount || 5000);
  const [status, setStatus] = useState<{ type: "idle" | "success" | "error"; message: string }>({ type: "idle", message: "" });

  function generateRun() {
    setStatus({ type: "idle", message: "" });
    startTransition(async () => {
      const response = await fetch("/api/recommendations/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contributionAmountCad: Number(contributionAmount) })
      });
      const payload = await safeJson(response);
      if (!response.ok) {
        setStatus({ type: "error", message: getApiErrorMessage(payload, pick(language, "生成推荐结果失败。", "Failed to generate recommendation run.")) });
        return;
      }
      setStatus({
        type: "success",
        message: pick(
          language,
          `已按规划基准币种 CAD 为 ${Number(contributionAmount).toLocaleString("en-CA")} 生成新的推荐结果。`,
          `Recommendation run generated for ${Number(contributionAmount).toLocaleString("en-CA")} CAD in the planning base currency.`
        )
      });
      router.refresh();
    });
  }

  return (
    <div className="space-y-4 rounded-[22px] border border-[color:var(--border)] bg-[color:var(--card-muted)] p-4">
      <div className="grid gap-3 md:grid-cols-[1fr_92px] md:items-start">
        <div>
          <p className="font-semibold">{pick(language, "生成新的推荐结果", "Generate new recommendation run")}</p>
          <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
            {pick(language, "系统会基于当前持仓和已保存偏好，重新计算资金配置优先级。", "This recomputes ranked funding priorities from current holdings and saved preferences.")}
          </p>
        </div>
        <div className="space-y-3 justify-self-start md:justify-self-end">
          <Badge variant="primary">{pick(language, "实时生成", "Live recalculation")}</Badge>
          <MascotAsset name="reviewPointing" className="h-[88px] w-[88px]" sizes="88px" />
        </div>
      </div>
      <label className="block space-y-2">
        <span className="text-sm font-medium text-[color:var(--foreground)]">{pick(language, "投入金额（规划基准，CAD）", "Contribution amount (planning base, CAD)")}</span>
        <input
          type="number"
          min={1}
          value={contributionAmount}
          onChange={(event) => setContributionAmount(Number(event.target.value))}
          className="w-full rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3 text-sm outline-none"
        />
        <p className="text-xs text-[color:var(--muted-foreground)]">
          {pick(language, "推荐会先按规划基准币种生成，再按你选择的显示币种展示到各页面。", "Recommendation runs are generated in the planning base currency, then displayed in your selected currency across the product.")}
        </p>
      </label>
      {status.type !== "idle" ? (
        <div className={`grid gap-3 rounded-2xl border px-4 py-3 text-sm md:grid-cols-[1fr_96px] md:items-center ${status.type === "success" ? "border-[#b6d7c7] bg-[#eef8f1] text-[#21613f]" : "border-[#e7b0b8] bg-[#fff3f5] text-[#8e2433]"}`}>
          <div>{status.message}</div>
          <div className="justify-self-start md:justify-self-end">
            <MascotAsset name={status.type === "success" ? "successSmirk" : "alertRun"} className="h-24 w-24" sizes="96px" />
          </div>
        </div>
      ) : null}
      <Button type="button" onClick={generateRun} disabled={isPending} leadingIcon={<Wand2 className="h-4 w-4" />}>
        {isPending ? pick(language, "生成中...", "Generating...") : pick(language, "生成推荐结果", "Generate recommendation run")}
      </Button>
    </div>
  );
}

