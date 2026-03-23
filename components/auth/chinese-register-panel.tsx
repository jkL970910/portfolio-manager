"use client";

import { useState, useTransition } from "react";
import { ArrowRight, CheckCircle2, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CitizenIdentityCard } from "@/components/auth/citizen-identity-card";
import { LooTermsDialog } from "@/components/auth/loo-terms-dialog";
import { getCitizenAddressLabel, getCitizenAvatarAsset, getCitizenGenderLabel, getCitizenRankLabel } from "@/lib/i18n/citizen";
import type { CitizenProfile, CitizenGender, DisplayLanguage } from "@/lib/backend/models";

type RegisterResult = {
  user: {
    email: string;
  };
  citizenProfile: CitizenProfile;
};

export function ChineseRegisterPanel({
  language = "zh"
}: {
  language?: DisplayLanguage;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<string>("");
  const [issued, setIssued] = useState<RegisterResult | null>(null);

  function handleSubmit(formData: FormData) {
    setStatus("");
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
        setStatus(typeof body?.error === "string" ? body.error : "加入 Loo国失败。");
        return;
      }

      setIssued(body.data as RegisterResult);
    });
  }

  return (
    <>
      <CitizenIdentityCard
        title="申请加入 Loo国"
        subtitle="Loo国公民登记台"
        badge="待审批"
        fields={[
          { label: "姓名", value: "注册时填写" },
          { label: "性别", value: "自动绑定公民形象" },
          { label: "生日", value: "注册时填写" },
          { label: "住址", value: "按资产自动授予" }
        ]}
        idCode="LOO-待颁发"
        mascotName="looEmperor"
      >
        <form action={handleSubmit} className="space-y-4">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-[color:var(--foreground)]">公民姓名</span>
            <input name="displayName" required className="w-full rounded-[20px] border border-white/58 bg-white/56 px-4 py-3 text-sm outline-none backdrop-blur-xl" />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-[color:var(--foreground)]">性别</span>
              <select name="gender" required className="w-full rounded-[20px] border border-white/58 bg-white/56 px-4 py-3 text-sm outline-none backdrop-blur-xl">
                <option value="female">女</option>
                <option value="male">男</option>
              </select>
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-[color:var(--foreground)]">生日</span>
              <input name="birthDate" type="date" required className="w-full rounded-[20px] border border-white/58 bg-white/56 px-4 py-3 text-sm outline-none backdrop-blur-xl" />
            </label>
          </div>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-[color:var(--foreground)]">公民邮箱</span>
            <input name="email" type="email" required className="w-full rounded-[20px] border border-white/58 bg-white/56 px-4 py-3 text-sm outline-none backdrop-blur-xl" />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-[color:var(--foreground)]">公民口令</span>
            <input name="password" type="password" required className="w-full rounded-[20px] border border-white/58 bg-white/56 px-4 py-3 text-sm outline-none backdrop-blur-xl" />
          </label>
          <label className="flex items-start gap-3 rounded-[20px] border border-white/55 bg-white/44 px-4 py-3 text-sm text-[color:var(--foreground)]">
            <input name="acceptLooTerms" type="checkbox" required className="mt-1 h-4 w-4 rounded border-white/60" />
            <span className="leading-6">
              我自愿接受 Loo皇审核并遵守 Loo国条例。
              <span className="ml-1 inline-block">
                <LooTermsDialog language={language} triggerLabel="点击查看条例" />
              </span>
            </span>
          </label>
          {status ? <div className="rounded-[20px] border border-[#f1bcc8] bg-white/66 px-4 py-3 text-sm text-[#a34a64]">{status}</div> : null}
          <Button type="submit" disabled={isPending} trailingIcon={<ShieldCheck className="h-4 w-4" />}>
            {isPending ? "审核中..." : "申请加入 Loo国"}
          </Button>
        </form>
      </CitizenIdentityCard>

      {issued ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(32,24,45,0.3)] px-4">
          <div className="w-full max-w-3xl rounded-[32px] border border-white/65 bg-[linear-gradient(145deg,rgba(255,255,255,0.94),rgba(248,236,244,0.88),rgba(233,241,255,0.84))] p-6 shadow-[var(--shadow-soft)] backdrop-blur-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">Loo国颁证处</p>
                <h3 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[color:var(--foreground)]">Loo国身份证已颁发</h3>
                <p className="mt-3 text-sm leading-7 text-[color:var(--muted-foreground)]">审核通过。你的公民身份已写入宝库系统，现在可以回到入口页，手动点击进入 Loo国。</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-[color:var(--success)]" />
            </div>
            <div className="mt-6">
              <CitizenIdentityCard
                title={issued.citizenProfile.citizenName}
                subtitle="Loo国公民身份证"
                badge={getCitizenRankLabel(issued.citizenProfile.effectiveRank, language)}
                fields={[
                  { label: "性别", value: getCitizenGenderLabel(issued.citizenProfile.gender, language) },
                  { label: "生日", value: issued.citizenProfile.birthDate ?? "未登记" },
                  { label: "身份", value: getCitizenRankLabel(issued.citizenProfile.effectiveRank, language) },
                  { label: "住址", value: getCitizenAddressLabel(issued.citizenProfile.effectiveAddressTier, language) }
                ]}
                idCode={issued.citizenProfile.effectiveIdCode}
                mascotName={getCitizenAvatarAsset(issued.citizenProfile.avatarType)}
              />
            </div>
            <div className="mt-6 flex justify-end">
              <Button type="button" trailingIcon={<ArrowRight className="h-4 w-4" />} onClick={() => router.push("/login")}>
                返回进入 Loo国
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
