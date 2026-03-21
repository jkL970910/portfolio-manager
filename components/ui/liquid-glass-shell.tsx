"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const LiquidGlass = dynamic(() => import("liquid-glass-react"), { ssr: false });

type LiquidGlassMode = "standard" | "polar" | "prominent" | "shader";

export function LiquidGlassShell({
  children,
  className,
  contentClassName,
  fallbackClassName,
  mode = "standard",
  cornerRadius = 28,
  displacementScale = 56,
  blurAmount = 0.085,
  saturation = 142,
  aberrationIntensity = 1.6,
  elasticity = 0.18,
  overLight = true
}: {
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  fallbackClassName?: string;
  mode?: LiquidGlassMode;
  cornerRadius?: number;
  displacementScale?: number;
  blurAmount?: number;
  saturation?: number;
  aberrationIntensity?: number;
  elasticity?: number;
  overLight?: boolean;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const element = contentRef.current;
    if (!element) {
      return;
    }

    const updateSize = () => {
      const nextWidth = element.offsetWidth;
      const nextHeight = element.offsetHeight;
      setSize((current) =>
        current.width === nextWidth && current.height === nextHeight
          ? current
          : { width: nextWidth, height: nextHeight }
      );
    };

    updateSize();

    const observer = new ResizeObserver(updateSize);
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  return (
    <div className={cn("relative", className)}>
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {size.width > 0 && size.height > 0 ? (
          <LiquidGlass
            mode={mode}
            cornerRadius={cornerRadius}
            displacementScale={displacementScale}
            blurAmount={blurAmount}
            saturation={saturation}
            aberrationIntensity={aberrationIntensity}
            elasticity={elasticity}
            overLight={overLight}
            padding="0"
            style={{ position: "absolute", top: "50%", left: "50%" }}
          >
            <div
              className={cn(
                "rounded-[inherit] border border-white/55 bg-white/28 shadow-[var(--shadow-card)] backdrop-blur-xl",
                fallbackClassName
              )}
              style={{ width: `${size.width}px`, height: `${size.height}px` }}
            />
          </LiquidGlass>
        ) : null}
      </div>
      <div ref={contentRef} className={cn("relative z-10", contentClassName)}>
        {children}
      </div>
    </div>
  );
}
