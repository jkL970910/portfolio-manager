import { Badge } from "@/components/ui/badge";

type WorkflowOptionCardProps = {
  title: string;
  detail: string;
  badge: string;
  active?: boolean;
  onClick?: () => void;
};

export function WorkflowOptionCard({ title, detail, badge, active = false, onClick }: WorkflowOptionCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[24px] border p-5 text-left transition-colors backdrop-blur-md ${
        active
          ? "border-[color:var(--primary)] bg-[color:var(--primary-soft)]"
          : "border-white/55 bg-white/36 hover:bg-white/46"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-lg font-semibold text-[color:var(--foreground)]">{title}</p>
        <Badge variant={active ? "primary" : "neutral"}>{badge}</Badge>
      </div>
      <p className="mt-2 text-sm leading-6 text-[color:var(--muted-foreground)]">{detail}</p>
    </button>
  );
}
