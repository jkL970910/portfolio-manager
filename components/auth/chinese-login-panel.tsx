"use client";

import { ArrowRight, LogOut, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CitizenIdentityCard } from "@/components/auth/citizen-identity-card";
import { LooTermsDialog } from "@/components/auth/loo-terms-dialog";
import {
  getCitizenAddressLabel,
  getCitizenAddressVisualSrc,
  getCitizenAvatarAsset,
  getCitizenGenderLabel,
  getCitizenRankLabel,
  getCitizenRankVisualSrc
} from "@/lib/i18n/citizen";
import type { CitizenProfile, DisplayLanguage } from "@/lib/backend/models";

export function ChineseLoginPanel({
  language = "zh",
  error,
  citizen,
  defaultCitizenCard,
  authenticateAction,
  logoutAction
}: {
  language?: DisplayLanguage;
  error?: string;
  citizen: CitizenProfile | null;
  defaultCitizenCard: {
    title: string;
    subtitle: string;
    fields: Array<{ label: string; value: string }>;
    idCode: string;
  };
  authenticateAction: (formData: FormData) => Promise<void>;
  logoutAction: () => Promise<void>;
}) {
  if (citizen) {
    return (
      <CitizenIdentityCard
        title={citizen.citizenName}
        subtitle="Loo国公民身份证"
        badge={getCitizenRankLabel(citizen.effectiveRank, language)}
        fields={[
          { label: "性别", value: getCitizenGenderLabel(citizen.gender, language) },
          { label: "生日", value: citizen.birthDate ?? "未登记" },
          { label: "身份", value: getCitizenRankLabel(citizen.effectiveRank, language) },
          { label: "住址", value: getCitizenAddressLabel(citizen.effectiveAddressTier, language) }
        ]}
        idCode={citizen.effectiveIdCode}
        language={language}
        mascotName={getCitizenAvatarAsset(citizen.effectiveRank === "emperor" ? "emperor" : citizen.avatarType)}
        issueLabel="发证时间"
        issueValue={new Date(citizen.issuedAt).toLocaleDateString("zh-CN")}
        rankVisualSrc={getCitizenRankVisualSrc(citizen.effectiveRank)}
        addressVisualSrc={getCitizenAddressVisualSrc(citizen.effectiveAddressTier)}
        rankValue={citizen.effectiveRank}
        addressTier={citizen.effectiveAddressTier}
      >
        <div className="flex flex-wrap gap-3">
          <Button href="/dashboard" trailingIcon={<ArrowRight className="h-4 w-4" />}>
            进入 Loo国
          </Button>
          <form action={logoutAction}>
            <Button type="submit" variant="secondary" leadingIcon={<LogOut className="h-4 w-4" />}>
              切换公民
            </Button>
          </form>
        </div>
      </CitizenIdentityCard>
    );
  }

  return (
    <CitizenIdentityCard
      title={defaultCitizenCard.title}
      subtitle={defaultCitizenCard.subtitle}
      badge="待认证"
      fields={defaultCitizenCard.fields}
      idCode={defaultCitizenCard.idCode}
      language={language}
      mascotName="citizenDefault"
      issueLabel="发证状态"
      issueValue="等待 Loo皇审查"
      rankValue={null}
      addressTier={null}
    >
      <div className="space-y-4">
        <p className="text-sm leading-7 text-[color:var(--muted-foreground)]">
          只有Loo国公民才能使用伟大Loo皇提供的金库。
        </p>
        {error ? (
          <div className="rounded-[20px] border border-[#f1bcc8] bg-white/66 px-4 py-3 text-sm text-[#a34a64]">
            登录失败。请检查公民凭证，或确认本地数据库已经启动。
          </div>
        ) : null}
        <form action={authenticateAction} className="space-y-4">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-[color:var(--foreground)]">公民邮箱</span>
            <input
              name="email"
              type="email"
              required
              defaultValue="jiekun@example.com"
              className="w-full rounded-[20px] border border-white/58 bg-white/56 px-4 py-3 text-sm outline-none backdrop-blur-xl"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-[color:var(--foreground)]">公民口令</span>
            <input
              name="password"
              type="password"
              required
              defaultValue="demo1234"
              className="w-full rounded-[20px] border border-white/58 bg-white/56 px-4 py-3 text-sm outline-none backdrop-blur-xl"
            />
          </label>
          <label className="flex items-start gap-3 rounded-[20px] border border-white/55 bg-white/44 px-4 py-3 text-sm text-[color:var(--foreground)]">
            <input type="checkbox" required className="mt-1 h-4 w-4 rounded border-white/60" />
            <span className="leading-6">
              我同意遵守 Loo国条例。
              <span className="ml-1 inline-block">
                <LooTermsDialog language={language} triggerLabel="点击查看详情" />
              </span>
            </span>
          </label>
          <Button type="submit" trailingIcon={<ShieldCheck className="h-4 w-4" />}>
            进入 Loo国
          </Button>
          <div className="pt-1">
            <Link href="/register" className="text-sm font-medium text-[color:var(--secondary)]">
              还没有公民身份证？去申请加入 Loo国
            </Link>
          </div>
        </form>
      </div>
    </CitizenIdentityCard>
  );
}
