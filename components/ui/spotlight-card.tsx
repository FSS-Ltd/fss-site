"use client";

import {
  useEffect,
  useRef,
  type CSSProperties,
  type ReactNode,
} from "react";

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

// Global manager: one pointer loop and only visible / hovered cards are updated.
const mountedCards = new Set<HTMLElement>();
const visibleCards = new Set<HTMLElement>();
let activeCardCount = 0;
let pointerListener: ((event: PointerEvent) => void) | null = null;
let pointerLeaveListener: (() => void) | null = null;
let windowBlurListener: (() => void) | null = null;
let intersectionObserver: IntersectionObserver | null = null;
let frameId: number | null = null;
let pointerX = 0;
let pointerY = 0;
let hoveredCard: HTMLElement | null = null;

type GlowCardStyle = CSSProperties & Record<`--${string}`, string | number>;

function applyPointerToCard(card: HTMLElement) {
  card.style.setProperty("--x", pointerX.toFixed(2));
  card.style.setProperty("--y", pointerY.toFixed(2));
  card.style.setProperty("--xp", (pointerX / window.innerWidth).toFixed(3));
  card.style.setProperty("--yp", (pointerY / window.innerHeight).toFixed(3));
}

function syncPointerFrame() {
  frameId = null;

  if (hoveredCard && mountedCards.has(hoveredCard)) {
    applyPointerToCard(hoveredCard);
    return;
  }

  for (const card of visibleCards) {
    applyPointerToCard(card);
  }
}

function isFinePointerDevice() {
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function ensureObserver() {
  if (intersectionObserver) {
    return intersectionObserver;
  }

  intersectionObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const target = entry.target as HTMLElement;
        if (!mountedCards.has(target)) {
          continue;
        }

        if (entry.isIntersecting) {
          visibleCards.add(target);
        } else {
          visibleCards.delete(target);
          if (hoveredCard === target) {
            hoveredCard = null;
          }
        }
      }
    },
    { threshold: 0.01 },
  );

  return intersectionObserver;
}

function registerListeners() {
  if (pointerListener || !isFinePointerDevice()) {
    return;
  }

  pointerListener = (event: PointerEvent) => {
    pointerX = event.clientX;
    pointerY = event.clientY;

    if (frameId === null) {
      frameId = window.requestAnimationFrame(syncPointerFrame);
    }
  };

  pointerLeaveListener = () => {
    pointerX = window.innerWidth / 2;
    pointerY = window.innerHeight / 2;

    if (frameId === null) {
      frameId = window.requestAnimationFrame(syncPointerFrame);
    }
  };

  windowBlurListener = () => {
    hoveredCard = null;
  };

  window.addEventListener("pointermove", pointerListener, { passive: true });
  window.addEventListener("pointerleave", pointerLeaveListener, { passive: true });
  window.addEventListener("blur", windowBlurListener);
}

function unregisterListeners() {
  if (!pointerListener) {
    return;
  }

  window.removeEventListener("pointermove", pointerListener);
  pointerListener = null;

  if (pointerLeaveListener) {
    window.removeEventListener("pointerleave", pointerLeaveListener);
    pointerLeaveListener = null;
  }

  if (frameId !== null) {
    window.cancelAnimationFrame(frameId);
    frameId = null;
  }

  if (windowBlurListener) {
    window.removeEventListener("blur", windowBlurListener);
    windowBlurListener = null;
  }

  hoveredCard = null;
}

function detachObserver() {
  if (!intersectionObserver) {
    return;
  }

  intersectionObserver.disconnect();
  intersectionObserver = null;
  visibleCards.clear();
}

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
  const cardRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const element = cardRef.current;
    if (!element || !isFinePointerDevice()) {
      return;
    }

    activeCardCount += 1;
    mountedCards.add(element);
    registerListeners();
    ensureObserver().observe(element);

    const onEnter = () => {
      hoveredCard = element;
      visibleCards.add(element);
    };

    const onLeave = () => {
      if (hoveredCard === element) {
        hoveredCard = null;
      }
    };

    element.addEventListener("pointerenter", onEnter, { passive: true });
    element.addEventListener("pointerleave", onLeave, { passive: true });

    return () => {
      element.removeEventListener("pointerenter", onEnter);
      element.removeEventListener("pointerleave", onLeave);
      intersectionObserver?.unobserve(element);
      mountedCards.delete(element);
      visibleCards.delete(element);

      if (hoveredCard === element) {
        hoveredCard = null;
      }

      activeCardCount -= 1;

      if (activeCardCount <= 0) {
        activeCardCount = 0;
        unregisterListeners();
        detachObserver();
      }
    };
  }, []);

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
      ref={(element: HTMLElement | null) => {
        cardRef.current = element;
      }}
      data-glow
      style={inlineStyles}
      className={cn(
        !customSize && sizeMap[size],
        !customSize && "aspect-[3/4]",
        "relative grid grid-rows-[1fr_auto] gap-4 overflow-hidden rounded-2xl border border-border-soft/45 bg-surface-1/80 p-5 shadow-[0_1rem_2rem_-1rem_black]",
        className,
      )}
    >
      <div aria-hidden="true" data-glow-overlay />
      {children}
    </Tag>
  );
}
