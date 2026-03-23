"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import type { CitizenAddressTier, CitizenRank, DisplayLanguage } from "@/lib/backend/models";
import { MascotAsset, type MascotAssetName } from "@/components/brand/mascot-asset";
import { Badge } from "@/components/ui/badge";
import { pick } from "@/lib/i18n/ui";
import { cn } from "@/lib/utils";

type CitizenField = {
  label: string;
  value: string;
};

type ActiveStamp = "rank" | "address" | null;

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
  addressVisualSrc,
  rankValue,
  addressTier
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
  rankValue?: CitizenRank | null;
  addressTier?: CitizenAddressTier | null;
}) {
  const leadingFields = fields.slice(0, 2);
  const trailingFields = fields.slice(2, 4);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [activeStamp, setActiveStamp] = useState<ActiveStamp>(null);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current) {
        return;
      }
      if (!rootRef.current.contains(event.target as Node)) {
        setActiveStamp(null);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setActiveStamp(null);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div
      ref={rootRef}
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
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">{subtitle}</p>
            </div>
            {badge ? <Badge variant="primary">{badge}</Badge> : null}
          </div>

          <div className="grid gap-5 md:grid-cols-[1fr_208px] md:items-start">
            <div className="space-y-4">
              <div className="rounded-[24px] border border-white/70 bg-[linear-gradient(180deg,rgba(226,241,255,0.82),rgba(255,236,243,0.72))] px-5 py-4 shadow-[0_14px_28px_rgba(108,121,160,0.08)]">
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
                  {pick(language, "公民姓名", "Citizen name")}
                </p>
                <h3 className="mt-2 text-[28px] font-semibold tracking-[-0.04em] text-[color:var(--foreground)]">{title}</h3>
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
                  <StampTrigger
                    side="left"
                    src={rankVisualSrc}
                    alt="Citizen rank visual"
                    title={pick(language, "身份等级", "Citizen rank")}
                    description={getRankFlavorText(rankValue, language)}
                    open={activeStamp === "rank"}
                    onToggle={() => setActiveStamp((current) => (current === "rank" ? null : "rank"))}
                    language={language}
                  />
                ) : null}
                {addressVisualSrc ? (
                  <StampTrigger
                    side="right"
                    src={addressVisualSrc}
                    alt="Citizen address visual"
                    title={pick(language, "Loo国住址", "Loo residence")}
                    description={getAddressFlavorText(addressTier, language)}
                    open={activeStamp === "address"}
                    onToggle={() => setActiveStamp((current) => (current === "address" ? null : "address"))}
                    language={language}
                  />
                ) : null}
              </div>
              <div className="rounded-[22px] border border-white/65 bg-white/58 px-4 py-3 text-center backdrop-blur-xl">
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
                  {pick(language, "证件级别", "Card class")}
                </p>
                <p className="mt-2 text-sm font-semibold text-[color:var(--foreground)]">
                  {badge ?? pick(language, "公民档案", "Citizen archive")}
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
                {issueLabel ?? pick(language, "发证时间", "Issued")}
              </p>
              <p className="mt-2 text-sm font-semibold text-[color:var(--foreground)]">{issueValue ?? "--"}</p>
            </div>
            <div className="rounded-[18px] bg-white/58 px-4 py-3 backdrop-blur-xl">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
                {pick(language, "公民编号", "Citizen ID")}
              </p>
              <p className="mt-2 text-sm font-bold tracking-[0.18em] text-[color:var(--foreground)]">{idCode}</p>
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
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">{label}</p>
      <p className="mt-2 text-sm font-semibold text-[color:var(--foreground)]">{value}</p>
    </div>
  );
}

