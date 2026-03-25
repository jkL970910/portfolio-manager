'use client';

export function StickyRail({ children, topClassName = 'xl:top-[13rem]' }: { children: React.ReactNode; topClassName?: string }) {
  return (
    <aside
      className={`scrollbar-hidden space-y-6 xl:sticky ${topClassName} xl:self-start xl:max-h-[calc(100vh-14rem)] xl:overflow-y-auto xl:overscroll-contain xl:pr-2`}
    >
      {children}
    </aside>
  );
}
