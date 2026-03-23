"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import type { DisplayLanguage } from "@/lib/backend/models";
import { MascotAsset, type MascotAssetName } from "@/components/brand/mascot-asset";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type CitizenField = {
  label: string;
  value: string;
};

export function CitizenIdentityCard({
  title,
  subtitle,
  fields,
  idCode,
  mascotName,
  badge,
  className,
  children,
  issueLabel,
  issueValue,
  language = "zh",
  rankVisualSrc,
  addressVisualSrc
}: {
  title: string;
  subtitle?: string;
  fields: CitizenField[];
  idCode: string;
  mascotName: MascotAssetName;
  badge?: string;
  className?: string;
  children?: ReactNode;
  issueLabel?: string;
  issueValue?: string;
  language?: DisplayLanguage;
  rankVisualSrc?: string | null;
  addressVisualSrc?: string | null;
}) {
  const leadingFields = fields.slice(0, 2);
  const trailingFields = fields.slice(2, 4);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[34px] bg-[linear-gradient(135deg,rgba(156,204,255,0.55),rgba(248,205,229,0.62),rgba(255,234,199,0.54))] p-[2px] shadow-[0_22px_48px_rgba(96,88,120,0.16)]",
        className
      )}
    >
      <div className="relative overflow-hidden rounded-[32px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(252,246,250,0.9),rgba(246,249,255,0.88))] p-5 md:p-6">
        <div className="pointer-events-none absolute right-[-44px] top-[-28px] h-48 w-48 rounded-full bg-[radial-gradient(circle,rgba(151,198,255,0.28),rgba(151,198,255,0))] blur-3xl" />
        <div className="pointer-events-none absolute bottom-[-36px] left-[-28px] h-40 w-40 rounded-full bg-[radial-gradient(circle,rgba(249,184,206,0.24),rgba(249,184,206,0))] blur-3xl" />
        <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.98),transparent)]" />

        <div className="relative z-10">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div className="rounded-full bg-[linear-gradient(135deg,rgba(151,198,255,0.24),rgba(248,205,229,0.34))] px-4 py-2 shadow-[0_10px_24px_rgba(119,132,175,0.08)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
                {subtitle}
              </p>
            </div>
            {badge ? <Badge variant="primary">{badge}</Badge> : null}
          </div>

          <div className="grid gap-5 md:grid-cols-[1fr_208px] md:items-start">
            <div className="space-y-4">
              <div className="rounded-[24px] border border-white/70 bg-[linear-gradient(180deg,rgba(226,241,255,0.82),rgba(255,236,243,0.72))] px-5 py-4 shadow-[0_14px_28px_rgba(108,121,160,0.08)]">
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
                  {language === "zh" ? "公民姓名" : "Citizen name"}
                </p>
                <h3 className="mt-2 text-[28px] font-semibold tracking-[-0.04em] text-[color:var(--foreground)]">
                  {title}
                </h3>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {leadingFields.map((field, index) => (
                  <FieldBlock key={field.label} label={field.label} value={field.value} tint={index === 0 ? "blue" : "mint"} />
                ))}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {trailingFields.map((field, index) => (
                  <FieldBlock key={field.label} label={field.label} value={field.value} tint={index === 0 ? "peach" : "pink"} />
                ))}
              </div>
            </div>

            <div className="space-y-3 justify-self-start md:justify-self-end">
              <div className="relative rounded-[30px] bg-[linear-gradient(180deg,rgba(190,229,255,0.66),rgba(255,228,239,0.54))] p-2 shadow-[0_16px_28px_rgba(111,133,173,0.12)]">
                <MascotAsset name={mascotName} className="h-[208px] w-[184px] rounded-[24px] border-white/65 bg-white/42" sizes="184px" />
                {rankVisualSrc ? (
                  <div className="absolute -bottom-3 left-5 rounded-full border-2 border-white/90 bg-[linear-gradient(135deg,rgba(255,255,255,0.94),rgba(255,243,247,0.88))] px-2 py-2 shadow-[0_12px_24px_rgba(110,103,130,0.16)]">
                    <MiniStamp src={rankVisualSrc} alt="Citizen rank visual" />
                  </div>
                ) : null}
                {addressVisualSrc ? (
                  <div className="absolute -bottom-3 right-5 rounded-full border-2 border-white/90 bg-[linear-gradient(135deg,rgba(255,255,255,0.94),rgba(243,248,255,0.88))] px-2 py-2 shadow-[0_12px_24px_rgba(110,103,130,0.16)]">
                    <MiniStamp src={addressVisualSrc} alt="Citizen address visual" />
                  </div>
                ) : null}
              </div>
              <div className="rounded-[22px] border border-white/65 bg-white/58 px-4 py-3 text-center backdrop-blur-xl">
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
                  {language === "zh" ? "证件级别" : "Card class"}
                </p>
                <p className="mt-2 text-sm font-semibold text-[color:var(--foreground)]">
                  {badge ?? (language === "zh" ? "公民档案" : "Citizen archive")}
                </p>
              </div>
            </div>
          </div>

          {children ? (
            <div className="mt-5 rounded-[26px] border border-white/65 bg-[linear-gradient(180deg,rgba(255,255,255,0.74),rgba(250,244,248,0.62))] p-4 shadow-[0_14px_28px_rgba(110,103,130,0.08)] backdrop-blur-xl">
              {children}
            </div>
          ) : null}

          <div className="mt-5 grid gap-3 rounded-[24px] border border-white/70 bg-[linear-gradient(180deg,rgba(217,238,255,0.72),rgba(255,237,244,0.66))] px-5 py-4 shadow-[0_14px_28px_rgba(111,133,173,0.08)] md:grid-cols-[0.9fr_1.1fr] md:items-center">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
                {issueLabel ?? (language === "zh" ? "发证时间" : "Issued")}
              </p>
              <p className="mt-2 text-sm font-semibold text-[color:var(--foreground)]">
                {issueValue ?? "--"}
              </p>
            </div>
            <div className="rounded-[18px] bg-white/58 px-4 py-3 backdrop-blur-xl">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
                {language === "zh" ? "公民编号" : "Citizen ID"}
              </p>
              <p className="mt-2 text-sm font-bold tracking-[0.18em] text-[color:var(--foreground)]">
                {idCode}
              </p>
            </div>
          </div>
        </div>
      </div>
      <div className="pointer-events-none absolute -bottom-2 left-1/2 h-5 w-[88%] -translate-x-1/2 rounded-full bg-[linear-gradient(90deg,rgba(180,203,255,0.4),rgba(245,183,207,0.36),rgba(255,221,180,0.32))] blur-xl" />
    </div>
  );
}

