"use client";

import { useEffect, useRef } from "react";

export function StickyRail({
  children,
  topClassName = "xl:top-[13rem]"
}: {
  children: React.ReactNode;
  topClassName?: string;
}) {
  const railRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;

    function handleWheel(event: WheelEvent) {
      const currentRail = railRef.current;
      if (!currentRail) {
        return;
      }

      if (window.matchMedia("(max-width: 1279px)").matches) {
        return;
      }

      const canScroll = currentRail.scrollHeight > currentRail.clientHeight + 1;
      if (!canScroll) {
        return;
      }

      const { scrollTop, scrollHeight, clientHeight } = currentRail;
      const deltaY = event.deltaY;
      const atTop = scrollTop <= 0;
      const atBottom = scrollTop + clientHeight >= scrollHeight - 1;

      if ((deltaY < 0 && atTop) || (deltaY > 0 && atBottom)) {
        event.preventDefault();
        window.scrollBy({ top: deltaY, behavior: "auto" });
      }
    }

    rail.addEventListener("wheel", handleWheel, { passive: false });
    return () => rail.removeEventListener("wheel", handleWheel);
  }, []);

  return (
    <aside
      ref={railRef}
      className={`scrollbar-hidden space-y-6 xl:sticky ${topClassName} xl:self-start xl:max-h-[calc(100vh-14rem)] xl:overflow-y-auto xl:overflow-x-visible xl:pr-2`}
    >
      {children}
    </aside>
  );
}
