"use client";

import { useMemo, useState, useTransition } from "react";
import { GitMerge, PencilLine, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import type { DisplayLanguage } from "@/lib/backend/models";
import type { PortfolioAccountDetailData } from "@/lib/contracts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

type Mode = "edit" | "add-holding" | "merge" | null;

function toNullableNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function localizeMergeWarning(language: DisplayLanguage, warning: string) {
  if (/same account type/i.test(warning)) {
    return pick(language, "目前只能合并同一种账户类型，比如 TFSA 合到 TFSA。", "Only accounts with the same type can be merged right now.");
  }
  if (/Contribution room is not additive/i.test(warning)) {
    return pick(language, "合并时，可用额度不会相加。系统会保留目标账户当前的额度数字。", "Contribution room is not additive during merge. The target account room value will be kept.");
  }
  return warning;
}

export function AccountMaintenancePanel({
  detail,
  language
}: {
  detail: PortfolioAccountDetailData;
  language: DisplayLanguage;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(null);
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [nickname, setNickname] = useState(detail.editContext.current.nickname);
  const [institution, setInstitution] = useState(detail.editContext.current.institution);
  const [type, setType] = useState(detail.editContext.current.type);
  const [currency, setCurrency] = useState<"CAD" | "USD">(detail.editContext.current.currency);
  const [contributionRoomCad, setContributionRoomCad] = useState(
    detail.editContext.current.contributionRoomCad == null ? "" : String(detail.editContext.current.contributionRoomCad)
  );

  const [targetAccountId, setTargetAccountId] = useState("");
  const [preview, setPreview] = useState<MergePreview | null>(null);

  const mergeTargets = useMemo(() => detail.editContext.mergeTargets, [detail.editContext.mergeTargets]);

  function toggleMode(nextMode: Exclude<Mode, null>) {
    setMode((current) => (current === nextMode ? null : nextMode));
    setStatus("");
  }

  function saveAccount() {
    setStatus("");
    startTransition(async () => {
      const response = await fetch(`/api/portfolio/accounts/${detail.account.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname: nickname.trim(),
          institution: institution.trim(),
          type,
          currency,
          contributionRoomCad: toNullableNumber(contributionRoomCad)
        })
      });
      const payload = await safeJson(response);
      if (!response.ok) {
        setStatus(getApiErrorMessage(payload, pick(language, "保存账户修改失败。", "Failed to save account changes.")));
        return;
      }
      setStatus(pick(language, "账户资料已经保存，页面正在刷新。", "Account details saved. Refreshing now."));
      router.refresh();
    });
  }

  function fetchPreview() {
    if (!targetAccountId) {
      setStatus(pick(language, "先选一个要合并进去的目标账户。", "Pick a target account first."));
      return;
    }
    setStatus("");
    startTransition(async () => {
      const response = await fetch("/api/portfolio/accounts/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceAccountId: detail.account.id, targetAccountId })
      });
      const payload = await safeJson(response);
      if (!response.ok) {
        setStatus(getApiErrorMessage(payload, pick(language, "读取合并预览失败。", "Failed to preview the merge.")));
        return;
      }
      setPreview((payload as { data?: MergePreview }).data ?? null);
    });
  }

  function confirmMerge() {
    if (!targetAccountId) return;
    setStatus("");
    startTransition(async () => {
      const response = await fetch("/api/portfolio/accounts/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceAccountId: detail.account.id, targetAccountId, confirm: true })
      });
      const payload = await safeJson(response);
      if (!response.ok) {
        setStatus(getApiErrorMessage(payload, pick(language, "合并账户失败。", "Failed to merge the accounts.")));
        return;
      }
      router.push(`/portfolio/account/${targetAccountId}`);
      router.refresh();
    });
  }

  function deleteAccount() {
    setStatus("");
    startTransition(async () => {
      const response = await fetch(`/api/portfolio/accounts/${detail.account.id}`, { method: "DELETE" });
      const payload = await safeJson(response);
      if (!response.ok) {
        setShowDeleteConfirm(false);
        setStatus(getApiErrorMessage(payload, pick(language, "删除账户失败。", "Failed to delete this account.")));
        return;
      }
      router.push("/portfolio");
      router.refresh();
    });
  }

  return (
    <>
      <Card>
        <CardContent className="space-y-5 px-6 py-6">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-[color:var(--foreground)]">{pick(language, "管理这个账户", "Manage this account")}</p>
            <p className="text-sm text-[color:var(--muted-foreground)]">
              {pick(
                language,
                "这里把改资料、去导入页补持仓、合并重复账户和删除空账户放在一起。先选一种操作，再往下做。",
                "Use this panel to update account basics, jump into import with this account pre-selected, merge duplicates, or remove an empty account."
              )}
            </p>
          </div>

          <div className="space-y-3">
            {[
              {
                value: "edit" as const,
                icon: <PencilLine className="h-4 w-4" />,
                title: pick(language, "改账户资料", "Edit account"),
                detail: pick(language, "改账户名、机构、币种和可用额度。", "Update the name, institution, currency, and room value.")
              },
              {
                value: "add-holding" as const,
                icon: <Plus className="h-4 w-4" />,
                title: pick(language, "往里加一笔持仓", "Add a holding"),
                detail: pick(language, "带着这个账户跳去导入页，直接补一笔新持仓。", "Jump into import with this account already locked in.")
              },
              {
                value: "merge" as const,
                icon: <GitMerge className="h-4 w-4" />,
                title: pick(language, "合并重复账户", "Merge accounts"),
                detail: pick(language, "先看预览，再把重复账户并到一起。", "Preview first, then combine duplicate accounts.")
              }
            ].map((action) => {
              const active = mode === action.value;
              return (
                <button
                  key={action.value}
                  type="button"
                  onClick={() => toggleMode(action.value)}
                  className={`flex w-full items-start justify-between gap-4 rounded-[24px] border px-4 py-4 text-left transition ${
                    active
                      ? "border-[rgba(240,143,178,0.34)] bg-[linear-gradient(135deg,rgba(255,255,255,0.82),rgba(246,218,230,0.24),rgba(221,232,255,0.14))] shadow-[0_14px_28px_rgba(110,103,130,0.08)]"
                      : "border-white/55 bg-white/36 hover:border-white/72 hover:bg-white/48"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/60 bg-white/62 text-[color:var(--foreground)]">
                      {action.icon}
                    </span>
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-[color:var(--foreground)]">{action.title}</p>
                      <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">{action.detail}</p>
                    </div>
                  </div>
                  {active ? <Badge variant="primary">{pick(language, "当前正在改这个", "Active")}</Badge> : null}
                </button>
              );
            })}
          </div>

          {mode === null ? (
            <div className="rounded-[24px] border border-white/55 bg-white/36 p-4 text-sm leading-7 text-[color:var(--muted-foreground)]">
              {pick(
                language,
                "先选上面其中一种操作，再往下改账户资料、去导入页补持仓，或者把重复账户合并掉。删除账户也会收在“改账户资料”的最下面。",
                "Pick one action above to edit the account, jump into import with this account, or merge duplicates. Account deletion stays at the bottom of the edit flow."
              )}
            </div>
          ) : null}

          {mode === "edit" ? (
            <div className="space-y-5">
              <div className="space-y-4">
                <label className="space-y-2">
                  <span className="text-sm font-medium">{pick(language, "账户昵称", "Nickname")}</span>
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
                <label className="space-y-2">
                  <span className="text-sm font-medium">{pick(language, "规划基准 CAD 下的可用额度", "Available room in planning CAD")}</span>
                  <input className={FIELD_CLASS_NAME} value={contributionRoomCad} onChange={(event) => setContributionRoomCad(event.target.value)} inputMode="decimal" />
                  <p className="text-xs text-[color:var(--muted-foreground)]">
                    {pick(language, "这里填的是你希望系统在做推荐时参考的可用额度。", "This is the room value the recommendation engine should use when planning the next contribution.")}
                  </p>
                </label>
              </div>
              <div className="space-y-4">
                <Button type="button" onClick={saveAccount} disabled={isPending} leadingIcon={isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : undefined}>
                  {isPending ? pick(language, "保存中...", "Saving...") : pick(language, "保存账户修改", "Save account changes")}
                </Button>

                <div className="rounded-[26px] border border-[rgba(213,101,120,0.18)] bg-[linear-gradient(135deg,rgba(255,255,255,0.72),rgba(248,224,232,0.3),rgba(255,239,224,0.18))] p-5">
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-[color:var(--foreground)]">{pick(language, "删除这个账户", "Delete this account")}</p>
                    <p className="text-sm leading-7 text-[color:var(--muted-foreground)]">
                      {pick(
                        language,
                        "只有在这个账户已经清空时，系统才允许删除。如果这里还有持仓，请先移动、删除那笔持仓，或把整个账户合并掉。",
                        "You can only delete an account after its holdings are cleared. If it still has positions, move them, delete them, or merge the account first."
                      )}
                    </p>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Button type="button" variant="secondary" className="border-[rgba(213,101,120,0.26)] text-[color:var(--danger)]" onClick={() => setShowDeleteConfirm(true)} leadingIcon={<Trash2 className="h-4 w-4" />}>
                      {pick(language, "删除这个账户", "Delete this account")}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {mode === "add-holding" ? (
            <div className="space-y-5">
              <div className="rounded-[22px] border border-white/55 bg-white/38 p-4 text-sm leading-7 text-[color:var(--muted-foreground)]">
                {pick(
                  language,
                  "新增持仓最好还是走导入页，这样账户选择、价格校对和写入流程都和其他入口保持一致。这里会直接带着当前账户跳过去。",
                  "Adding a new holding works best through the import page so account selection, quote checks, and write logic stay aligned with the rest of the app. This shortcut takes the current account with you."
                )}
              </div>
              <Button
                href={`/import?workflow=portfolio&mode=guided&accountMode=existing&accountId=${detail.account.id}&method=manual-entry`}
                type="button"
                leadingIcon={<Plus className="h-4 w-4" />}
              >
                {pick(language, "带着这个账户去导入页补持仓", "Open import with this account pre-selected")}
              </Button>
            </div>
          ) : null}

          {mode === "merge" ? (
            <div className="space-y-5">
              <label className="space-y-2">
                <span className="text-sm font-medium">{pick(language, "要合并到哪个账户里", "Merge into which account")}</span>
                <select className={FIELD_CLASS_NAME} value={targetAccountId} onChange={(event) => setTargetAccountId(event.target.value)}>
                  <option value="">{pick(language, "先选一个目标账户", "Select a target account")}</option>
                  {mergeTargets.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>

              {!preview ? null : (
                <div className="space-y-3">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-[22px] border border-white/55 bg-white/42 p-4 text-sm text-[color:var(--muted-foreground)]">
                      <p className="font-medium text-[color:var(--foreground)]">{pick(language, "原账户", "Source account")}</p>
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
                      <p>{pick(language, "会搬过去的持仓", "Holdings moved")}: {preview.movedHoldingCount}</p>
                    </div>
                  </div>
                  {preview.warnings.map((warning, index) => (
                    <div key={`merge-warning-${index}`} className="rounded-[22px] border border-[rgba(240,143,178,0.25)] bg-[linear-gradient(135deg,rgba(255,255,255,0.72),rgba(245,214,235,0.28),rgba(255,239,224,0.2))] p-4 text-sm leading-7 text-[color:var(--muted-foreground)]">
                      {localizeMergeWarning(language, warning)}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                <Button type="button" variant="secondary" onClick={fetchPreview} disabled={isPending} leadingIcon={isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : undefined}>
                  {isPending ? pick(language, "读取预览中...", "Loading preview...") : pick(language, "先看合并预览", "Preview merge")}
                </Button>
                <Button type="button" onClick={confirmMerge} disabled={isPending || !preview}>
                  {pick(language, "确认合并", "Confirm merge")}
                </Button>
                {mergeTargets.length === 0 ? <Badge variant="warning">{pick(language, "现在没有可合并的同类型目标账户。", "No compatible same-type target account is available.")}</Badge> : null}
              </div>
            </div>
          ) : null}

          {status ? <p className="text-sm text-[color:var(--muted-foreground)]">{status}</p> : null}
        </CardContent>
      </Card>

      {!showDeleteConfirm ? null : (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[rgba(42,34,57,0.18)] px-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[28px] border border-white/60 bg-[linear-gradient(135deg,rgba(255,255,255,0.84),rgba(246,218,230,0.36),rgba(221,232,255,0.28))] p-6 shadow-[0_24px_60px_rgba(110,103,130,0.18)]">
            <div className="space-y-3">
              <p className="text-lg font-semibold text-[color:var(--foreground)]">{pick(language, "确认删除这个账户？", "Delete this account?")}</p>
              <p className="text-sm leading-7 text-[color:var(--muted-foreground)]">
                {pick(
                  language,
                  "删除后会回到组合页。如果账户里还有持仓，系统会阻止这次删除，并提醒你先移动、删除或合并。",
                  "After deletion you will return to the portfolio page. If the account still contains holdings, the system will block deletion and tell you to move, delete, or merge them first."
                )}
              </p>
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <Button type="button" variant="secondary" onClick={() => setShowDeleteConfirm(false)}>
                {pick(language, "取消", "Cancel")}
              </Button>
              <Button type="button" className="border-[rgba(213,101,120,0.2)] bg-[linear-gradient(135deg,rgba(213,101,120,0.92),rgba(240,143,178,0.82))]" onClick={deleteAccount} disabled={isPending} leadingIcon={isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}>
                {isPending ? pick(language, "删除中...", "Deleting...") : pick(language, "确认删除", "Confirm delete")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