function StampTrigger({
  side,
  src,
  alt,
  title,
  description,
  open,
  onToggle,
  language
}: {
  side: "left" | "right";
  src: string;
  alt: string;
  title: string;
  description: string;
  open: boolean;
  onToggle: () => void;
  language: DisplayLanguage;
}) {
  return (
    <div className={cn("group/stamp absolute -bottom-3 z-20", side === "left" ? "left-5" : "right-5")}>
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "rounded-full border-2 border-white/90 bg-[linear-gradient(135deg,rgba(255,255,255,0.94),rgba(255,243,247,0.88))] px-2 py-2 shadow-[0_12px_24px_rgba(110,103,130,0.16)] transition-transform duration-150 hover:scale-110 focus-visible:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]",
          open ? "scale-110" : ""
        )}
        aria-label={title}
        aria-expanded={open}
      >
        <div className="h-10 w-10 overflow-hidden rounded-full">
          <Image src={src} alt={alt} width={80} height={80} className="h-full w-full object-cover" unoptimized />
        </div>
      </button>
      {open ? (
        <div
          className={cn(
            "absolute bottom-[calc(100%+14px)] z-30 w-64 rounded-[24px] border border-white/72 bg-white/90 p-4 text-left shadow-[0_20px_40px_rgba(110,103,130,0.14)] backdrop-blur-2xl",
            side === "left" ? "left-0" : "right-0"
          )}
        >
          <div
            className={cn(
              "absolute top-full h-3 w-3 -translate-y-1/2 rotate-45 border-b border-r border-white/72 bg-white/90",
              side === "left" ? "left-8" : "right-8"
            )}
          />
          <div className="flex items-start gap-3">
            <div className="h-16 w-16 overflow-hidden rounded-[18px] border border-white/70 bg-white/72 shadow-[0_10px_20px_rgba(110,103,130,0.08)]">
              <Image src={src} alt={alt} width={128} height={128} className="h-full w-full object-cover" unoptimized />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">{title}</p>
                <button
                  type="button"
                  onClick={onToggle}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/70 bg-white/72 text-[color:var(--muted-foreground)] transition-colors hover:text-[color:var(--foreground)]"
                  aria-label={pick(language, "关闭说明", "Close details")}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="mt-2 text-sm leading-6 text-[color:var(--foreground)]">{description}</p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function getRankFlavorText(rank: CitizenRank | null | undefined, language: DisplayLanguage) {
  switch (rank) {
    case "lowly-ox":
      return pick(language, "刚入籍的基层公民，目前多在牛棚劳作，离真正的宝库核心还很远。", "A newly admitted citizen still working from the outer barn, far from the vault core.");
    case "base-loo":
      return pick(language, "已经离开牛棚，搬进了 Loo国郊区，开始拥有更稳定的国库资格。", "Past the barn phase and now living in the Loo suburbs with a steadier place in the treasury.");
    case "citizen":
      return pick(language, "正式 Loo国子民，可以在城内安家，也更接近核心财富配置权。", "A full citizen of Loo with city access and a stronger place in the capital allocation order.");
    case "general":
      return pick(language, "Loo皇大将军，已被视为宝库核心战力，距离皇殿只差一步。", "A Grand General of Loo, treated as core treasury strength and one step from the palace.");
    case "emperor":
      return pick(language, "由管理员特批的最高等级，拥有 Loo皇级别的专属身份与最稀缺编号。", "The admin-only highest class, carrying emperor-level status and the rarest ID numbers.");
    default:
      return pick(language, "这枚章记录你当前在 Loo国的身份等级。", "This stamp shows your current rank inside Loo.");
  }
}

function getAddressFlavorText(addressTier: CitizenAddressTier | null | undefined, language: DisplayLanguage) {
  switch (addressTier) {
    case "cowshed":
      return pick(language, "宝库之外的起点住址，说明当前资产还停留在最早期的观察阶段。", "The outer starting address, used when assets are still at the earliest stage.");
    case "suburbs":
      return pick(language, "Loo国郊区，说明你已通过最基础的资产门槛。", "The Loo suburbs, showing that you have crossed the initial wealth threshold.");
    case "city":
      return pick(language, "Loo国城内，代表你已经是稳定的国库居民。", "Inner Loo City, marking you as a stable resident of the treasury.");
    case "palace-gate":
      return pick(language, "Loo皇殿前，意味着你的资产规模已经接近核心层。", "Before the palace gate, meaning your assets are now near the inner core.");
    case "bedchamber":
      return pick(language, "Loo皇寝宫，仅向最高等级开放。", "The Emperor's Chamber, reserved for the highest class only.");
    default:
      return pick(language, "这枚住址章会随着你的资产等级自动变化。", "This residence stamp changes automatically with your wealth tier.");
  }
}
