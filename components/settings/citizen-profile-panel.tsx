"use client";

import { useState, useTransition } from "react";
import { ShieldCheck } from "lucide-react";
import type { CitizenAddressTier, CitizenProfile, CitizenRank, DisplayLanguage } from "@/lib/backend/models";
import { CitizenIdentityCard } from "@/components/auth/citizen-identity-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getCitizenAddressLabel,
  getCitizenAddressVisualSrc,
  getCitizenAvatarAsset,
  getCitizenGenderLabel,
  getCitizenRankLabel,
  getCitizenRankVisualSrc
} from "@/lib/i18n/citizen";
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
  const hasActiveOverride = Boolean(citizen.overrideRank || citizen.overrideAddressTier || citizen.overrideIdCode);
  const previewRank = rank || citizen.derivedRank;
  const previewAddressTier = addressTier || citizen.derivedAddressTier;
  const previewIdCode = idCode.trim() || citizen.derivedIdCode;

  function saveOverrides(next: {
    rank?: CitizenRank | null;
    addressTier?: CitizenAddressTier | null;
    idCode?: string | null;
  }) {
    setStatus("");
    startTransition(async () => {
      const response = await fetch("/api/settings/citizen-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next)
      });
      const payload = await safeJson(response);
      if (!response.ok) {
        setStatus(getApiErrorMessage(payload, "公民档案 override 保存失败。"));
        return;
      }
      setStatus("公民档案 override 已保存。刷新后会看到最新生效值。");
    });
  }

  function saveCurrentOverrides() {
    void saveOverrides({
      rank: rank || null,
      addressTier: addressTier || null,
      idCode: idCode.trim() ? idCode.trim() : null
    });
  }

  function clearOverrides() {
    setRank("");
    setAddressTier("");
    setIdCode("");
    void saveOverrides({
      rank: null,
      addressTier: null,
      idCode: null
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Badge variant="primary">{language === "zh" ? "公民档案" : "Profile"}</Badge>
        {isAdmin ? <Badge variant="warning">{language === "zh" ? "可进行皇令改写" : "Admin override enabled"}</Badge> : null}
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
        language={language}
        mascotName={getCitizenAvatarAsset(citizen.effectiveRank === "emperor" ? "emperor" : citizen.avatarType)}
        issueLabel={language === "zh" ? "发证时间" : "Issued"}
        issueValue={new Date(citizen.issuedAt).toLocaleDateString(language === "zh" ? "zh-CN" : "en-CA")}
        rankVisualSrc={getCitizenRankVisualSrc(citizen.effectiveRank)}
        addressVisualSrc={getCitizenAddressVisualSrc(citizen.effectiveAddressTier)}
        rankValue={citizen.effectiveRank}
        addressTier={citizen.effectiveAddressTier}
      >
        <div className="rounded-[22px] border border-white/55 bg-white/42 px-4 py-3 text-sm text-[color:var(--muted-foreground)]">
          {language === "zh"
            ? `当前财富快照：CAD ${citizen.wealthScoreSnapshotCad.toLocaleString("en-CA")}。系统默认按这个值推导身份和住址；若存在皇令改写，则以改写结果为准。`
            : `Wealth snapshot: CAD ${citizen.wealthScoreSnapshotCad.toLocaleString("en-CA")}. Rank and address are derived from this value unless an admin override is active.`}
        </div>
      </CitizenIdentityCard>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[24px] border border-white/55 bg-white/38 p-4 backdrop-blur-md">
          <p className="text-sm text-[color:var(--muted-foreground)]">{language === "zh" ? "当前生效身份" : "Effective rank"}</p>
          <p className="mt-3 text-xl font-semibold text-[color:var(--foreground)]">{getCitizenRankLabel(citizen.effectiveRank, language)}</p>
        </div>
        <div className="rounded-[24px] border border-white/55 bg-white/38 p-4 backdrop-blur-md">
          <p className="text-sm text-[color:var(--muted-foreground)]">{language === "zh" ? "系统推导住址" : "Derived address"}</p>
          <p className="mt-3 text-xl font-semibold text-[color:var(--foreground)]">{getCitizenAddressLabel(citizen.derivedAddressTier, language)}</p>
        </div>
        <div className="rounded-[24px] border border-white/55 bg-white/38 p-4 backdrop-blur-md">
          <p className="text-sm text-[color:var(--muted-foreground)]">{language === "zh" ? "Override 状态" : "Override status"}</p>
          <p className="mt-3 text-xl font-semibold text-[color:var(--foreground)]">
            {hasActiveOverride ? (language === "zh" ? "已启用皇令改写" : "Active") : (language === "zh" ? "未启用" : "Inactive")}
          </p>
        </div>
      </div>

      {isAdmin ? (
        <CitizenIdentityCard
          title={citizen.citizenName}
          subtitle={language === "zh" ? "皇令改写预览" : "Admin override preview"}
          badge={getCitizenRankLabel(previewRank, language)}
          fields={[
            { label: language === "zh" ? "性别" : "Gender", value: getCitizenGenderLabel(citizen.gender, language) },
            { label: language === "zh" ? "生日" : "Birth date", value: citizen.birthDate ?? (language === "zh" ? "未登记" : "Not set") },
            { label: language === "zh" ? "身份" : "Rank", value: getCitizenRankLabel(previewRank, language) },
            { label: language === "zh" ? "住址" : "Address", value: getCitizenAddressLabel(previewAddressTier, language) }
          ]}
          idCode={previewIdCode}
          language={language}
          mascotName={getCitizenAvatarAsset(previewRank === "emperor" ? "emperor" : citizen.avatarType)}
          issueLabel={language === "zh" ? "预览状态" : "Preview status"}
          issueValue={language === "zh" ? "保存后生效" : "Applies after save"}
          rankVisualSrc={getCitizenRankVisualSrc(previewRank)}
          addressVisualSrc={getCitizenAddressVisualSrc(previewAddressTier)}
          rankValue={previewRank}
          addressTier={previewAddressTier}
        >
          <div className="rounded-[22px] border border-white/55 bg-white/42 px-4 py-3 text-sm text-[color:var(--muted-foreground)]">
            {language === "zh"
              ? "这里预览的是当前皇令改写选择将会生成的最终身份证效果。未保存前不会覆盖正式档案。"
              : "This previews the effective citizen card that will be generated from the current override selections. It does not overwrite the saved archive until you save."}
          </div>
        </CitizenIdentityCard>
      ) : null}

      {isAdmin ? (
        <div className="rounded-[28px] border border-white/58 bg-[color:var(--card-muted)] p-5 shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-[color:var(--warning)]" />
            <div>
              <p className="font-semibold text-[color:var(--foreground)]">{language === "zh" ? "皇令改写" : "Admin override"}</p>
              <p className="text-sm text-[color:var(--muted-foreground)]">
                {language === "zh" ? "第一阶段只支持改写当前查看公民的身份、住址和身份证号。" : "First-stage admin controls update the current citizen's rank, address, and ID code only."}
              </p>
            </div>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <label className="block space-y-2">
              <span className="text-sm font-medium">{language === "zh" ? "改写身份" : "Override rank"}</span>
              <select value={rank} onChange={(event) => setRank(event.target.value as CitizenRank | "")} className={FIELD_CLASS_NAME}>
                <option value="">{language === "zh" ? "沿用系统推导" : "Use derived value"}</option>
                {RANK_OPTIONS.map((option) => (
                  <option key={option} value={option}>{getCitizenRankLabel(option, language)}</option>
                ))}
              </select>
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium">{language === "zh" ? "改写住址" : "Override address"}</span>
              <select value={addressTier} onChange={(event) => setAddressTier(event.target.value as CitizenAddressTier | "")} className={FIELD_CLASS_NAME}>
                <option value="">{language === "zh" ? "沿用系统推导" : "Use derived value"}</option>
                {ADDRESS_OPTIONS.map((option) => (
                  <option key={option} value={option}>{getCitizenAddressLabel(option, language)}</option>
                ))}
              </select>
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium">{language === "zh" ? "改写身份证号" : "Override citizen ID"}</span>
              <input value={idCode} onChange={(event) => setIdCode(event.target.value)} className={FIELD_CLASS_NAME} placeholder="LOO9988" />
            </label>
          </div>
          {status ? <p className="mt-4 text-sm text-[color:var(--muted-foreground)]">{status}</p> : null}
          <div className="mt-5 flex flex-wrap gap-3">
            <Button type="button" onClick={saveCurrentOverrides} disabled={isPending}>
              {isPending ? (language === "zh" ? "保存中..." : "Saving...") : (language === "zh" ? "保存改写" : "Save override")}
            </Button>
            <Button type="button" variant="secondary" onClick={clearOverrides} disabled={isPending || !hasActiveOverride}>
              {language === "zh" ? "清空改写" : "Clear override"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
