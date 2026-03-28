"use client";

// CSS for [data-glow] and [data-glow-overlay] lives in app/globals.css.
// A single module-level pointer listener updates all mounted cards at once,
// avoiding one listener per instance.

import React, { useEffect, useRef, type ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

type GlowTag = "div" | "li" | "article" | "section" | "blockquote";

interface GlowCardProps {
  children?: ReactNode;
  className?: string;
  customSize?: boolean;
  as?: GlowTag;
}

// All mounted card elements — updated by the single shared listener below.
const mountedCards = new Set<HTMLElement>();

function syncPointer(e: PointerEvent) {
  const x = e.clientX.toFixed(2);
  const xp = (e.clientX / window.innerWidth).toFixed(2);
  const y = e.clientY.toFixed(2);
  const yp = (e.clientY / window.innerHeight).toFixed(2);

  for (const el of mountedCards) {
    el.style.setProperty("--x", x);
    el.style.setProperty("--xp", xp);
    el.style.setProperty("--y", y);
    el.style.setProperty("--yp", yp);
  }
}

// Register exactly one listener for the lifetime of the page.
if (typeof window !== "undefined") {
  document.addEventListener("pointermove", syncPointer);
}

export function GlowCard({
  children,
  className,
  customSize = false,
  as: Tag = "div",
}: GlowCardProps) {
  const cardRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    mountedCards.add(el);
    return () => { mountedCards.delete(el); };
  }, []);

  const inlineStyles: React.CSSProperties & Record<string, string | number> = {
    "--base": 192,
    "--spread": 20,
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
    backgroundSize: "calc(100% + (2 * var(--border-size))) calc(100% + (2 * var(--border-size)))",
    backgroundPosition: "50% 50%",
    backgroundAttachment: "fixed",
    border: "var(--border-size) solid var(--backup-border)",
    position: "relative",
    touchAction: "none",
  };

  return (
    <Tag
      ref={(el: HTMLElement | null) => { cardRef.current = el; }}
      data-glow
      style={inlineStyles}
      className={cn(
        !customSize && "w-64 h-80 aspect-[3/4]",
        "relative grid grid-rows-[1fr_auto] gap-4 rounded-2xl p-5 shadow-[0_1rem_2rem_-1rem_black]",
        className,
      )}
    >
      <div data-glow-overlay />
      {children}
    </Tag>
  );
}
