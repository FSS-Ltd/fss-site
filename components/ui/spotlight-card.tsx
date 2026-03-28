"use client";

import React, { useEffect, useRef, type ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

type GlowTag = "div" | "li" | "article" | "section" | "blockquote";

interface GlowCardProps {
  children?: ReactNode;
  className?: string;
  glowColor?: "teal" | "cyan" | "blue" | "purple" | "green";
  size?: "sm" | "md" | "lg";
  width?: string | number;
  height?: string | number;
  customSize?: boolean;
  as?: GlowTag;
}

// Hues derived from brand palette:
// teal  → #2d9db6  ≈ H192  (brand-accent)
// cyan  → #6fd4ee  ≈ H195  (brand-primary)
const glowColorMap: Record<
  NonNullable<GlowCardProps["glowColor"]>,
  { base: number; spread: number }
> = {
  teal: { base: 192, spread: 20 },
  cyan: { base: 195, spread: 20 },
  blue: { base: 220, spread: 30 },
  purple: { base: 280, spread: 30 },
  green: { base: 150, spread: 20 },
};

const sizeMap: Record<NonNullable<GlowCardProps["size"]>, string> = {
  sm: "w-48 h-64",
  md: "w-64 h-80",
  lg: "w-80 h-96",
};

// Uses [data-glow-overlay] for the inner blur div to avoid matching
// nested GlowCard outer elements with the same [data-glow] attribute.
const spotlightStyles = `
  [data-glow]::before,
  [data-glow]::after {
    pointer-events: none;
    content: "";
    position: absolute;
    inset: calc(var(--border-size) * -1);
    border: var(--border-size) solid transparent;
    border-radius: calc(var(--radius) * 1px);
    background-attachment: fixed;
    background-size: calc(100% + (2 * var(--border-size))) calc(100% + (2 * var(--border-size)));
    background-repeat: no-repeat;
    background-position: 50% 50%;
    mask: linear-gradient(transparent, transparent), linear-gradient(white, white);
    mask-clip: padding-box, border-box;
    mask-composite: intersect;
  }

  [data-glow]::before {
    background-image: radial-gradient(
      calc(var(--spotlight-size) * 0.75) calc(var(--spotlight-size) * 0.75) at
      calc(var(--x, 0) * 1px) calc(var(--y, 0) * 1px),
      hsl(var(--hue, 192) calc(var(--saturation, 80) * 1%) calc(var(--lightness, 55) * 1%) / var(--border-spot-opacity, 1)),
      transparent 100%
    );
    filter: brightness(2);
  }

  [data-glow]::after {
    background-image: radial-gradient(
      calc(var(--spotlight-size) * 0.5) calc(var(--spotlight-size) * 0.5) at
      calc(var(--x, 0) * 1px) calc(var(--y, 0) * 1px),
      hsl(0 100% 100% / var(--border-light-opacity, 1)),
      transparent 100%
    );
  }

  [data-glow-overlay] {
    position: absolute;
    inset: 0;
    will-change: filter;
    opacity: var(--outer, 1);
    border-radius: calc(var(--radius) * 1px);
    border-width: calc(var(--border-size) * 20);
    filter: blur(calc(var(--border-size) * 10));
    background: none;
    pointer-events: none;
    border: none;
  }

  [data-glow-overlay]::before {
    pointer-events: none;
    content: "";
    position: absolute;
    inset: -10px;
    border-width: 10px;
    border-style: solid;
    border-color: transparent;
    border-radius: calc(var(--radius) * 1px);
    background-attachment: fixed;
    background-size: calc(100% + (2 * var(--border-size))) calc(100% + (2 * var(--border-size)));
    background-repeat: no-repeat;
    background-position: 50% 50%;
    mask: linear-gradient(transparent, transparent), linear-gradient(white, white);
    mask-clip: padding-box, border-box;
    mask-composite: intersect;
  }
`;

export function GlowCard({
  children,
  className,
  glowColor = "teal",
  size = "md",
  width,
  height,
  customSize = false,
  as: Tag = "div",
}: GlowCardProps) {
  const cardRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const syncPointer = (e: PointerEvent) => {
      if (!cardRef.current) return;
      cardRef.current.style.setProperty("--x", e.clientX.toFixed(2));
      cardRef.current.style.setProperty(
        "--xp",
        (e.clientX / window.innerWidth).toFixed(2),
      );
      cardRef.current.style.setProperty("--y", e.clientY.toFixed(2));
      cardRef.current.style.setProperty(
        "--yp",
        (e.clientY / window.innerHeight).toFixed(2),
      );
    };

    document.addEventListener("pointermove", syncPointer);
    return () => document.removeEventListener("pointermove", syncPointer);
  }, []);

  const { base, spread } = glowColorMap[glowColor];

  const inlineStyles: React.CSSProperties & Record<string, string | number> = {
    "--base": base,
    "--spread": spread,
    "--radius": "14",
    "--border": "2",
    "--backdrop": "hsl(213 40% 12% / 0.72)",
    "--backup-border": "var(--backdrop)",
    "--size": "200",
    "--outer": "1",
    "--border-size": "calc(var(--border, 2) * 1px)",
    "--spotlight-size": "calc(var(--size, 150) * 1px)",
    "--hue": "calc(var(--base) + (var(--xp, 0) * var(--spread, 0)))",
    backgroundImage: `radial-gradient(
      var(--spotlight-size) var(--spotlight-size) at
      calc(var(--x, 0) * 1px) calc(var(--y, 0) * 1px),
      hsl(var(--hue, 192) calc(var(--saturation, 80) * 1%) calc(var(--lightness, 68) * 1%) / var(--bg-spot-opacity, 0.08)),
      transparent
    )`,
    backgroundColor: "var(--backdrop, transparent)",
    backgroundSize:
      "calc(100% + (2 * var(--border-size))) calc(100% + (2 * var(--border-size)))",
    backgroundPosition: "50% 50%",
    backgroundAttachment: "fixed",
    border: "var(--border-size) solid var(--backup-border)",
    position: "relative",
    touchAction: "none",
    ...(width !== undefined
      ? { width: typeof width === "number" ? `${width}px` : width }
      : {}),
    ...(height !== undefined
      ? { height: typeof height === "number" ? `${height}px` : height }
      : {}),
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: spotlightStyles }} />
      <Tag
        ref={(el: HTMLElement | null) => { cardRef.current = el; }}
        data-glow
        style={inlineStyles}
        className={cn(
          !customSize && sizeMap[size],
          !customSize && "aspect-[3/4]",
          "relative grid grid-rows-[1fr_auto] gap-4 rounded-2xl p-5 shadow-[0_1rem_2rem_-1rem_black]",
          className,
        )}
      >
        <div data-glow-overlay />
        {children}
      </Tag>
    </>
  );
}
