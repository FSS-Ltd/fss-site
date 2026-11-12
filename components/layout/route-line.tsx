"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/** Where the workflow nodes sit along the line, as a share of the width. */
export const routeLineNodes = [10, 30, 50, 70, 90] as const;

const DRAW_MS = 240;
const TOTAL_MS = 600;
const DOT = 11;

function internalTarget(event: MouseEvent) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey) return false;
  if (event.shiftKey || event.altKey) return false;
  const anchor = (event.target as Element | null)?.closest?.("a[href]");
  if (!(anchor instanceof HTMLAnchorElement)) return false;
  if (anchor.target === "_blank" || anchor.hasAttribute("download")) {
    return false;
  }
  const url = new URL(anchor.href, location.href);
  return url.origin === location.origin && url.pathname !== location.pathname;
}

/** Draws the motif once across the page: the line grows, the nodes light in
 *  sequence, then it fades, all inside TOTAL_MS. Transform and opacity only. */
export function playRouteLine(root: HTMLElement) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const line = root.firstElementChild as HTMLElement | null;
  if (!line || !root.animate) return;
  root.animate([{ opacity: 1 }, { opacity: 1, offset: 0.78 }, { opacity: 0 }], {
    duration: TOTAL_MS,
    fill: "both",
  });
  line.animate([{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], {
    duration: DRAW_MS,
    easing: "cubic-bezier(0.2, 0.75, 0.2, 1)",
    fill: "both",
  });
  routeLineNodes.forEach((position, index) => {
    root.children[index + 1]?.animate(
      [
        { opacity: 0, transform: "scale(0.3)" },
        { opacity: 1, transform: "scale(1.35)", offset: 0.6 },
        { opacity: 1, transform: "scale(1)" },
      ],
      {
        duration: 180,
        delay: Math.max(0, (position / 100) * DRAW_MS - 40),
        fill: "both",
      },
    );
  });
}

/** The page-change signal under the persisted header: a rust workflow line
 *  with five nodes. It starts on the click of an internal link, so feedback is
 *  immediate, and on any other route change (back, forward) that did not
 *  already start it. Reduced motion gets none of it. */
export function RouteLine() {
  const root = useRef<HTMLSpanElement>(null);
  const pathname = usePathname();
  const previous = useRef(pathname);
  const startedAt = useRef(0);

  const start = () => {
    if (!root.current || Date.now() - startedAt.current < TOTAL_MS + 300)
      return;
    startedAt.current = Date.now();
    playRouteLine(root.current);
  };

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (internalTarget(event)) start();
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  });

  useEffect(() => {
    if (previous.current === pathname) return;
    previous.current = pathname;
    start();
  });

  return (
    <span
      ref={root}
      aria-hidden="true"
      style={{
        position: "absolute",
        insetInline: 0,
        bottom: -DOT / 2,
        height: DOT,
        opacity: 0,
        pointerEvents: "none",
        viewTransitionName: "fss-line",
      }}
    >
      <span
        style={{
          position: "absolute",
          insetInline: 0,
          top: (DOT - 4) / 2,
          height: 4,
          background: "var(--brand-primary)",
          transformOrigin: "left",
        }}
      />
      {routeLineNodes.map((position) => (
        <span
          key={position}
          style={{
            position: "absolute",
            top: 0,
            left: `${position}%`,
            width: DOT,
            height: DOT,
            marginLeft: -DOT / 2,
            borderRadius: "50%",
            background: "var(--brand-primary)",
            boxShadow: "0 0 0 2px #f2f3f5",
            opacity: 0,
          }}
        />
      ))}
    </span>
  );
}
