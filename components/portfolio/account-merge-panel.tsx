"use client";

import { useMemo, useState, useTransition } from "react";
import { GitMerge, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import type { DisplayLanguage } from "@/lib/backend/models";
import type { PortfolioAccountDetailData } from "@/lib/contracts";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getApiErrorMessage, safeJson } from "@/lib/client/api";
import { pick } from "@/lib/i18n/ui";

const FIELD_CLASS_NAME =
  "w-full rounded-[20px] border border-white/58 bg-white/56 px-4 py-3 text-sm outline-none backdrop-blur-xl";

type MergePreview = {
  source: { id: string; name: string; type: string; valueCad: number; holdingCount: number };
  target: { id: string; name: string; type: string; valueCad: number; holdingCount: number };
  mergedValueCad: number;
  movedHoldingCount: number;
  warnings: string[];
};

export function AccountMergePanel({
  detail,
  language
}: {
  detail: PortfolioAccountDetailData;
  language: DisplayLanguage;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("");
  const [targetAccountId, setTargetAccountId] = useState("");
  const [preview, setPreview] = useState<MergePreview | null>(null);

  const availableTargets = useMemo(
    () => detail.editContext.mergeTargets,
    [detail.editContext.mergeTargets]
  );

  function fetchPreview() {
    if (!targetAccountId) {
      setStatus(pick(language, "先选一个要并入的目标账户。", "Pick a target account first."));
      return;
    }
    setStatus("");
    startTransition(async () => {
      const response = await fetch("/api/portfolio/accounts/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceAccountId: detail.account.id,
          targetAccountId
        })
      });
      const payload = await safeJson(response);
      if (!response.ok) {
        setStatus(getApiErrorMessage(payload, pick(language, "合并预览失败。", "Failed to preview the merge.")));
        return;
      }
      setPreview((payload as { data?: MergePreview }).data ?? null);
    });
  }

  function confirmMerge() {
    if (!targetAccountId) {
      return;
    }
    setStatus("");
    startTransition(async () => {
      const response = await fetch("/api/portfolio/accounts/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceAccountId: detail.account.id,
          targetAccountId,
          confirm: true
        })
      });
      const payload = await safeJson(response);
      if (!response.ok) {
        setStatus(getApiErrorMessage(payload, pick(language, "账户合并失败。", "Failed to merge the accounts.")));
        return;
      }
      router.push(`/portfolio/account/${targetAccountId}`);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardContent className="space-y-4 px-6 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-[color:var(--foreground)]">{pick(language, "把这个账户并到别的账户", "Merge this account")}</p>
            <p className="text-sm text-[color:var(--muted-foreground)]">
              {pick(language, "适合把重复的 TFSA / FHSA / RRSP 合到一个账户里。这里会先预览，再确认。", "Use this to consolidate duplicate TFSA / FHSA / RRSP accounts. The flow always shows a preview before you confirm.")}
            </p>
          </div>
          <Button type="button" variant="secondary" onClick={() => setOpen((current) => !current)} leadingIcon={<GitMerge className="h-4 w-4" />}>
            {open ? pick(language, "收起合并工具", "Hide merge tool") : pick(language, "打开合并工具", "Open merge tool")}
          </Button>
        </div>

        {!open ? null : (
          <div className="space-y-5">
            <label className="space-y-2">
              <span className="text-sm font-medium">{pick(language, "并到哪个账户", "Merge into which account")}</span>
              <select className={FIELD_CLASS_NAME} value={targetAccountId} onChange={(event) => setTargetAccountId(event.target.value)}>
                <option value="">{pick(language, "先选目标账户", "Select a target account")}</option>
                {availableTargets.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>

            {!preview ? null : (
              <div className="space-y-3">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-[22px] border border-white/55 bg-white/42 p-4 text-sm text-[color:var(--muted-foreground)]">
                    <p className="font-medium text-[color:var(--foreground)]">{pick(language, "来源账户", "Source account")}</p>
                    <p className="mt-2">{preview.source.name}</p>
                    <p>{pick(language, "持仓数", "Holdings")}: {preview.source.holdingCount}</p>
                  </div>
                  <div className="rounded-[22px] border border-white/55 bg-white/42 p-4 text-sm text-[color:var(--muted-foreground)]">
                    <p className="font-medium text-[color:var(--foreground)]">{pick(language, "目标账户", "Target account")}</p>
                    <p className="mt-2">{preview.target.name}</p>
                    <p>{pick(language, "持仓数", "Holdings")}: {preview.target.holdingCount}</p>
                  </div>
                  <div className="rounded-[22px] border border-white/55 bg-white/42 p-4 text-sm text-[color:var(--muted-foreground)]">
                    <p className="font-medium text-[color:var(--foreground)]">{pick(language, "合并后总值", "Combined value")}</p>
                    <p className="mt-2">CAD {preview.mergedValueCad.toLocaleString("en-CA")}</p>
                    <p>{pick(language, "会移动的持仓", "Holdings moved")}: {preview.movedHoldingCount}</p>
                  </div>
                </div>
                {preview.warnings.map((warning, index) => (
                  <div key={`merge-warning-${index}`} className="rounded-[22px] border border-[rgba(240,143,178,0.25)] bg-[linear-gradient(135deg,rgba(255,255,255,0.72),rgba(245,214,235,0.28),rgba(255,239,224,0.2))] p-4 text-sm leading-7 text-[color:var(--muted-foreground)]">
                    {warning}
                  </div>
                ))}
              </div>
            )}

            {status ? <p className="text-sm text-[color:var(--muted-foreground)]">{status}</p> : null}
            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="secondary" onClick={fetchPreview} disabled={isPending} leadingIcon={isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : undefined}>
                {isPending ? pick(language, "生成中...", "Loading preview...") : pick(language, "先看合并预览", "Preview merge")}
              </Button>
              <Button type="button" onClick={confirmMerge} disabled={isPending || !preview}>
                {pick(language, "确认合并", "Confirm merge")}
              </Button>
              {availableTargets.length === 0 ? <Badge variant="warning">{pick(language, "当前没有适合同类合并的目标账户", "No compatible same-type target account is available")}</Badge> : null}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
