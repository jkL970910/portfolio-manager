import Image from "next/image";
import { cn } from "@/lib/utils";

const MASCOT_ASSETS = {
  dashboardSmirk: {
    src: "/mascot/dashboard-smirk-hero.png",
    alt: "Smirking mascot for dashboard hero"
  },
  alertRun: {
    src: "/mascot/alert-run.png",
    alt: "Running alert mascot"
  },
  reviewPointing: {
    src: "/mascot/review-pointing.png",
    alt: "Pointing mascot for review confirmation"
  },
  sideEyeReview: {
    src: "/mascot/side-eye-review.png",
    alt: "Side-eye mascot for review states"
  },
  successSmirk: {
    src: "/mascot/success-smirk.png",
    alt: "Smirking mascot for success states"
  },
  miniSticker: {
    src: "/mascot/mini-sticker.png",
    alt: "Mini mascot sticker"
  },
  looEmperor: {
    src: "/mascot/Loo_King.jpg",
    alt: "Loo emperor mascot"
  },
  citizenMale: {
    src: "/mascot/Loo_male.jpg",
    alt: "Male citizen mascot"
  },
  citizenFemale: {
    src: "/mascot/Loo_female.jpg",
    alt: "Female citizen mascot"
  },
  citizenDefault: {
    src: "/mascot/citizen-default.jpg",
    alt: "Default citizen mascot"
  }
} as const;

export type MascotAssetName = keyof typeof MASCOT_ASSETS;

export function MascotAsset({
  name,
  className,
  priority = false,
  sizes = "220px"
}: {
  name: MascotAssetName;
  className?: string;
  priority?: boolean;
  sizes?: string;
}) {
  const asset = MASCOT_ASSETS[name];

  return (
    <div
      className={cn(
        "relative block shrink-0 overflow-hidden rounded-[28px] border border-white/45 bg-white/30 shadow-[var(--shadow-card)] backdrop-blur-md",
        className
      )}
    >
      <Image
        src={asset.src}
        alt={asset.alt}
        width={512}
        height={512}
        sizes={sizes}
        className="h-full w-full object-cover"
        priority={priority}
        unoptimized
      />
    </div>
  );
}
