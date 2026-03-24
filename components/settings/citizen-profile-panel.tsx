"use client";

import { useEffect, useState, useTransition } from "react";
import { ShieldCheck } from "lucide-react";
import type { CitizenAddressTier, CitizenProfile, CitizenRank, DisplayLanguage } from "@/lib/backend/models";
import { CitizenIdentityCard } from "@/components/auth/citizen-identity-card";
import { CitizenLoreDialog } from "@/components/settings/citizen-lore-dialog";
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
  const [activeLore, setActiveLore] = useState<"rank" | "address" | null>(null);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const hasActiveOverride = Boolean(citizen.overrideRank || citizen.overrideAddressTier || citizen.overrideIdCode);
  const previewRank = rank || citizen.derivedRank;
  const previewAddressTier = addressTier || citizen.derivedAddressTier;
  const previewIdCode = idCode.trim() || citizen.derivedIdCode;

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setActiveLore(null);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

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
        setStatus(getApiErrorMessage(payload, "公民档案改写保存失败。"));
        return;
      }
      setStatus("公民档案改写已保存。刷新后会看到最新生效值。");
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Badge variant="primary">{language === "zh" ? "公民档案" : "Profile"}</Badge>
          {isAdmin ? <Badge variant="warning">{language === "zh" ? "可进行皇令改写" : "Admin override enabled"}</Badge> : null}
        </div>
        {isAdmin ? (
          <Button
            type="button"
            variant="secondary"
            onClick={() => setOverrideOpen((current) => !current)}
          >
            {overrideOpen
              ? (language === "zh" ? "收起皇令改写" : "Hide override")
              : (language === "zh" ? "打开皇令改写" : "Open override")}
          </Button>
        ) : null}
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
        stampInteraction="modal"
        onStampSelect={setActiveLore}
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
          <p className="text-sm text-[color:var(--muted-foreground)]">{language === "zh" ? "皇令改写状态" : "Override status"}</p>
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
          stampInteraction="modal"
          onStampSelect={setActiveLore}
        >
          <div className="rounded-[22px] border border-white/55 bg-white/42 px-4 py-3 text-sm text-[color:var(--muted-foreground)]">
            {language === "zh"
              ? "这里预览的是当前皇令改写选择将会生成的最终身份证效果。未保存前不会覆盖正式档案。"
              : "This previews the effective citizen card that will be generated from the current override selections. It does not overwrite the saved archive until you save."}
          </div>
        </CitizenIdentityCard>
      ) : null}

      {isAdmin ? (
        <div className="rounded-[28px] border border-white/58 bg-[color:var(--card-muted)] shadow-[var(--shadow-card)]">
          <button
            type="button"
            onClick={() => setOverrideOpen((current) => !current)}
            className="flex w-full items-start justify-between gap-4 px-5 py-5 text-left"
          >
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-[color:var(--warning)]" />
              <div>
                <p className="font-semibold text-[color:var(--foreground)]">{language === "zh" ? "皇令改写" : "Admin override"}</p>
                <p className="text-sm text-[color:var(--muted-foreground)]">
                  {language === "zh" ? "默认收起，仅在需要时展开修改身份、住址和身份证号。" : "Collapsed by default. Open only when you need to adjust rank, address, or ID code."}
                </p>
              </div>
            </div>
            <Badge variant="warning">{overrideOpen ? (language === "zh" ? "收起" : "Collapse") : (language === "zh" ? "展开" : "Expand")}</Badge>
          </button>
          {overrideOpen ? (
            <div className="border-t border-white/40 px-5 py-5">
              <div className="grid gap-4 md:grid-cols-3">
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
      ) : null}

      <CitizenLoreDialog
        open={activeLore === "rank"}
        title={language === "zh" ? "身份等级" : "Citizen rank"}
        description={getRankLoreText(citizen.effectiveRank, language)}
        imageSrc={getCitizenRankVisualSrc(citizen.effectiveRank) ?? "/mascot/citizen-default.jpg"}
        imageAlt={language === "zh" ? "身份等级图解" : "Citizen rank illustration"}
        language={language}
        onClose={() => setActiveLore(null)}
      />
      <CitizenLoreDialog
        open={activeLore === "address"}
        title={language === "zh" ? "Loo国住址" : "Loo residence"}
        description={getAddressLoreText(citizen.effectiveAddressTier, language)}
        imageSrc={getCitizenAddressVisualSrc(citizen.effectiveAddressTier) ?? "/mascot/citizen-default.jpg"}
        imageAlt={language === "zh" ? "Loo国住址图解" : "Loo residence illustration"}
        language={language}
        onClose={() => setActiveLore(null)}
      />
    </div>
  );
}