function FieldBlock({
  label,
  value,
  tint
}: {
  label: string;
  value: string;
  tint: "blue" | "mint" | "peach" | "pink";
}) {
  const backgrounds: Record<typeof tint, string> = {
    blue: "bg-[linear-gradient(180deg,rgba(228,243,255,0.84),rgba(240,247,255,0.72))]",
    mint: "bg-[linear-gradient(180deg,rgba(231,249,241,0.84),rgba(243,250,247,0.72))]",
    peach: "bg-[linear-gradient(180deg,rgba(255,240,229,0.84),rgba(255,247,241,0.74))]",
    pink: "bg-[linear-gradient(180deg,rgba(255,232,242,0.84),rgba(255,244,248,0.74))]"
  };

  return (
    <div className={cn("rounded-[22px] border border-white/70 px-4 py-3 shadow-[0_12px_22px_rgba(110,103,130,0.06)]", backgrounds[tint])}>
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold text-[color:var(--foreground)]">{value}</p>
    </div>
  );
}

function MiniStamp({
  src,
  alt
}: {
  src: string;
  alt: string;
}) {
  return (
    <div className="h-10 w-10 overflow-hidden rounded-full">
      <Image src={src} alt={alt} width={80} height={80} className="h-full w-full object-cover" unoptimized />
    </div>
  );
}
