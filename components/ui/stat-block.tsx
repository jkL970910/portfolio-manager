type StatBlockProps = {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail?: string;
};

export function StatBlock({ icon, label, value, detail }: StatBlockProps) {
  return (
    <div className="rounded-[24px] border border-white/55 bg-white/38 p-4 backdrop-blur-md">
      <div className="flex items-center gap-2 text-sm text-[color:var(--muted-foreground)]">
        {icon}
        {label}
      </div>
      <p className="mt-3 text-2xl font-semibold text-[color:var(--foreground)]">{value}</p>
      {detail ? <p className="mt-2 text-sm leading-6 text-[color:var(--muted-foreground)]">{detail}</p> : null}
    </div>
  );
}
