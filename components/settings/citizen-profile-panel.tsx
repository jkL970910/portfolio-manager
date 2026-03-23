"use client";

import { useState, useTransition } from "react";
import { ShieldCheck } from "lucide-react";
import type { CitizenAddressTier, CitizenProfile, CitizenRank, DisplayLanguage } from "@/lib/backend/models";
import { CitizenIdentityCard } from "@/components/auth/citizen-identity-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCitizenAddressLabel, getCitizenAvatarAsset, getCitizenGenderLabel, getCitizenRankLabel } from "@/lib/i18n/citizen";
import { getApiErrorMessage, safeJson } from "@/lib/client/api";

const FIELD_CLASS_NAME =
  "w-full rounded-[20px] border border-white/58 bg-white/56 px-4 py-3 text-sm outline-none backdrop-blur-xl";

const RANK_OPTIONS: CitizenRank[] = ["lowly-ox", "base-loo", "citizen", "general", "emperor"];
const ADDRESS_OPTIONS: CitizenAddressTier[] = ["cowshed", "suburbs", "city", "palace-gate", "bedchamber"];

export function CitizenProfilePanel({
  citizen,
  isAdmin,
  language = "zh"
}: {
  citizen: CitizenProfile;
  isAdmin: boolean;
  language?: DisplayLanguage;
}) {
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState("");
  const [rank, setRank] = useState<CitizenRank | "">(citizen.overrideRank ?? "");
  const [addressTier, setAddressTier] = useState<CitizenAddressTier | "">(citizen.overrideAddressTier ?? "");
  const [idCode, setIdCode] = useState(citizen.overrideIdCode ?? "");

  function saveOverrides() {
    setStatus("");
    startTransition(async () => {
      const response = await fetch("/api/settings/citizen-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rank: rank || null,
          addressTier: addressTier || null,
          idCode: idCode.trim() ? idCode.trim() : null
        })
      });
      const payload = await safeJson(response);
      if (!response.ok) {
        setStatus(getApiErrorMessage(payload, "公民档案 override 保存失败。"));
        return;
      }
      setStatus("公民档案 override 已保存。刷新后会看到最新生效值。");
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Badge variant="primary">{language === "zh" ? "公民档案" : "Profile"}</Badge>
        {isAdmin ? <Badge variant="warning">{language === "zh" ? "Admin override 可用" : "Admin override enabled"}</Badge> : null}
      </div>
      <CitizenIdentityCard
        title={citizen.citizenName}
        subtitle={language === "zh" ? "Loo国公民身份证" : "Citizen identity"}
        badge={getCitizenRankLabel(citizen.effectiveRank, language)}
        fields={[
          { label: language === "zh" ? "性别" : "Gender", value: getCitizenGenderLabel(citizen.gender, language) },
          { label: language === "zh" ? "生日" : "Birth date", value: citizen.birthDate ?? (language === "zh" ? "未登记" : "Not set") },
          { label: language === "zh" ? "身份" : "Rank", value: getCitizenRankLabel(citizen.effectiveRank, language) },
          { label: language === "zh" ? "住址" : "Address", value: getCitizenAddressLabel(citizen.effectiveAddressTier, language) }
        ]}
        idCode={citizen.effectiveIdCode}
        mascotName={getCitizenAvatarAsset(citizen.effectiveRank === "emperor" ? "emperor" : citizen.avatarType)}
      >
        <div className="rounded-[22px] border border-white/55 bg-white/42 px-4 py-3 text-sm text-[color:var(--muted-foreground)]">
          {language === "zh"
            ? `当前财富快照：CAD ${citizen.wealthScoreSnapshotCad.toLocaleString("en-CA")}。系统默认按这个值推导身份和住址，若存在 Admin override，则以 override 为准。`
            : `Wealth snapshot: CAD ${citizen.wealthScoreSnapshotCad.toLocaleString("en-CA")}. Rank and address are derived from this value unless an admin override is active.`}
        </div>
      </CitizenIdentityCard>

      {isAdmin ? (
        <div className="rounded-[28px] border border-white/58 bg-[color:var(--card-muted)] p-5 shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-[color:var(--warning)]" />
            <div>
              <p className="font-semibold text-[color:var(--foreground)]">Admin override</p>
              <p className="text-sm text-[color:var(--muted-foreground)]">
                {language === "zh" ? "第一阶段只支持修改当前查看公民的身份、住址和身份证号。" : "First-stage admin controls update the current citizen's rank, address, and ID code only."}
              </p>
            </div>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <label className="block space-y-2">
              <span className="text-sm font-medium">{language === "zh" ? "Override 身份" : "Override rank"}</span>
              <select value={rank} onChange={(event) => setRank(event.target.value as CitizenRank | "")} className={FIELD_CLASS_NAME}>
                <option value="">{language === "zh" ? "沿用系统推导" : "Use derived value"}</option>
                {RANK_OPTIONS.map((option) => (
                  <option key={option} value={option}>{getCitizenRankLabel(option, language)}</option>
                ))}
              </select>
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium">{language === "zh" ? "Override 住址" : "Override address"}</span>
              <select value={addressTier} onChange={(event) => setAddressTier(event.target.value as CitizenAddressTier | "")} className={FIELD_CLASS_NAME}>
                <option value="">{language === "zh" ? "沿用系统推导" : "Use derived value"}</option>
                {ADDRESS_OPTIONS.map((option) => (
                  <option key={option} value={option}>{getCitizenAddressLabel(option, language)}</option>
                ))}
              </select>
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium">{language === "zh" ? "Override 身份证号" : "Override citizen ID"}</span>
              <input value={idCode} onChange={(event) => setIdCode(event.target.value)} className={FIELD_CLASS_NAME} placeholder="LOO9988" />
            </label>
          </div>
          {status ? <p className="mt-4 text-sm text-[color:var(--muted-foreground)]">{status}</p> : null}
          <div className="mt-5">
            <Button type="button" onClick={saveOverrides} disabled={isPending}>
              {isPending ? (language === "zh" ? "保存中..." : "Saving...") : (language === "zh" ? "保存 override" : "Save override")}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
