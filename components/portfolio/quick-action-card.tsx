import Link from "next/link";
import { cn } from "@/lib/utils";

type QuickActionCardProps = {
  icon: React.ReactNode;
  title: string;
  description: string;
  href?: string;
  className?: string;
};

export function QuickActionCard({ icon, title, description, href, className }: QuickActionCardProps) {
  const content = (
    <div className={cn("rounded-[24px] border border-white/55 bg-white/38 p-4 backdrop-blur-md transition-colors hover:bg-white/46", className)}>
      <div className="flex items-center gap-2 font-medium text-[color:var(--foreground)]">
        <span className="text-[color:var(--primary)]">{icon}</span>
        {title}
      </div>
      <p className="mt-2 text-sm leading-6 text-[color:var(--muted-foreground)]">{description}</p>
    </div>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}
