export function SectionHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className="space-y-2">
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      <p className="max-w-2xl text-sm leading-6 text-[color:var(--muted-foreground)]">{description}</p>
    </div>
  );
}
