import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function HealthActionQueue({
  title,
  items
}: {
  title: string;
  items: string[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item, index) => (
          <div key={`${title}-${index}`} className="rounded-[24px] border border-white/55 bg-white/36 px-4 py-3 text-sm leading-7 text-[color:var(--muted-foreground)] backdrop-blur-md">
            {item}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
