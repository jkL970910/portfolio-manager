"use client";

import { useState, useTransition } from "react";
import { PencilLine, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import type { DisplayLanguage } from "@/lib/backend/models";
import type { PortfolioAccountDetailData } from "@/lib/contracts";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getApiErrorMessage, safeJson } from "@/lib/client/api";
import { pick } from "@/lib/i18n/ui";

const FIELD_CLASS_NAME =
  "w-full rounded-[20px] border border-white/58 bg-white/56 px-4 py-3 text-sm outline-none backdrop-blur-xl";

export function AccountEditPanel({
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
  const [nickname, setNickname] = useState(detail.editContext.current.nickname);
  const [institution, setInstitution] = useState(detail.editContext.current.institution);
  const [type, setType] = useState(detail.editContext.current.type);
  const [currency, setCurrency] = useState<"CAD" | "USD">(detail.editContext.current.currency);

  function saveChanges() {
    setStatus("");
    startTransition(async () => {
      const response = await fetch(`/api/portfolio/accounts/${detail.account.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname: nickname.trim(),
          institution: institution.trim(),
          type,
          currency
        })
      });
      const payload = await safeJson(response);
      if (!response.ok) {
        setStatus(getApiErrorMessage(payload, pick(language, "账户保存失败。", "Failed to save account changes.")));
        return;
      }
      setStatus(pick(language, "账户资料已经保存。页面正在刷新最新结果。", "Account details have been saved. Refreshing now."));
      router.refresh();
    });
  }

  return (
    <Card>
      <CardContent className="space-y-4 px-6 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-[color:var(--foreground)]">{pick(language, "改这个账户", "Edit this account")}</p>
            <p className="text-sm text-[color:var(--muted-foreground)]">
              {pick(language, "先修账户名、机构和币种这些基础资料。注册额度请到设置页按账户类别统一维护。", "Start by correcting account name, institution, and currency. Registered room is managed by account type in Settings.")}
            </p>
          </div>
          <Button type="button" variant="secondary" onClick={() => setOpen((current) => !current)} leadingIcon={<PencilLine className="h-4 w-4" />}>
            {open ? pick(language, "收起编辑", "Hide editor") : pick(language, "编辑这个账户", "Open editor")}
          </Button>
        </div>

        {!open ? null : (
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium">{pick(language, "账户名", "Nickname")}</span>
                <input className={FIELD_CLASS_NAME} value={nickname} onChange={(event) => setNickname(event.target.value)} />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">{pick(language, "机构", "Institution")}</span>
                <input className={FIELD_CLASS_NAME} value={institution} onChange={(event) => setInstitution(event.target.value)} />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">{pick(language, "账户类型", "Account type")}</span>
                <select className={FIELD_CLASS_NAME} value={type} onChange={(event) => setType(event.target.value)}>
                  {detail.editContext.typeOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">{pick(language, "账户币种", "Currency")}</span>
                <select className={FIELD_CLASS_NAME} value={currency} onChange={(event) => setCurrency(event.target.value as "CAD" | "USD")}>
                  {detail.editContext.currencyOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
            </div>

            {status ? <p className="text-sm text-[color:var(--muted-foreground)]">{status}</p> : null}
            <div className="flex flex-wrap gap-3">
              <Button type="button" onClick={saveChanges} disabled={isPending} leadingIcon={isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : undefined}>
                {isPending ? pick(language, "保存中...", "Saving...") : pick(language, "保存账户资料", "Save account changes")}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
