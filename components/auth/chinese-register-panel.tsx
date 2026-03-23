"use client";

import Image from "next/image";
import { useMemo, useState, useTransition } from "react";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CitizenIdentityCard } from "@/components/auth/citizen-identity-card";
import { LooApprovalDialog } from "@/components/auth/loo-approval-dialog";
import { LooTermsDialog } from "@/components/auth/loo-terms-dialog";
import {
  getCitizenAddressLabel,
  getCitizenAddressVisualSrc,
  getCitizenAvatarAsset,
  getCitizenGenderLabel,
  getCitizenRankLabel,
  getCitizenRankVisualSrc
} from "@/lib/i18n/citizen";
import type { CitizenProfile, CitizenGender, DisplayLanguage } from "@/lib/backend/models";

type RegisterResult = {
  user: {
    email: string;
  };
  citizenProfile: CitizenProfile;
};

type ResultModal =
  | {
      type: "success";
      citizenProfile: CitizenProfile;
    }
  | {
      type: "error";
      message: string;
    };

const FIELD_CLASS_NAME =
  "w-full rounded-[20px] border border-white/58 bg-white/56 px-4 py-3 text-sm outline-none backdrop-blur-xl";

export function ChineseRegisterPanel({
  language = "zh"
}: {
  language?: DisplayLanguage;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [displayName, setDisplayName] = useState("");
  const [gender, setGender] = useState<CitizenGender>("female");
  const [birthDate, setBirthDate] = useState("");
  const [resultModal, setResultModal] = useState<ResultModal | null>(null);

  const previewTitle = displayName.trim() || "Loo国待认证公民";
  const previewGender = getCitizenGenderLabel(gender, language);
  const previewAvatar = useMemo(() => getCitizenAvatarAsset(gender), [gender]);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const payload = {
        displayName: String(formData.get("displayName") ?? ""),
        email: String(formData.get("email") ?? ""),
        password: String(formData.get("password") ?? ""),
        gender: String(formData.get("gender") ?? "") as CitizenGender,
        birthDate: String(formData.get("birthDate") ?? ""),
        acceptLooTerms: formData.get("acceptLooTerms") === "on",
        mode: "loo-zh" as const,
        displayLanguage: "zh" as const
      };

      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        setResultModal({
          type: "error",
          message: typeof body?.error === "string" ? body.error : "本次提交未通过 Loo皇审批。"
        });
        return;
      }

      const result = body?.data as RegisterResult | undefined;
      if (!result?.citizenProfile) {
        setResultModal({
          type: "error",
          message: "Loo皇已批准你的申请，但颁证结果未能正确返回。请稍后重试。"
        });
        return;
      }

      setResultModal({
        type: "success",
        citizenProfile: result.citizenProfile
      });
    });
  }

  return (
    <>
      <CitizenIdentityCard
        title={previewTitle}
        subtitle="Loo国公民登记台"
        badge="待认证"
        fields={[
          { label: "性别", value: previewGender },
          { label: "生日", value: birthDate || "待登记" },
          { label: "身份", value: "待审核" },
          { label: "住址", value: "等待系统授予" }
        ]}
        idCode="LOO-待颁发"
        language={language}
        mascotName={previewAvatar}
        issueLabel="发证状态"
        issueValue="等待 Loo皇审批"
      >
        <div className="space-y-5">
          <div className="flex flex-wrap gap-3">
            <Button href="/login" variant="secondary" leadingIcon={<ArrowLeft className="h-4 w-4" />}>
              返回登录认证
            </Button>
          </div>

          <div className="rounded-[22px] border border-white/55 bg-white/42 px-4 py-3 text-sm leading-7 text-[color:var(--muted-foreground)]">
            提交后会先交由 Loo皇审批。审批通过后，系统会颁发身份证并引导你回到登录页完成进入流程。
          </div>

          <form action={handleSubmit} className="space-y-4">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-[color:var(--foreground)]">公民姓名</span>
              <input
                name="displayName"
                required
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                className={FIELD_CLASS_NAME}
              />
            </label>

            <div className="space-y-2">
              <span className="text-sm font-medium text-[color:var(--foreground)]">性别</span>
              <input type="hidden" name="gender" value={gender} />
              <div className="grid gap-3 sm:grid-cols-2">
                <GenderOptionCard
                  active={gender === "female"}
                  title="女公民"
                  detail="自动绑定 Loo female 形象"
                  imageSrc="/mascot/Loo_female.jpg"
                  imageAlt="Loo female citizen"
                  onClick={() => setGender("female")}
                />
                <GenderOptionCard
                  active={gender === "male"}
                  title="男公民"
                  detail="自动绑定 Loo male 形象"
                  imageSrc="/mascot/Loo_male.jpg"
                  imageAlt="Loo male citizen"
                  onClick={() => setGender("male")}
                />
              </div>
            </div>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-[color:var(--foreground)]">生日</span>
              <input
                name="birthDate"
                type="date"
                required
                value={birthDate}
                onChange={(event) => setBirthDate(event.target.value)}
                className={FIELD_CLASS_NAME}
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-[color:var(--foreground)]">公民邮箱</span>
              <input name="email" type="email" required className={FIELD_CLASS_NAME} />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-[color:var(--foreground)]">公民口令</span>
              <input name="password" type="password" required className={FIELD_CLASS_NAME} />
            </label>

            <label className="flex items-start gap-3 rounded-[20px] border border-white/55 bg-white/44 px-4 py-3 text-sm text-[color:var(--foreground)]">
              <input name="acceptLooTerms" type="checkbox" required className="mt-1 h-4 w-4 rounded border-white/60" />
              <span className="leading-6">
                我自愿接受 Loo皇审批并遵守 Loo国条例。
                <span className="ml-1 inline-block">
                  <LooTermsDialog language={language} triggerLabel="点击查看条例" />
                </span>
              </span>
            </label>

            <Button type="submit" disabled={isPending}>
              {isPending ? "提交审批中..." : "提交 Loo皇审批"}
            </Button>
          </form>
        </div>
      </CitizenIdentityCard>

      <LooApprovalDialog
        open={Boolean(resultModal && resultModal.type === "success")}
        tone="success"
        title="伟大的 Loo皇已为你颁发 Loo国身份证"
        description="你的公民身份已通过审批，Loo皇允许你进入宝库。请返回登录页，使用刚刚登记的公民凭证完成进入流程。"
        primaryAction={{
          label: "前往登录认证",
          onClick: () => router.push("/login")
        }}
      >
        {resultModal?.type === "success" ? (
          <CitizenIdentityCard
            title={resultModal.citizenProfile.citizenName}
            subtitle="Loo国公民身份证"
            badge={getCitizenRankLabel(resultModal.citizenProfile.effectiveRank, language)}
            fields={[
              { label: "性别", value: getCitizenGenderLabel(resultModal.citizenProfile.gender, language) },
              { label: "生日", value: resultModal.citizenProfile.birthDate ?? "未登记" },
              { label: "身份", value: getCitizenRankLabel(resultModal.citizenProfile.effectiveRank, language) },
              { label: "住址", value: getCitizenAddressLabel(resultModal.citizenProfile.effectiveAddressTier, language) }
            ]}
            idCode={resultModal.citizenProfile.effectiveIdCode}
            language={language}
            mascotName={getCitizenAvatarAsset(resultModal.citizenProfile.avatarType)}
            issueLabel="发证时间"
            issueValue={new Date(resultModal.citizenProfile.issuedAt).toLocaleDateString("zh-CN")}
            rankVisualSrc={getCitizenRankVisualSrc(resultModal.citizenProfile.effectiveRank)}
            addressVisualSrc={getCitizenAddressVisualSrc(resultModal.citizenProfile.effectiveAddressTier)}
          />
        ) : null}
      </LooApprovalDialog>

      <LooApprovalDialog
        open={Boolean(resultModal && resultModal.type === "error")}
        tone="error"
        title="本次加入申请未通过审批"
        description={resultModal?.type === "error" ? resultModal.message : ""}
        primaryAction={{
          label: "返回修改申请",
          onClick: () => setResultModal(null)
        }}
      >
        {resultModal?.type === "error" ? (
          <div className="rounded-[26px] border border-white/65 bg-white/62 px-5 py-4">
            <p className="text-sm leading-7 text-[color:var(--foreground)]">
              请检查公民邮箱是否重复、生日与姓名是否完整，或确认你已勾选 Loo国条例后重新提交审批。
            </p>
          </div>
        ) : null}
      </LooApprovalDialog>
    </>
  );
}

function GenderOptionCard({
  active,
  title,
  detail,
  imageSrc,
  imageAlt,
  onClick
}: {
  active: boolean;
  title: string;
  detail: string;
  imageSrc: string;
  imageAlt: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "rounded-[22px] border border-white/72 bg-[linear-gradient(135deg,rgba(255,255,255,0.9),rgba(255,238,244,0.82))] px-4 py-3 shadow-[0_14px_28px_rgba(110,103,130,0.1)]"
          : "rounded-[22px] border border-white/52 bg-white/48 px-4 py-3 shadow-[0_10px_22px_rgba(110,103,130,0.06)] transition-colors hover:bg-white/62"
      }
    >
      <div className="flex items-center gap-3">
        <div className="h-14 w-14 overflow-hidden rounded-[18px] border border-white/60 bg-white/60">
          <Image src={imageSrc} alt={imageAlt} width={112} height={112} className="h-full w-full object-cover" unoptimized />
        </div>
        <div className="text-left">
          <p className="text-sm font-semibold text-[color:var(--foreground)]">{title}</p>
          <p className="text-xs text-[color:var(--muted-foreground)]">{detail}</p>
        </div>
      </div>
    </button>
  );
}
