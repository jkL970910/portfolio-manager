"use client";

import Image from "next/image";
import { X } from "lucide-react";
import type { DisplayLanguage } from "@/lib/backend/models";
import { pick } from "@/lib/i18n/ui";

export function CitizenLoreDialog({
  open,
  title,
  description,
  imageSrc,
  imageAlt,
  language = "zh",
  onClose
}: {
  open: boolean;
  title: string;
  description: string;
  imageSrc: string;
  imageAlt: string;
  language?: DisplayLanguage;
  onClose: () => void;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-[rgba(245,240,247,0.45)] backdrop-blur-md"
        onClick={onClose}
        aria-label={pick(language, "关闭说明", "Close details")}
      />
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-[30px] border border-white/72 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(252,246,250,0.9),rgba(246,249,255,0.88))] p-5 shadow-[0_28px_60px_rgba(96,88,120,0.2)]">
        <div className="pointer-events-none absolute right-[-24px] top-[-24px] h-36 w-36 rounded-full bg-[radial-gradient(circle,rgba(151,198,255,0.26),rgba(151,198,255,0))] blur-3xl" />
        <div className="pointer-events-none absolute bottom-[-32px] left-[-20px] h-32 w-32 rounded-full bg-[radial-gradient(circle,rgba(249,184,206,0.22),rgba(249,184,206,0))] blur-3xl" />

        <div className="relative z-10 flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
              {pick(language, "Loo国档案注解", "Loo archive note")}
            </p>
            <h3 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-[color:var(--foreground)]">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/70 bg-white/70 text-[color:var(--muted-foreground)] transition-colors hover:text-[color:var(--foreground)]"
            aria-label={pick(language, "关闭说明", "Close details")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 overflow-hidden rounded-[24px] border border-white/70 bg-white/62 shadow-[0_14px_30px_rgba(110,103,130,0.08)]">
          <Image src={imageSrc} alt={imageAlt} width={512} height={512} className="h-56 w-full object-cover" unoptimized />
        </div>

        <div className="mt-4 rounded-[24px] border border-white/65 bg-white/58 px-4 py-4 text-sm leading-7 text-[color:var(--foreground)] backdrop-blur-xl">
          {description}
        </div>
      </div>
    </div>
  );
}
