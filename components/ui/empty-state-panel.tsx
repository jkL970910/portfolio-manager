import { MascotAsset, type MascotAssetName } from "@/components/brand/mascot-asset";
import { cn } from "@/lib/utils";

export function EmptyStatePanel({
  title,
  text,
  mascot = "miniSticker",
  className
}: {
  title: string;
  text: string;
  mascot?: MascotAssetName;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-4 rounded-[24px] border border-dashed border-white/60 bg-white/32 p-5 backdrop-blur-md md:grid-cols-[1fr_96px] md:items-center", className)}>
      <div className="space-y-2">
        <p className="text-sm font-semibold text-[color:var(--foreground)]">{title}</p>
        <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">{text}</p>
      </div>
      <div className="justify-self-start md:justify-self-end">
        <MascotAsset name={mascot} className="h-24 w-24" sizes="96px" />
      </div>
    </div>
  );
}