function getRankLoreText(rank: CitizenRank, language: DisplayLanguage) {
  switch (rank) {
    case "lowly-ox":
      return language === "zh"
        ? "这是刚完成入籍登记的基层档位。通常说明资产规模还处在最早阶段，更多是在牛棚外圈打基础，离真正的宝库核心仍有明显距离。"
        : "This is the first admitted tier. It usually means the portfolio is still at an early stage and remains far from the inner treasury core.";
    case "base-loo":
      return language === "zh"
        ? "已经离开牛棚，搬入 Loo国郊区。说明你已经跨过最初门槛，开始拥有更稳定的国库席位。"
        : "This tier has moved beyond the barn into the Loo suburbs, marking the first stable treasury threshold.";
    case "citizen":
      return language === "zh"
        ? "正式 Loo国子民。能够在城内立足，代表资产配置开始进入更成熟、更稳定的阶段。"
        : "A full citizen tier with city standing, showing the portfolio has entered a more stable and mature stage.";
    case "general":
      return language === "zh"
        ? "Loo皇大将军是自动晋升可达到的最高等级。说明资产规模已经接近宝库核心层，只差皇令册封的一步。"
        : "Grand General is the highest automatically derived tier, showing the portfolio is approaching the inner treasury core.";
    case "emperor":
      return language === "zh"
        ? "Loo皇属于管理员特批的最高位阶，只有在皇令改写后才会出现。它同时拥有最稀缺的编号和最尊贵的身份标识。"
        : "Emperor is the admin-only highest class, reserved for explicitly overridden profiles with the rarest ID treatment.";
    default:
      return language === "zh"
        ? "这枚章记录你当前在 Loo国的身份等级。"
        : "This stamp records your current standing in Loo.";
  }
}

function getAddressLoreText(addressTier: CitizenAddressTier, language: DisplayLanguage) {
  switch (addressTier) {
    case "cowshed":
      return language === "zh"
        ? "牛棚是最外层的起点住址，说明当前财富仍停留在观察与积累阶段，尚未进入真正的内城生活。"
        : "The cowshed is the outermost starting address, used when wealth remains at an early observation stage.";
    case "suburbs":
      return language === "zh"
        ? "Loo国郊区代表你已经通过最基础的财富门槛，开始拥有稳定但仍偏外围的居住资格。"
        : "The Loo suburbs indicate that the first stable wealth threshold has been crossed.";
    case "city":
      return language === "zh"
        ? "Loo国城内说明你已经是稳定居民，能在更核心的国库区域里长期驻留。"
        : "Inner Loo City marks stable residency closer to the capital allocation core.";
    case "palace-gate":
      return language === "zh"
        ? "Loo皇殿前说明你的资产已经逼近核心层，只差一步就能触碰真正的皇室区域。"
        : "The palace gate suggests the portfolio is now very close to the inner royal zone.";
    case "bedchamber":
      return language === "zh"
        ? "Loo皇寝宫仅向最高等级开放，只会出现在被皇令特批的极高位阶中。"
        : "The Emperor's Chamber is reserved for the highest privileged class only.";
    default:
      return language === "zh"
        ? "这枚住址章会随着财富等级变化，显示你在 Loo国中的居住层级。"
        : "This residence stamp reflects your current housing tier inside Loo.";
  }
}
