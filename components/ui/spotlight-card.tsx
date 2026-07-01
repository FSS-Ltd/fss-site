import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

type GlowTag = "div" | "li" | "article" | "section" | "blockquote";
type GlowColor = "blue" | "purple" | "green" | "red" | "orange";
type GlowCardSize = "sm" | "md" | "lg";

interface GlowCardProps {
  children?: ReactNode;
  className?: string;
  glowColor?: GlowColor;
  size?: GlowCardSize;
  width?: string | number;
  height?: string | number;
  customSize?: boolean;
  as?: GlowTag;
}

const glowColorMap: Record<GlowColor, { base: number; spread: number }> = {
  blue: { base: 220, spread: 200 },
  purple: { base: 280, spread: 300 },
  green: { base: 120, spread: 200 },
  red: { base: 0, spread: 200 },
  orange: { base: 30, spread: 200 },
};

const sizeMap: Record<GlowCardSize, string> = {
  sm: "w-48 h-64",
  md: "w-64 h-80",
  lg: "w-80 h-96",
};

type GlowCardStyle = CSSProperties & Record<`--${string}`, string | number>;

export function GlowCard({
  children,
  className,
  glowColor = "blue",
  size = "md",
  width,
  height,
  customSize = false,
  as: Tag = "div",
}: GlowCardProps) {
  const { base, spread } = glowColorMap[glowColor];
  const inlineStyles: GlowCardStyle = {
    "--x": 0,
    "--y": 0,
    "--xp": 0,
    "--yp": 0,
    "--base": base,
    "--spread": spread,
    "--radius": "14",
    "--border": "3",
    "--size": "200",
    "--outer": 0.9,
    "--backdrop": "hsl(0 0% 60% / 0.12)",
    "--backup-border": "var(--backdrop)",
    "--border-size": "calc(var(--border) * 1px)",
    "--spotlight-size": "calc(var(--size) * 1px)",
    "--hue": "calc(var(--base) + (var(--xp, 0) * var(--spread, 0)))",
    backgroundImage: `radial-gradient(
      var(--spotlight-size) var(--spotlight-size) at
      calc(var(--x, 0) * 1px)
      calc(var(--y, 0) * 1px),
      hsl(var(--hue, 210) calc(var(--saturation, 100) * 1%) calc(var(--lightness, 70) * 1%) / 0.1),
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
  };

  if (width !== undefined) {
    inlineStyles.width = typeof width === "number" ? `${width}px` : width;
  }

  if (height !== undefined) {
    inlineStyles.height = typeof height === "number" ? `${height}px` : height;
  }

  return (
    <Tag
      data-glow
      style={inlineStyles}
      className={cn(
        !customSize && sizeMap[size],
        !customSize && "aspect-[3/4]",
        "relative grid grid-rows-[1fr_auto] gap-4 overflow-hidden rounded-2xl border border-border-soft/45 bg-surface-1/80 p-5 shadow-[0_1rem_2rem_-1rem_black]",
        className,
      )}
    >
      {children}
    </Tag>
  );
}
