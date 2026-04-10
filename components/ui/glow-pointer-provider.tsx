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

function setupGlowController() {
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

  const cards = Array.from(document.querySelectorAll<HTMLElement>("[data-glow]"));
  for (const card of cards) {
    allCards.add(card);
    intersectionObserver.observe(card);
  }

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

  queueFrame();
  window.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("pointerleave", onPointerLeave, { passive: true });
  window.addEventListener("blur", onWindowBlur);

  return () => {
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
}

export function GlowPointerProvider() {
  const pathname = usePathname();

  useEffect(() => {
    if (!canAnimateGlow()) {
      return;
    }

    let controllerCleanup: (() => void) | null = null;
    let started = false;

    const startController = () => {
      if (started) {
        return;
      }

      started = true;
      controllerCleanup = setupGlowController();
    };

    const startOnFirstInteraction = () => {
      startController();
    };

    window.addEventListener("pointermove", startOnFirstInteraction, {
      passive: true,
      once: true,
    });
    window.addEventListener("pointerdown", startOnFirstInteraction, {
      passive: true,
      once: true,
    });
    window.addEventListener("keydown", startOnFirstInteraction, { once: true });
    window.addEventListener("focusin", startOnFirstInteraction, { once: true });

    return () => {
      window.removeEventListener("pointermove", startOnFirstInteraction);
      window.removeEventListener("pointerdown", startOnFirstInteraction);
      window.removeEventListener("keydown", startOnFirstInteraction);
      window.removeEventListener("focusin", startOnFirstInteraction);

      controllerCleanup?.();
    };
  }, [pathname]);

  return null;
}
