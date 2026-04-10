"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

function canAnimateGlow() {
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    return false;
  }

  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function setPointerStyles(card: HTMLElement, x: number, y: number) {
  card.style.setProperty("--x", x.toFixed(2));
  card.style.setProperty("--y", y.toFixed(2));
  card.style.setProperty("--xp", (x / window.innerWidth).toFixed(3));
  card.style.setProperty("--yp", (y / window.innerHeight).toFixed(3));
}

export function GlowPointerProvider() {
  const pathname = usePathname();

  useEffect(() => {
    if (!canAnimateGlow()) {
      return;
    }

    const allCards = new Set<HTMLElement>();
    const visibleCards = new Set<HTMLElement>();
    let hoveredCard: HTMLElement | null = null;
    let pointerX = window.innerWidth / 2;
    let pointerY = window.innerHeight / 2;
    let frameId: number | null = null;

    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const card = entry.target as HTMLElement;
          if (!allCards.has(card)) {
            continue;
          }

          if (entry.isIntersecting) {
            visibleCards.add(card);
          } else {
            visibleCards.delete(card);
            if (hoveredCard === card) {
              hoveredCard = null;
            }
          }
        }
      },
      { threshold: 0.01 },
    );

    const syncObservedCards = () => {
      const currentCards = new Set(
        Array.from(document.querySelectorAll<HTMLElement>("[data-glow]")),
      );

      for (const card of currentCards) {
        if (allCards.has(card)) {
          continue;
        }

        allCards.add(card);
        intersectionObserver.observe(card);
      }

      for (const card of Array.from(allCards)) {
        if (currentCards.has(card)) {
          continue;
        }

        allCards.delete(card);
        visibleCards.delete(card);
        intersectionObserver.unobserve(card);

        if (hoveredCard === card) {
          hoveredCard = null;
        }
      }
    };

    const flushPointerUpdate = () => {
      frameId = null;

      if (hoveredCard && allCards.has(hoveredCard)) {
        setPointerStyles(hoveredCard, pointerX, pointerY);
        return;
      }

      for (const card of visibleCards) {
        setPointerStyles(card, pointerX, pointerY);
      }
    };

    const queueFrame = () => {
      if (frameId !== null) {
        return;
      }

      frameId = window.requestAnimationFrame(flushPointerUpdate);
    };

    const onPointerMove = (event: PointerEvent) => {
      pointerX = event.clientX;
      pointerY = event.clientY;

      const target = event.target as Element | null;
      const card = target?.closest?.("[data-glow]");
      hoveredCard = card instanceof HTMLElement && allCards.has(card) ? card : null;

      queueFrame();
    };

    const onPointerLeave = () => {
      hoveredCard = null;
      pointerX = window.innerWidth / 2;
      pointerY = window.innerHeight / 2;
      queueFrame();
    };

    const onWindowBlur = () => {
      hoveredCard = null;
    };

    const mutationObserver = new MutationObserver(syncObservedCards);
    mutationObserver.observe(document.body, { childList: true, subtree: true });

    syncObservedCards();
    queueFrame();

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerleave", onPointerLeave, { passive: true });
    window.addEventListener("blur", onWindowBlur);

    return () => {
      mutationObserver.disconnect();
      intersectionObserver.disconnect();
      allCards.clear();
      visibleCards.clear();
      hoveredCard = null;

      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("blur", onWindowBlur);

      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [pathname]);

  return null;
}
